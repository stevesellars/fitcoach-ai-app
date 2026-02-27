import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

/**
 * n8n's chat webhook can return:
 *  1. A single JSON object          → { output: "..." }
 *  2. Newline-delimited JSON (NDJSON) → one object per line, last wins
 *  3. SSE lines with "data:" prefix  → handled separately via text/event-stream
 *
 * This function handles all three and returns the final text output.
 */
function extractOutput(raw: string): string {
  // Fast-path: single clean JSON object
  try {
    const data = JSON.parse(raw)
    return (
      data.output ?? data.text ?? data.message ?? data.response ??
      (typeof data === 'string' ? data : '')
    )
  } catch { /* fall through to line-by-line parsing */ }

  // Line-by-line: NDJSON or SSE — accumulate chunks, prefer final "end" event
  let accumulated = ''
  const lines = raw.split('\n')

  for (const line of lines) {
    // Strip "data: " SSE prefix if present
    const jsonStr = line.startsWith('data:') ? line.slice(5).trim() : line.trim()
    if (!jsonStr || jsonStr === '[DONE]') continue

    try {
      const parsed = JSON.parse(jsonStr)

      if (parsed.type === 'end') {
        // Definitive final event — use its output and stop
        return parsed.output ?? parsed.text ?? accumulated
      }
      if (parsed.type === 'chunk') {
        accumulated += parsed.output ?? parsed.text ?? ''
      } else if (parsed.type === 'AIMessageChunk') {
        accumulated += parsed.content ?? ''
      } else {
        // Unknown shape — take whatever output field exists
        const chunk = parsed.output ?? parsed.text ?? parsed.content ?? parsed.message ?? ''
        if (chunk) accumulated += chunk
      }
    } catch { /* non-JSON line, skip */ }
  }

  return accumulated
}

export async function POST(req: NextRequest) {
  const { message, sessionId } = await req.json()

  const webhookUrl = process.env.N8N_CHAT_WEBHOOK_URL
  if (!webhookUrl) {
    return Response.json({ error: 'Webhook URL not configured' }, { status: 500 })
  }

  let n8nResponse: Response
  try {
    n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        sessionId,
        chatInput: message,
      }),
    })
  } catch {
    return Response.json({ error: 'Could not reach the coaching service' }, { status: 502 })
  }

  if (!n8nResponse.ok) {
    return Response.json(
      { error: `Upstream error: ${n8nResponse.status}` },
      { status: n8nResponse.status }
    )
  }

  const contentType = n8nResponse.headers.get('content-type') ?? ''

  // Stream SSE directly back to the client
  if (contentType.includes('text/event-stream')) {
    return new Response(n8nResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // Read raw text — n8n sometimes returns newline-delimited JSON (NDJSON)
  // rather than a single JSON object, so we can't use res.json() directly.
  const raw = await n8nResponse.text()
  const output = extractOutput(raw)
  return Response.json({ output })
}

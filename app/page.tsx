'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500]
const LEVEL_TITLES = ['Newcomer', 'Trainee', 'Athlete', 'Competitor', 'Elite']
const XP_PER_MSG = 10
const SOCIAL_PROOF_TARGET = 4218

const BADGES = [
  { id: 'first_rep',   icon: '🏁', name: 'First Rep',     desc: 'Sent your first message' },
  { id: 'goal_setter', icon: '💬', name: 'Goal Setter',   desc: 'Got your first reply' },
  { id: 'on_a_roll',   icon: '🔥', name: 'On A Roll',     desc: '10 messages in one session' },
  { id: 'inbox',       icon: '📧', name: 'Inbox Athlete', desc: 'Got a plan emailed to you' },
  { id: 'comeback',    icon: '⚡', name: 'Comeback',      desc: 'Opened 3 days in a row' },
  { id: 'elite',       icon: '🏆', name: 'Elite',         desc: 'Reached Level 5' },
]

const QUOTES = [
  { text: 'Discipline is the bridge between goals and accomplishment.', by: 'Jim Rohn' },
  { text: 'The only bad workout is the one that didn\'t happen.', by: '' },
  { text: 'Take care of your body. It\'s the only place you have to live.', by: 'Jim Rohn' },
  { text: 'Strength does not come from physical capacity. It comes from an indomitable will.', by: 'Gandhi' },
  { text: 'Success usually comes to those who are too busy to be looking for it.', by: 'Henry Thoreau' },
  { text: 'All progress takes place outside the comfort zone.', by: '' },
  { text: 'You don\'t have to be extreme, just consistent.', by: '' },
  { text: 'The pain you feel today will be the strength you feel tomorrow.', by: '' },
  { text: 'Your body can stand almost anything. It\'s your mind you have to convince.', by: '' },
  { text: 'Every champion was once a contender who refused to give up.', by: 'Rocky Balboa' },
]

const QUICK_STARTS = [
  'I want to build muscle 💪',
  'Help me lose fat 🔥',
  'Boost my endurance 🏃',
  "I'm a complete beginner 🌱",
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

interface GameState {
  xp: number
  level: number
  achievements: string[]
  streak: { last: string; count: number }
  sessions: number
}

const DEFAULT_STATE: GameState = {
  xp: 0,
  level: 1,
  achievements: [],
  streak: { last: '', count: 0 },
  sessions: 0,
}

// ─── Markdown ────────────────────────────────────────────────────────────────

function renderMarkdown(raw: string): string {
  let s = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  s = s.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  s = s.replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>')
  s = s.replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>')
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="md-b"><em>$1</em></strong>')
  s = s.replace(/\*\*(.+?)\*\*/g,     '<strong class="md-b">$1</strong>')
  s = s.replace(/\*(.+?)\*/g,         '<em class="md-i">$1</em>')
  s = s.replace(/^---$/gm, '<hr class="md-hr"/>')
  s = s.replace(/^[-•] (.+)$/gm,    '<li class="md-li"><span class="md-bul">—</span><span>$1</span></li>')
  s = s.replace(/^(\d+)\. (.+)$/gm, '<li class="md-li"><span class="md-num">$1.</span><span>$2</span></li>')
  s = s.replace(/((?:<li[\s\S]*?<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>')
  s = s.replace(/`(.+?)`/g, '<code class="md-code">$1</code>')
  s = s.replace(/\n\n/g, '</p><p class="md-p">')
  s = `<p class="md-p">${s}</p>`
  s = s.replace(/(?<!<\/[a-z0-9]+>)\n(?!<)/g, '<br/>')
  return s
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return Math.min(i + 1, 5)
  }
  return 1
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

// ─── useGameState ─────────────────────────────────────────────────────────────

function useGameState() {
  const [state, setState] = useState<GameState>(DEFAULT_STATE)
  // Ref mirrors state for synchronous reads inside callbacks
  const ref = useRef<GameState>(DEFAULT_STATE)
  const [mounted, setMounted] = useState(false)

  const persist = useCallback((next: GameState) => {
    ref.current = next
    try { localStorage.setItem('fc_game', JSON.stringify(next)) } catch { /* noop */ }
    setState(next)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fc_game')
      const saved: GameState = raw
        ? { ...DEFAULT_STATE, ...JSON.parse(raw) }
        : { ...DEFAULT_STATE }

      // Streak
      const today = toISODate(new Date())
      const yesterday = toISODate(new Date(Date.now() - 86_400_000))
      const last = saved.streak?.last ?? ''
      let count = saved.streak?.count ?? 0
      if (last !== today) {
        count = last === yesterday ? count + 1 : 1
        saved.streak = { last: today, count }
      }

      // Session counter (once per browser session)
      if (!sessionStorage.getItem('sc_init')) {
        saved.sessions = (saved.sessions ?? 0) + 1
        sessionStorage.setItem('sc_init', '1')
      }

      // Comeback badge
      if (count >= 3 && !saved.achievements.includes('comeback')) {
        saved.achievements = [...saved.achievements, 'comeback']
      }

      persist(saved)
    } catch {
      persist({ ...DEFAULT_STATE })
    }
    setMounted(true)
  }, [persist])

  const addXP = useCallback((amount: number): boolean => {
    const cur = ref.current
    const newXP = cur.xp + amount
    const newLevel = computeLevel(newXP)
    const leveledUp = newLevel > cur.level
    const ach = [...cur.achievements]
    if (newLevel === 5 && !ach.includes('elite')) ach.push('elite')
    persist({ ...cur, xp: newXP, level: newLevel, achievements: ach })
    return leveledUp
  }, [persist])

  const unlock = useCallback((id: string) => {
    const cur = ref.current
    if (cur.achievements.includes(id)) return
    persist({ ...cur, achievements: [...cur.achievements, id] })
  }, [persist])

  return { state, ref, mounted, addXP, unlock }
}

// ─── useCountUp ───────────────────────────────────────────────────────────────

function useCountUp(target: number, ms = 1300) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start: number | null = null
    const tick = (t: number) => {
      if (!start) start = t
      const p = Math.min((t - start) / ms, 1)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.floor(ease * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    const id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [target, ms])
  return val
}

// ─── XPRing ───────────────────────────────────────────────────────────────────

function XPRing({ xp, level, pulse }: { xp: number; level: number; pulse: boolean }) {
  const R = 34
  const SW = 4
  const SIZE = R * 2 + SW * 2 + 2
  const C = 2 * Math.PI * R

  const prev = LEVEL_THRESHOLDS[level - 1] ?? 0
  const next = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[4]
  const pct = level >= 5 ? 1 : Math.max(0, Math.min((xp - prev) / (next - prev), 1))
  const offset = C * (1 - pct)
  const cx = SIZE / 2

  return (
    <div className={`ring-wrap${pulse ? ' ring-pulse' : ''}`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="#2a2a28" strokeWidth={SW} />
        <circle
          cx={cx} cy={cx} r={R}
          fill="none" stroke="#16a34a" strokeWidth={SW}
          strokeDasharray={C} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dashoffset 0.55s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="ring-inner">
        <span className="ring-num">{level}</span>
        <span className="ring-lbl">LVL</span>
      </div>
    </div>
  )
}

// ─── GameSidebar ──────────────────────────────────────────────────────────────

function GameSidebar({
  state, pulse, sessionMsgs,
}: {
  state: GameState
  pulse: boolean
  sessionMsgs: number
}) {
  const social = useCountUp(SOCIAL_PROOF_TARGET)
  const quote = QUOTES[(state.sessions - 1) % QUOTES.length]
  const level = state.level
  const xpToNext = level >= 5 ? null : LEVEL_THRESHOLDS[level] - state.xp

  return (
    <aside className="sidebar" aria-label="Your progress">
      {/* ── Progress ── */}
      <div className="sb-section">
        <p className="sb-label">Progress</p>
        <div className="level-row">
          <XPRing xp={state.xp} level={level} pulse={pulse} />
          <div className="level-copy">
            <span className="level-title">{LEVEL_TITLES[level - 1]}</span>
            <span className="level-xp">{state.xp.toLocaleString()} XP</span>
            {xpToNext !== null && (
              <span className="level-next">{xpToNext} to {LEVEL_TITLES[level]}</span>
            )}
            {level >= 5 && (
              <span className="level-next">Maximum rank</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="sb-section">
        <p className="sb-label">Stats</p>
        <div className="stats-row">
          <div className="stat">
            <span className="stat-val">{state.streak.count}</span>
            <span className="stat-lbl">day streak 🔥</span>
          </div>
          <div className="stat-div" />
          <div className="stat">
            <span className="stat-val">{state.sessions}</span>
            <span className="stat-lbl">sessions</span>
          </div>
          <div className="stat-div" />
          <div className="stat">
            <span className="stat-val">{sessionMsgs}</span>
            <span className="stat-lbl">today</span>
          </div>
        </div>
      </div>

      {/* ── Achievements ── */}
      <div className="sb-section">
        <p className="sb-label">Achievements</p>
        <div className="badge-grid">
          {BADGES.map(b => {
            const on = state.achievements.includes(b.id)
            return (
              <div key={b.id} className={`badge ${on ? 'on' : 'off'}`} title={b.desc}>
                <span className="badge-icon">{on ? b.icon : '🔒'}</span>
                <span className="badge-name">{b.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Quote ── */}
      <div className="sb-section sb-quote-wrap">
        <p className="sb-label">Today&rsquo;s motivation</p>
        <blockquote className="sb-quote">&ldquo;{quote.text}&rdquo;</blockquote>
        {quote.by && <p className="sb-quote-by">— {quote.by}</p>}
      </div>

      {/* ── Social proof ── */}
      <div className="sb-proof">
        <span className="proof-arrow">↑</span>
        <span className="proof-num">{social.toLocaleString()}</span>
        <span className="proof-lbl">plans created</span>
      </div>
    </aside>
  )
}

// ─── CompactBar (mobile) ──────────────────────────────────────────────────────

function CompactBar({ state, sessionMsgs }: { state: GameState; sessionMsgs: number }) {
  return (
    <div className="compact-bar" aria-label="Your progress">
      <span className="cb-level">Lv {state.level} · {LEVEL_TITLES[state.level - 1]}</span>
      <span className="cb-dot">·</span>
      <span className="cb-streak">🔥 {state.streak.count}d</span>
      <span className="cb-dot">·</span>
      <span className="cb-msgs">{sessionMsgs} msg{sessionMsgs !== 1 ? 's' : ''}</span>
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function TypingDots() {
  return (
    <span className="typing" aria-label="Coach is typing">
      <span /><span /><span />
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FitnessCoachPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionMsgs, setSessionMsgs] = useState(0)
  const [levelPulse, setLevelPulse] = useState(false)
  const sessionId = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { state, ref: gsRef, mounted, addXP, unlock } = useGameState()

  useEffect(() => { sessionId.current = crypto.randomUUID() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const grow = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
  }

  const pulse = useCallback(() => {
    setLevelPulse(true)
    setTimeout(() => setLevelPulse(false), 700)
  }, [])

  const send = useCallback(async (quick?: string) => {
    const body = (quick ?? input).trim()
    if (!body || streaming) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: body }
    const aId = crypto.randomUUID()
    const aMsg: Message = { id: aId, role: 'assistant', content: '' }

    setMessages(prev => [...prev, userMsg, aMsg])
    setInput('')
    setStreaming(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Gamification on send
    const newCount = sessionMsgs + 1
    setSessionMsgs(newCount)
    const isFirstEver = !gsRef.current.achievements.includes('first_rep')
    const leveledUp = addXP(XP_PER_MSG)
    if (isFirstEver) unlock('first_rep')
    if (newCount === 10) unlock('on_a_roll')
    if (leveledUp) pulse()

    // Abort if n8n takes > 90s (e.g. tool call hangs)
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 90_000)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body, sessionId: sessionId.current }),
        signal: controller.signal,
      })
      clearTimeout(abortTimer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const ct = res.headers.get('content-type') ?? ''
      let finalOutput = ''

      if (ct.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let acc = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (raw === '[DONE]') continue
            try {
              const p = JSON.parse(raw)
              let chunk = ''
              if (p.type === 'chunk') {
                chunk = p.output ?? p.text ?? ''
              } else if (p.type === 'end') {
                // p.output may be '' (empty string, not null) — fall back to acc
                const candidate = p.output || p.text || acc
                finalOutput = candidate || acc
                setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: finalOutput } : m))
                continue
              } else if (p.type === 'AgentFinish') {
                // n8n LangChain agent emits AgentFinish after tool calls
                chunk = (typeof p.output === 'string' ? p.output : p.output?.output) ?? p.text ?? ''
              } else if (p.type === 'AIMessageChunk') {
                chunk = p.content ?? ''
              } else {
                chunk = p.output ?? p.text ?? p.content ?? p.message ?? ''
              }
              if (chunk) {
                acc += chunk
                finalOutput = acc
                setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: acc } : m))
              }
            } catch { /* non-JSON line */ }
          }
        }

        // Flush any remaining buffered line
        if (buf.trim()) {
          const jsonStr = buf.startsWith('data:') ? buf.slice(5).trim() : buf.trim()
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const p = JSON.parse(jsonStr)
              const chunk = p.output ?? p.text ?? p.content ?? ''
              if (chunk) { acc += chunk; finalOutput = acc }
            } catch { /* skip */ }
          }
        }

        // Fallback: stream closed without a proper 'end' event — use accumulated chunks
        if (!finalOutput && acc) {
          finalOutput = acc
          setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: acc } : m))
        }
      } else {
        const data = await res.json()
        finalOutput = data.output ?? data.text ?? data.message ?? data.response ?? ''
        setMessages(prev => prev.map(m => m.id === aId ? { ...m, content: finalOutput } : m))
      }

      // Post-response achievements
      if (!gsRef.current.achievements.includes('goal_setter')) unlock('goal_setter')
      const lo = finalOutput.toLowerCase()
      if (lo.includes('on its way') || lo.includes('sent to') || lo.includes('plan is on its way')) {
        unlock('inbox')
      }
    } catch (err: unknown) {
      clearTimeout(abortTimer)
      const isAbort = err instanceof Error && err.name === 'AbortError'
      setMessages(prev => prev.map(m => {
        if (m.id !== aId) return m
        if (m.content !== '') return m  // Already has partial content — don't wipe it
        return {
          ...m,
          content: isAbort
            ? 'The coach took too long to respond. Please try again.'
            : 'Something went wrong. Please try again.',
          error: true,
        }
      }))
    } finally {
      clearTimeout(abortTimer)
      setStreaming(false)
    }
  }, [input, streaming, sessionMsgs, gsRef, addXP, unlock, pulse])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; background: #0c0c0b; }

        :root {
          --bg:     #0c0c0b;
          --surf:   #161615;
          --bdr:    #272725;
          --text:   #f0f0ee;
          --muted:  #6b7280;
          --acc:    #22c55e;
          --acc-lt: #14532d;
          --acc-dk: #4ade80;
          --fd:  var(--font-display, 'Georgia', serif);
          --fb:  var(--font-body,    system-ui, sans-serif);
          --fm:  var(--font-mono,    monospace);
        }

        .app { display:flex; height:100dvh; overflow:hidden; background:var(--bg); }

        /* ── Chat pane ── */
        .chat-pane {
          flex: 1; min-width: 0;
          display: flex; flex-direction: column;
          border-right: 1px solid var(--bdr);
        }

        /* ── Header ── */
        .app-header {
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; height: 60px;
          border-bottom: 1px solid var(--bdr);
          background: var(--bg);
        }
        .hd-left  { display:flex; align-items:baseline; gap:10px; }
        .hd-name  { font-family:var(--fd); font-size:1.2rem; color:var(--text); letter-spacing:-.015em; }
        .hd-tag   { font-family:var(--fb); font-size:.72rem; color:var(--muted); font-weight:400; }
        .hd-live  {
          font-family:var(--fb); font-size:.68rem; font-weight:600;
          letter-spacing:.08em; text-transform:uppercase; color:var(--acc);
          display:flex; align-items:center; gap:6px;
        }
        .hd-live::before {
          content:''; width:6px; height:6px; border-radius:50%; background:var(--acc);
          animation: pdot 2.5s ease-in-out infinite;
        }
        @keyframes pdot { 0%,100%{opacity:1} 50%{opacity:.25} }

        /* ── Compact bar ── */
        .compact-bar {
          display: none; flex-shrink: 0;
          align-items: center; gap: 7px;
          padding: 7px 20px; font-family: var(--fb); font-size: .74rem;
          background: var(--surf); border-bottom: 1px solid var(--bdr);
        }
        .cb-level { font-weight:600; color:var(--text); }
        .cb-dot   { color:var(--bdr); }
        .cb-streak, .cb-msgs { color:var(--muted); }

        /* ── Messages ── */
        .msgs {
          flex:1; overflow-y:auto;
          scrollbar-width:thin; scrollbar-color:var(--bdr) transparent;
        }
        .msgs::-webkit-scrollbar       { width:3px; }
        .msgs::-webkit-scrollbar-thumb { background:var(--bdr); border-radius:2px; }

        .msgs-inner {
          max-width:680px; margin:0 auto;
          padding: 36px 28px 16px;
          display:flex; flex-direction:column; gap:28px;
        }

        /* Welcome */
        .welcome {
          display:flex; flex-direction:column; gap:18px;
          animation: fi .35s ease-out;
        }
        .wlc-h {
          font-family:var(--fd); font-size:2.2rem; line-height:1.1;
          letter-spacing:-.025em; color:var(--text);
        }
        .wlc-p {
          font-family:var(--fb); font-size:.875rem; line-height:1.65;
          color:var(--muted); max-width:420px;
        }
        .quick-list { display:flex; flex-direction:column; gap:8px; padding-top:4px; width:100%; max-width:460px; }
        .qbtn {
          font-family:var(--fb); font-size:.875rem; font-weight:400;
          padding:14px 18px; border-radius:10px; text-align:left;
          border:1px solid var(--bdr); background:#1a1a19; color:var(--text);
          cursor:pointer; transition:border-color .15s,background .15s;
          width:100%;
        }
        .qbtn:hover { border-color:var(--acc); background:#1f2e23; }

        /* Message rows */
        .mrow {
          display:flex; flex-direction:column; gap:5px;
          animation: fi .2s ease-out;
        }
        .mrow.user { align-items:flex-end; }
        .mrow.asst { align-items:flex-start; }

        .mlabel {
          font-family:var(--fb); font-size:.65rem; font-weight:700;
          letter-spacing:.07em; text-transform:uppercase;
          color:var(--muted); padding:0 2px;
        }

        /* User bubble */
        .bub-user {
          max-width:72%;
          background:var(--acc); color:#fff;
          font-family:var(--fb); font-size:.875rem; line-height:1.6; font-weight:450;
          padding:10px 16px; border-radius:18px 18px 4px 18px;
          word-break:break-word;
        }

        /* Coach text — editorial, left border */
        .bub-asst {
          max-width:88%;
          padding-left:16px; border-left:2px solid var(--acc);
          font-family:var(--fb); font-size:.875rem; line-height:1.75; color:var(--text);
          word-break:break-word;
        }
        .bub-asst.err { border-left-color:#ef4444; color:#f87171; font-style:italic; }

        /* Typing */
        .typing { display:inline-flex; gap:4px; align-items:center; }
        .typing span {
          width:5px; height:5px; border-radius:50%;
          background:var(--muted);
          animation: td .8s ease-in-out infinite;
        }
        .typing span:nth-child(2) { animation-delay:.14s; }
        .typing span:nth-child(3) { animation-delay:.28s; }
        @keyframes td { 0%,80%,100%{transform:translateY(0);opacity:.35} 40%{transform:translateY(-4px);opacity:1} }

        /* Markdown */
        .md-h1,.md-h2,.md-h3 { font-family:var(--fd); color:var(--text); margin:14px 0 5px; line-height:1.2; }
        .md-h1 { font-size:1.05rem; } .md-h2 { font-size:.95rem; } .md-h3 { font-size:.875rem; }
        .md-p  { margin:5px 0; }
        .md-b  { font-weight:700; color:var(--text); }
        .md-i  { font-style:italic; color:var(--muted); }
        .md-ul { list-style:none; margin:8px 0; padding:0; display:flex; flex-direction:column; gap:5px; }
        .md-li { display:flex; gap:10px; align-items:flex-start; }
        .md-bul{ color:var(--acc); font-weight:700; flex-shrink:0; margin-top:1px; }
        .md-num{ font-family:var(--fm); font-size:.78rem; color:var(--acc); flex-shrink:0; min-width:20px; margin-top:2px; }
        .md-hr { border:none; border-top:1px solid var(--bdr); margin:12px 0; }
        .md-code{ font-family:var(--fm); font-size:.79rem; background:var(--surf); color:var(--acc-dk); padding:1px 6px; border-radius:4px; border:1px solid var(--bdr); }

        /* ── Footer ── */
        .app-footer {
          flex-shrink:0; padding:14px 28px 20px;
          border-top:1px solid var(--bdr); background:var(--bg);
        }
        .input-row { display:flex; gap:10px; align-items:flex-end; max-width:680px; margin:0 auto; }
        .input-box {
          flex:1; display:flex; align-items:flex-end;
          border:1px solid var(--bdr); border-radius:12px; background:var(--bg);
          transition:border-color .15s;
        }
        .input-box:focus-within { border-color:var(--acc); }
        .chat-input {
          flex:1; background:transparent; border:none; outline:none; resize:none;
          font-family:var(--fb); font-size:.875rem; color:var(--text); line-height:1.5;
          padding:11px 14px; min-height:44px; max-height:100px; scrollbar-width:none;
        }
        .chat-input::placeholder { color:#404040; }
        .chat-input:disabled     { opacity:.45; cursor:not-allowed; }
        .send-btn {
          width:42px; height:42px; border-radius:10px;
          background:var(--acc); border:none; cursor:pointer; color:#fff;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          transition:background .15s,opacity .15s,transform .08s;
        }
        .send-btn:hover:not(:disabled) { background:var(--acc-dk); }
        .send-btn:active:not(:disabled){ transform:scale(.94); }
        .send-btn:disabled { opacity:.28; cursor:not-allowed; }
        .spin {
          width:14px; height:14px; border-radius:50%;
          border:2px solid rgba(255,255,255,.3); border-top-color:#fff;
          animation:spin .6s linear infinite;
        }
        @keyframes spin { to{transform:rotate(360deg)} }
        .input-hint {
          font-family:var(--fb); font-size:.66rem; color:#3a3a38;
          text-align:center; margin-top:7px;
          max-width:680px; margin-left:auto; margin-right:auto;
        }

        /* ── Sidebar ── */
        .sidebar {
          width:272px; flex-shrink:0;
          background:#111110; border-left:1px solid var(--bdr);
          overflow-y:auto; display:flex; flex-direction:column;
          scrollbar-width:thin; scrollbar-color:var(--bdr) transparent;
        }
        .sidebar::-webkit-scrollbar       { width:3px; }
        .sidebar::-webkit-scrollbar-thumb { background:var(--bdr); }

        .sb-section {
          padding:20px;
          border-bottom:1px solid var(--bdr);
          background:#161615;
        }
        .sb-label {
          font-family:var(--fb); font-size:.64rem; font-weight:700;
          letter-spacing:.1em; text-transform:uppercase;
          color:var(--muted); margin-bottom:14px;
        }

        /* Ring */
        .ring-wrap {
          position:relative; display:inline-flex;
          flex-direction:column; align-items:center;
          flex-shrink:0;
        }
        .ring-wrap.ring-pulse svg circle:last-child {
          animation: rpulse .6s ease;
        }
        @keyframes rpulse {
          0%  { stroke:var(--acc);   }
          50% { stroke:#4ade80;      }
          100%{ stroke:var(--acc);   }
        }
        .ring-inner {
          position:absolute;
          inset:0;
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          pointer-events:none;
        }
        .ring-num { font-family:var(--fd); font-size:1.55rem; color:var(--text); line-height:1; }
        .ring-lbl { font-family:var(--fm); font-size:.5rem; letter-spacing:.14em; color:var(--muted); text-transform:uppercase; }

        .level-row  { display:flex; align-items:center; gap:16px; }
        .level-copy { display:flex; flex-direction:column; gap:3px; }
        .level-title{ font-family:var(--fd); font-size:1.05rem; color:var(--text); line-height:1; }
        .level-xp   { font-family:var(--fm); font-size:.7rem; color:var(--muted); }
        .level-next { font-family:var(--fb); font-size:.7rem; color:var(--acc); }

        /* Stats */
        .stats-row { display:flex; align-items:center; }
        .stat { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; padding:4px 0; }
        .stat-val { font-family:var(--fm); font-size:1.15rem; font-weight:500; color:var(--text); line-height:1; }
        .stat-lbl { font-family:var(--fb); font-size:.62rem; color:var(--muted); text-align:center; }
        .stat-div { width:1px; height:28px; background:var(--bdr); flex-shrink:0; }

        /* Badges */
        .badge-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .badge {
          display:flex; flex-direction:column; align-items:center; gap:4px;
          padding:10px 6px; border-radius:8px; border:1px solid var(--bdr);
          background:var(--bg); cursor:default;
        }
        .badge.on { background:var(--acc-lt); border-color:transparent; }
        .badge.off { opacity:.45; }
        .badge-icon { font-size:1.2rem; line-height:1; }
        .badge-name {
          font-family:var(--fb); font-size:.62rem; font-weight:600;
          color:var(--acc-dk); text-align:center; line-height:1.25;
        }
        .badge.off .badge-name { color:var(--muted); }

        /* Quote */
        .sb-quote-wrap { border-bottom:1px solid var(--bdr); }
        .sb-quote {
          font-family:var(--fd); font-style:italic;
          font-size:.83rem; line-height:1.6; color:var(--text);
          border-left:2px solid var(--bdr); padding-left:12px;
          margin-bottom:8px;
        }
        .sb-quote-by {
          font-family:var(--fb); font-size:.68rem;
          color:var(--muted); padding-left:14px;
        }

        /* Social proof */
        .sb-proof {
          margin-top:auto; padding:16px 20px;
          display:flex; align-items:center; gap:6px;
          background:#161615; border-bottom:1px solid var(--bdr);
        }
        .proof-arrow { font-size:.85rem; color:var(--acc); font-weight:700; }
        .proof-num   { font-family:var(--fm); font-size:.85rem; color:var(--text); }
        .proof-lbl   { font-family:var(--fb); font-size:.75rem; color:var(--muted); }

        @keyframes fi { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }

        /* ── Responsive ── */
        @media (max-width:767px) {
          .sidebar       { display:none; }
          .compact-bar   { display:flex; }
          .chat-pane     { border-right:none; }
          .msgs-inner    { padding:24px 16px 12px; }
          .app-footer    { padding:12px 16px 18px; }
          .hd-tag        { display:none; }
          .wlc-h         { font-size:1.75rem; }
          .app-header    { padding:0 16px; }
        }
      `}</style>

      <div className="app">
        {/* ── Chat pane ── */}
        <div className="chat-pane">
          <header className="app-header">
            <div className="hd-left">
              <span className="hd-name">Selerna Fitness Coach</span>
              <span className="hd-tag">AI-powered personal training</span>
            </div>
            <span className="hd-live">Live</span>
          </header>

          {mounted && <CompactBar state={state} sessionMsgs={sessionMsgs} />}

          <main className="msgs" aria-live="polite" aria-label="Chat messages">
            <div className="msgs-inner">
              {messages.length === 0 ? (
                <div className="welcome">
                  <h1 className="wlc-h">Your personal<br />fitness coach.</h1>
                  <p className="wlc-p">
                    Tell me your goal — I'll ask a few questions and build a complete plan
                    with workouts, nutrition, and a 4-week progression. Then send it to your inbox.
                  </p>
                  <div className="quick-list">
                    {QUICK_STARTS.map(q => (
                      <button key={q} className="qbtn" onClick={() => send(q)}>{q}</button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`mrow ${msg.role === 'user' ? 'user' : 'asst'}`}>
                    <span className="mlabel">{msg.role === 'user' ? 'You' : 'Coach'}</span>
                    {msg.role === 'user' ? (
                      <div className="bub-user">{msg.content}</div>
                    ) : (
                      <div className={`bub-asst${msg.error ? ' err' : ''}`}>
                        {msg.content === ''
                          ? <TypingDots />
                          : <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        }
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </main>

          <footer className="app-footer">
            <div className="input-row">
              <div className="input-box">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  value={input}
                  onChange={e => { setInput(e.target.value); grow() }}
                  onKeyDown={onKey}
                  disabled={streaming}
                  placeholder="Tell me your fitness goal…"
                  rows={1}
                  aria-label="Message input"
                />
              </div>
              <button
                className="send-btn"
                onClick={() => send()}
                disabled={streaming || !input.trim()}
                aria-label="Send message"
              >
                {streaming ? <span className="spin" /> : <SendIcon />}
              </button>
            </div>
            <p className="input-hint">Enter to send · Shift + Enter for new line</p>
          </footer>
        </div>

        {/* ── Sidebar ── */}
        {mounted && (
          <GameSidebar state={state} pulse={levelPulse} sessionMsgs={sessionMsgs} />
        )}
      </div>
    </>
  )
}

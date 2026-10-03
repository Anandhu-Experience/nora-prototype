import { AlertTriangle, Check, ChevronDown, Info, Loader2, Minus, ShieldX, Trash2, Workflow, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { isRunning, traceStore, type Stage, type StepStatus, type Trace } from '../../guardrails/trace'

const STAGE: Record<Stage, string> = { input: 'Input / chatbot', guardrails: 'Input guardrails', agent: 'Agent', llm: 'LLM', output: 'Output' }

const ICON: Record<StepStatus, { icon: typeof Check; tone: string; label: string }> = {
  pending: { icon: Loader2, tone: 'bg-slate-100 text-slate-500', label: 'Running' },
  pass: { icon: Check, tone: 'bg-emerald-50 text-emerald-600', label: 'Passed' },
  warn: { icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600', label: 'Changed or flagged' },
  block: { icon: ShieldX, tone: 'bg-rose-50 text-rose-600', label: 'Blocked' },
  skip: { icon: Minus, tone: 'bg-slate-100 text-slate-400', label: 'Skipped' },
  info: { icon: Info, tone: 'bg-blue-50 text-blue-600', label: 'Note' },
}

const OUTCOME: Record<NonNullable<Trace['outcome']>, { label: string; tone: string }> = {
  answered: { label: 'Answered', tone: 'bg-emerald-50 text-emerald-700' },
  ai: { label: 'AI draft', tone: 'bg-emerald-50 text-emerald-700' },
  template: { label: 'Template', tone: 'bg-amber-50 text-amber-700' },
  blocked: { label: 'Blocked', tone: 'bg-rose-50 text-rose-700' },
}

function TraceCard({ trace, open, onToggle }: { trace: Trace; open: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => { if (open) ref.current?.scrollIntoView({ block: 'nearest' }) }, [open])
  let last: Stage | null = null
  return (
    <li ref={ref} className="rounded-xl border border-slate-200 bg-white">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3.5 py-3 text-left">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{trace.source === 'chat' ? 'Chat' : 'Draft'}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{trace.title}</span>
        {trace.done ? trace.outcome && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${OUTCOME[trace.outcome].tone}`}>{OUTCOME[trace.outcome].label}</span> : <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"><Loader2 size={11} className="animate-spin" /> Running</span>}
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="space-y-0 border-t border-slate-100 px-3.5 py-3" aria-label="Steps">
          {trace.steps.map((st) => {
            const I = ICON[st.status]
            const head = st.stage !== last
            last = st.stage
            return (
              <Fragment key={st.id}>
                {head && <li role="presentation" className="pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 first:pt-0">{STAGE[st.stage]}</li>}
              <li className="relative pl-8">
                <span className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ${I.tone}`} title={I.label}><I.icon size={13} className={st.status === 'pending' ? 'animate-spin' : ''} /></span>
                <div className="pb-2.5">
                  <div className="flex items-baseline justify-between gap-2"><span className="text-[13px] font-medium text-slate-900">{st.label}</span>{st.ms !== undefined && <span className="shrink-0 font-mono text-[11px] text-slate-400">{st.ms} ms</span>}</div>
                  {st.detail && <p className="text-xs leading-relaxed text-slate-500">{st.detail}</p>}
                </div>
              </li>
              </Fragment>
            )
          })}
        </ol>
      )}
    </li>
  )
}

/** Right-hand panel with the flow of every chat message and AI draft: input, guardrails, agent, LLM, output. Live while running, kept after. */
export function TraceDrawer() {
  const { traces, open, focus } = traceStore.use()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && document.querySelectorAll('[role=dialog]').length === 0) traceStore.close() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open])
  if (!open) return null
  const isOpen = (t: Trace, i: number) => expanded[t.id] ?? (focus ? t.id === focus : i === 0)
  return (
    <aside role="complementary" aria-label="Flow trace" className="fixed inset-y-0 right-0 z-[55] flex w-full max-w-[420px] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <Workflow size={18} className="text-blue-600" />
        <div className="min-w-0 flex-1"><h2 className="text-[15px] font-semibold text-slate-900">Flow trace</h2><p className="text-xs text-slate-500">Input → guardrails → agent → LLM → output</p></div>
        <button onClick={() => traceStore.clear()} aria-label="Clear trace" title="Clear" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Trash2 size={16} /></button>
        <button onClick={() => traceStore.close()} aria-label="Close flow trace" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {traces.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nothing yet. Send a message to NORA or use a "Draft with AI" button and the steps appear here as they run.</div>
        ) : (
          <ul className="space-y-2.5">{traces.map((t, i) => <TraceCard key={t.id} trace={t} open={isOpen(t, i)} onToggle={() => setExpanded((m) => ({ ...m, [t.id]: !isOpen(t, i) }))} />)}</ul>
        )}
      </div>
    </aside>
  )
}

/** The top-bar button that opens the panel. Spins while a run is in progress. */
export function TraceButton() {
  const s = traceStore.use()
  const running = isRunning(s)
  return (
    <button onClick={() => (s.open ? traceStore.close() : traceStore.open())} aria-pressed={s.open} aria-label="Flow trace" title="See the steps from input to the model"
      className={`relative inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${s.open ? 'border-slate-400 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
      {running ? <Loader2 size={16} className="animate-spin" /> : <Workflow size={16} />}
      <span className="hidden xl:inline">Flow</span>
      {s.traces.length > 0 && <span className="rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-700">{s.traces.length}</span>}
    </button>
  )
}

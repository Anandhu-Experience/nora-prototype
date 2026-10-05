import { useSyncExternalStore } from 'react'

/**
 * The flow trace: every NORA chat message, AI draft and skill run records the steps it went through with a status and a time,
 * so you can see what happened while it runs and after. A skill run follows NORA's architecture: user graph, analyze, prioritize,
 * select skill, model routing, guardrails and execute, update data, evals. Chat and plain drafts use input, guardrails, agent, LLM, output.
 * In memory only; the last 30 runs are kept.
 */
export type Stage = 'input' | 'guardrails' | 'agent' | 'llm' | 'output' | 'graph' | 'analyze' | 'prioritize' | 'select' | 'routing' | 'execute' | 'update' | 'eval'
export type StepStatus = 'pending' | 'pass' | 'warn' | 'block' | 'skip' | 'info'

export interface TraceStep { id: string; stage: Stage; label: string; status: StepStatus; detail: string; ms?: number }
export interface Trace {
  id: string
  source: 'chat' | 'draft' | 'run'
  title: string
  at: number
  steps: TraceStep[]
  done: boolean
  outcome?: 'answered' | 'blocked' | 'ai' | 'template' | 'completed' | 'declined' | 'superseded'
}
interface State { traces: Trace[]; open: boolean; focus: string | null }

const MAX = 30
let state: State = { traces: [], open: false, focus: null }
const listeners = new Set<() => void>()
const commit = (next: State) => { state = next; listeners.forEach((l) => l()) }

export const traceStore = {
  get: (): State => state,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
  use: (): State => useSyncExternalStore(traceStore.subscribe, traceStore.get),
  open: (focus: string | null = null) => commit({ ...state, open: true, focus }),
  close: () => commit({ ...state, open: false }),
  clear: () => commit({ ...state, traces: [], focus: null }),
}

let seq = 0
export interface TraceHandle {
  id: string
  add: (step: Omit<TraceStep, 'ms'>) => void
  update: (id: string, patch: Partial<Omit<TraceStep, 'id' | 'ms'>>) => void
  finish: (outcome: Trace['outcome']) => void
}

const patchTrace = (id: string, fn: (t: Trace) => Trace) => commit({ ...state, traces: state.traces.map((t) => (t.id === id ? fn(t) : t)) })

/** Starts a trace. Steps are added as they begin and updated as they finish; `ms` is the time since the run started. */
export function startTrace(source: Trace['source'], title: string): TraceHandle {
  const id = `tr-${++seq}`
  const t0 = performance.now()
  const elapsed = (status: StepStatus) => (status === 'pending' ? undefined : Math.round(performance.now() - t0))
  commit({ ...state, traces: [{ id, source, title: title.slice(0, 90), at: Date.now(), steps: [], done: false }, ...state.traces].slice(0, MAX) })
  return {
    id,
    add: (step) => patchTrace(id, (t) => ({ ...t, steps: [...t.steps, { ...step, ms: elapsed(step.status) }] })),
    update: (stepId, patch) => patchTrace(id, (t) => ({ ...t, steps: t.steps.map((s) => (s.id === stepId ? { ...s, ...patch, ms: elapsed(patch.status ?? s.status) ?? s.ms } : s)) })),
    finish: (outcome) => patchTrace(id, (t) => ({ ...t, done: true, outcome })),
  }
}

export const isRunning = (s: State): boolean => s.traces.some((t) => !t.done)

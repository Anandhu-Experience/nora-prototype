import type { Graph } from '../mock/graph'
import type { ScenarioId } from '../mock/types'
import type { Draft, ExploreCard, Insight, Proposal, Validation } from '../skills/types'

export type NoraStatus =
  | 'IDLE'
  | 'CHECKING'
  | 'SKILL_PROPOSED'
  | 'SKILL_APPROVED'
  | 'READING'
  | 'VALIDATING'
  | 'DRAFT_READY'
  | 'WRITE_APPROVAL'
  | 'WRITING'
  | 'RESULT_READY' // read-only skills show their insight here instead of a draft
  | 'COMPLETED'
  | 'REJECTED'
  | 'RE_EVALUATING'
  | 'ALL_GOOD'
  | 'EXPLORE'
  | 'ERROR'

/** The explicit machine. Anything not listed is illegal. `reset` is always allowed. */
export const TRANSITIONS: Record<NoraStatus, readonly NoraStatus[]> = {
  IDLE: ['CHECKING'],
  CHECKING: ['SKILL_PROPOSED', 'ALL_GOOD', 'ERROR'],
  SKILL_PROPOSED: ['SKILL_APPROVED', 'REJECTED', 'RE_EVALUATING'],
  SKILL_APPROVED: ['READING', 'ERROR', 'RE_EVALUATING'],
  READING: ['VALIDATING', 'ERROR', 'RE_EVALUATING'],
  VALIDATING: ['DRAFT_READY', 'RESULT_READY', 'RE_EVALUATING', 'ERROR'],
  DRAFT_READY: ['WRITE_APPROVAL', 'RE_EVALUATING'],
  WRITE_APPROVAL: ['WRITING', 'REJECTED'],
  WRITING: ['COMPLETED', 'ERROR'],
  RESULT_READY: ['COMPLETED'],
  COMPLETED: ['RE_EVALUATING'],
  REJECTED: ['RE_EVALUATING'],
  RE_EVALUATING: ['SKILL_PROPOSED', 'ALL_GOOD', 'ERROR'],
  ALL_GOOD: ['EXPLORE'],
  EXPLORE: ['CHECKING', 'RE_EVALUATING'],
  ERROR: ['IDLE'],
}

export const canTransition = (from: NoraStatus, to: NoraStatus): boolean => TRANSITIONS[from].includes(to)

/** One row per skill from the latest evaluation pass. Drives the debug panel. */
export interface Evaluation {
  skillId: string
  name: string
  kind: string
  priority: number
  applies: boolean
  reason: string
  relevance: number
  /** Already completed, rejected or acknowledged this session. */
  handled: boolean
  /** 1 = selected; only set for eligible (applies, unhandled, non-explore) skills. */
  rank: number | null
}

export interface LogEntry {
  at: number
  message: string
  /** Set on entries that record a state transition. */
  status?: NoraStatus
}

export type Outcome = 'applied' | 'rejected' | 'acknowledged' | 'nothing-to-do'

export interface NoraState {
  status: NoraStatus
  scenario: ScenarioId | null
  graph: Graph | null
  /** Graph as it was before the most recent write, to show the update. */
  previousGraph: Graph | null
  evaluations: Evaluation[]
  selectedSkillId: string | null
  proposal: Proposal | null
  validation: Validation | null
  draft: Draft | null
  insight: Insight | null
  explore: ExploreCard | null
  /** Skills not to propose again this session. */
  handled: string[]
  lastOutcome: { skillId: string; outcome: Outcome } | null
  error: string | null
  log: LogEntry[]
}

export const initialState = (): NoraState => ({
  status: 'IDLE',
  scenario: null,
  graph: null,
  previousGraph: null,
  evaluations: [],
  selectedSkillId: null,
  proposal: null,
  validation: null,
  draft: null,
  insight: null,
  explore: null,
  handled: [],
  lastOutcome: null,
  error: null,
  log: [],
})

export type NoraAction =
  | { type: 'reset'; scenario: ScenarioId | null }
  | { type: 'transition'; to: NoraStatus; patch?: Partial<NoraState>; note?: string }
  | { type: 'patch'; patch: Partial<NoraState>; note?: string }

const withLog = (s: NoraState, note?: string, status?: NoraStatus): LogEntry[] =>
  note ? [...s.log, { at: Date.now(), message: note, status }] : s.log

export function noraReducer(state: NoraState, action: NoraAction): NoraState {
  switch (action.type) {
    case 'reset':
      return { ...initialState(), scenario: action.scenario }
    case 'transition':
      if (!canTransition(state.status, action.to)) return state
      return {
        ...state,
        ...action.patch,
        status: action.to,
        log: withLog(state, action.note ?? `${state.status} → ${action.to}`, action.to),
      }
    case 'patch':
      return { ...state, ...action.patch, log: withLog(state, action.note) }
  }
}

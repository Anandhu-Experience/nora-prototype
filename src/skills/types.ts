import type { Graph } from '../mock/graph'
import type { AiTaskKind } from '../profile/aiTasks'
import type { SimChange } from '../presence/srs'

/** action: reads -> drafts -> writes. insight: read-only. explore: external app card. */
export type SkillKind = 'action' | 'insight' | 'explore'

/** Models a skill may use. NORA never chooses; the skill declares it. */
export type AllowedModel = 'fable-5-1' | 'opus-5-5' | 'sonnet-5-5' | 'haiku-4-5' | 'none'

/** Answer to "does this skill apply to this user right now?" */
export interface Applicability {
  applies: boolean
  /** Why / why not. Shown in the debug panel's evaluation table. */
  reason: string
  /** 0-100, how strongly the graph calls for this skill. Used for ranking within a priority tier. */
  relevance: number
}

/** The message NORA shows for "Approval 1 - start skill". */
export interface Proposal {
  message: string
  cta: string
}

export interface Finding {
  id: string
  label: string
  detail: string
}

/** Result of read + validate. `context` is opaque to NORA and handed back to the skill. */
export interface Validation {
  findings: Finding[]
  context: unknown
}

export interface Change {
  label: string
  before: string
  after: string
}

/** What gets shown for "Approval 2 - write", and what write() applies. */
export interface Draft {
  summary: string
  changes: Change[]
  /** Opaque to NORA; consumed by the same skill's write(). */
  payload: unknown
  /** Who wrote it: a real model, or the built-in template used when AI is unavailable. */
  source?: 'ai' | 'mock'
  /** The API model that wrote it (source 'ai'). */
  model?: string
  /** Why the template was used (source 'mock'), in words fit for the user. */
  note?: string
}

/** Input to the single LLM abstraction generateSkillDraft(). */
export interface DraftRequest {
  skillId: string
  model: AllowedModel
  /** Prompt a real model would receive. */
  instruction: string
  /** Deterministic template. Used when no AI service is available, so the flow always works. */
  mockDraft: Draft
  /**
   * Ask the AI service for the text instead. The server owns the prompt and the model; the skill only
   * supplies structured facts and says how to place the returned text into the draft.
   */
  ai?: {
    kind: AiTaskKind
    input: unknown
    /** `fields` carries structured parts when the task returns more than one (e.g. a tagline and a description). */
    apply: (text: string, draft: Draft, fields?: Record<string, string>) => Draft
  }
}

/** What the user is asked to allow on the provider's screen. */
export interface ConsentRequest {
  provider: string
  /** Button on the NORA card that opens the provider's screen. */
  cta: string
  permissions: string[]
  /** The account the access is for, as the provider shows it. */
  account: string
}

export interface Insight {
  title: string
  body: string
}

export interface ExploreAction {
  label: string
  url: string
  primary?: boolean
}

export interface ExploreCard {
  headline: string
  body: string
  stats?: { label: string; value: string }[]
  actions: ExploreAction[]
}

export interface Skill {
  id: string
  name: string
  description: string
  domain: 'profile' | 'connections' | 'reviews' | 'listings' | 'analytics' | 'voce'
  kind: SkillKind
  /** Higher runs first. Explore skills sit at the bottom so they only surface when nothing else applies. */
  priority: number
  allowedModel: AllowedModel
  requiresApproval: boolean
  /**
   * Set when the write needs the user to grant access on another service's own screen (OAuth). The panel then asks
   * for that consent instead of a plain "Approve & Apply", and the write only runs once it is granted.
   */
  consent?: ConsentRequest
  /** One run handles one item (one review). While the skill still applies after a write, NORA offers the next one. */
  repeatable?: boolean
  /** Mirrors SKILL.md. */
  whenToUse: string[]
  whenNotToUse: string[]
  /** Raw SKILL.md, for display only. Nothing executes from it. */
  doc: string

  /** The change this skill would make to what the Search Rank Score reads, so its worth can be shown before it runs. */
  scoreChange?(graph: Graph): SimChange | null
  evaluate(graph: Graph): Applicability
  proposal(graph: Graph): Proposal
  /** Measurable effect of running the skill, derived from the graph. Omitted when it can't be stated honestly. */
  expectedOutcome?(graph: Graph): { label: string; before: string; after: string } | null

  // action + insight
  read?(): Promise<unknown>
  validate?(data: unknown): Validation
  // action
  buildDraftRequest?(validation: Validation): DraftRequest
  write?(draft: Draft): Promise<void>
  /** Lets the user change the drafted text before approving. Returns the draft with the text in place. */
  editDraft?(draft: Draft, text: string): Draft
  /** Label of the approve button on the draft card (default "Approve & Apply"). */
  approveCta?: string
  /** Longest text the user may keep when editing the draft. */
  editLimit?: number
  // insight
  insight?(validation: Validation): Insight
  // explore
  explore?(graph: Graph): ExploreCard
}

/** Lets a skill type its own read data while exposing the erased Skill shape. */
export function defineSkill<TRead>(
  skill: Omit<Skill, 'read' | 'validate'> & {
    read?: () => Promise<TRead>
    validate?: (data: TRead) => Validation
  },
): Skill {
  return skill as unknown as Skill
}

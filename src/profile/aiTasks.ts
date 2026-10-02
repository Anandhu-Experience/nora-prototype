/**
 * The AI-assisted drafting tasks. Pure data, shared by the browser (to describe a request) and by
 * the server handler (which owns the prompts and the model choice, so the browser can never pick
 * a model or supply its own prompt).
 */
export type AiTaskKind = 'bio' | 'review-reply' | 'service'

/**
 * What each model accepts, because the request shape differs by model:
 *  - `effort`: the `output_config.effort` control (not available on Haiku 4.5).
 *  - `fallbacks`: server-side retry on a safety decline (Opus 5.5 / Sonnet 5.5 only).
 *  - `maxTokens`: output budget. The larger models always think, and thinking counts toward it.
 * Prices are $ per million tokens (input / output), for choosing between them.
 */
export const MODEL_CAPS = {
  'claude-haiku-4-5': { effort: false, fallbacks: false, maxTokens: 1024, price: '$1 / $5' },
  'claude-sonnet-5-5': { effort: true, fallbacks: true, maxTokens: 4000, price: '$2 / $10' },
  'claude-opus-5-5': { effort: true, fallbacks: true, maxTokens: 4000, price: '$4 / $20' },
} as const
export type ModelId = keyof typeof MODEL_CAPS

export const AI_TASKS = {
  bio: {
    label: 'Profile bio',
    /** The API model id the server calls. Short, well-specified drafts: the cheapest model is enough. */
    model: 'claude-haiku-4-5' as ModelId,
    /** The name the NORA skill shows for it (skill.allowedModel). */
    allowedModel: 'haiku-4-5',
    /** Hard cap; the Edit Profile form allows 600. */
    maxChars: 600,
  },
  service: {
    label: 'Service description',
    model: 'claude-haiku-4-5' as ModelId,
    allowedModel: 'haiku-4-5',
    /** Description limit; the tagline has its own (SERVICE_TAGLINE_MAX). */
    maxChars: 300,
  },
  'review-reply': {
    label: 'Review reply',
    model: 'claude-haiku-4-5' as ModelId,
    allowedModel: 'haiku-4-5',
    maxChars: 500,
  },
} as const satisfies Record<AiTaskKind, { label: string; model: ModelId; allowedModel: string; maxChars: number }>

export const isAiTaskKind = (k: unknown): k is AiTaskKind => typeof k === 'string' && k in AI_TASKS

/** What the browser sends for a bio draft: only facts the bio may use. No contact details. */
export interface BioInput {
  name: string
  title: string
  company: string
  location: string
  yearsExperience: number
  completedLoans: number
  specialties: string[]
  services: { name: string; blurb: string }[]
  rating: { avg: number; count: number }
  /** Up to 3 recent review texts, without reviewer names. Untrusted text. */
  reviewSnippets: string[]
}

/** What the browser sends for a review reply. */
export interface ReplyInput {
  agentFirstName: string
  agentTitle: string
  reviewerFirstName: string
  rating: number
  /** Untrusted text. */
  reviewText: string
}

export const SERVICE_TAGLINE_MAX = 60

/** What the browser sends for a service: the service and the few facts about the professional it may draw on. */
export interface ServiceInput {
  serviceName: string
  agentFirstName: string
  agentTitle: string
  location: string
  yearsExperience: number
  specialties: string[]
  /** What is there now, if anything. The AI improves it rather than starting blind. */
  existingTagline: string
  existingDescription: string
}

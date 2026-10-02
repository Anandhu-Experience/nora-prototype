import { generateSkillDraft, type GenerateOptions } from '../nora/generateSkillDraft'
import { AI_TASKS, type ReplyInput, type ServiceInput } from './aiTasks'
import type { Agent, Review, Service } from './types'

const firstName = (name: string) => name.replace(/^agent\s+/i, '').trim().split(/\s+/)[0] || 'there'

/** The template used when AI is unavailable. Shaped by the rating, never by the review's wording. */
export function templateReply(review: Review): string {
  const who = firstName(review.author)
  if (review.rating >= 5) return `Thank you, ${who}! It was a pleasure helping you, and I really appreciate you taking the time to share this.`
  if (review.rating === 4) return `Thanks for the kind words, ${who}. I'm glad it went well, and I'd welcome any thoughts on how I could make the process even smoother.`
  return `Thank you for the honest feedback, ${who}. I'm sorry the experience fell short of what it should be. Please reach out to me directly so I can put things right.`
}

export interface ReplyDraft {
  text: string
  source: 'ai' | 'mock'
  model?: string
  /** Why a template was used instead of AI. */
  note?: string
}

/**
 * Draft a public reply to a review. The owner always reads, edits and posts it: this never posts anything.
 * Goes through the same abstraction as NORA's skills, so it shares the AI call, the fallback and the labelling.
 */
export async function draftReviewReply(agent: Agent, review: Review, opts?: GenerateOptions): Promise<ReplyDraft> {
  const input: ReplyInput = {
    agentFirstName: firstName(agent.name),
    agentTitle: agent.title,
    reviewerFirstName: firstName(review.author),
    rating: review.rating,
    reviewText: review.text.slice(0, 1000),
  }
  const draft = await generateSkillDraft(
    {
      skillId: 'review-reply',
      model: AI_TASKS['review-reply'].allowedModel,
      instruction: 'Draft a public reply to the review (server-side prompt).',
      mockDraft: { summary: 'Reply to review', changes: [], payload: { text: templateReply(review) } },
      ai: {
        kind: 'review-reply',
        input,
        apply: (text, d) => ({ ...d, payload: { text } }),
      },
    },
    opts,
  )
  return { text: (draft.payload as { text: string }).text, source: draft.source ?? 'mock', model: draft.model, note: draft.note }
}

/** The template used when AI is unavailable. Generic on purpose: it states nothing the owner hasn't supplied. */
export function templateServiceCopy(service: Service): { blurb: string; description: string } {
  const what = service.name.trim().toLowerCase() || 'this service'
  return {
    blurb: `Help with ${what}`,
    description: `I help clients with ${what}, explaining each option clearly and guiding you from the first conversation to completion.`,
  }
}

export interface ServiceCopyDraft {
  blurb: string
  description: string
  source: 'ai' | 'mock'
  model?: string
  note?: string
}

/**
 * Draft a tagline and description for one service. `agent` is the profile as currently being edited, so unsaved
 * changes count. The owner reads and edits the result and it is only saved with Save Changes.
 */
export async function draftServiceCopy(agent: Agent, service: Service, opts?: GenerateOptions): Promise<ServiceCopyDraft> {
  const input: ServiceInput = {
    serviceName: service.name.trim().slice(0, 80),
    agentFirstName: firstName(agent.name),
    agentTitle: agent.title,
    location: agent.location,
    yearsExperience: agent.yearsExperience,
    specialties: agent.specialties.slice(0, 12),
    existingTagline: service.blurb.slice(0, 200),
    existingDescription: service.description.slice(0, 600),
  }
  const template = templateServiceCopy(service)
  const draft = await generateSkillDraft(
    {
      skillId: 'service-description',
      model: AI_TASKS.service.allowedModel,
      instruction: 'Draft a tagline and description for the service (server-side prompt).',
      mockDraft: { summary: 'Service copy', changes: [], payload: template },
      ai: {
        kind: 'service',
        input,
        apply: (text, d, fields) => ({ ...d, payload: { blurb: fields?.blurb ?? template.blurb, description: fields?.description ?? text } }),
      },
    },
    opts,
  )
  const copy = draft.payload as { blurb: string; description: string }
  return { ...copy, source: draft.source ?? 'mock', model: draft.model, note: draft.note }
}

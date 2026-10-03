import { generateSkillDraft, type GenerateOptions } from '../nora/generateSkillDraft'
import { AI_TASKS, type AgentFacts, type ArticleInput, type FaqInput, type MetaInput, type ReplyInput, type ServiceInput } from './aiTasks'
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

/* ---------------- website, AI visibility ---------------- */

const factsOf = (agent: Agent): AgentFacts => ({
  agentFirstName: firstName(agent.name),
  agentTitle: agent.title,
  location: agent.location,
  yearsExperience: agent.yearsExperience,
  specialties: agent.specialties.slice(0, 12),
})

export interface TextDraft {
  text: string
  source: 'ai' | 'mock'
  model?: string
  note?: string
}

/** Template used when AI is unavailable. States only what the profile already says. */
export function templateMeta(agent: Agent): string {
  const what = agent.specialties.slice(0, 2).join(' and ').toLowerCase() || 'home loans'
  const out = `${firstName(agent.name)} is a ${agent.title.toLowerCase()} in ${agent.location} helping clients with ${what}.`
  return out.length <= AI_TASKS.meta.maxChars ? out : `${out.slice(0, AI_TASKS.meta.maxChars - 1).trim()}…`
}

/** Draft the website's meta description. The owner reads and edits it; nothing is saved until they apply it. */
export async function draftMeta(agent: Agent, opts?: GenerateOptions): Promise<TextDraft> {
  const input: MetaInput = { ...factsOf(agent), services: agent.services.map((s) => s.name.slice(0, 80)).slice(0, 12) }
  const template = templateMeta(agent)
  const draft = await generateSkillDraft(
    {
      skillId: 'meta-description',
      model: AI_TASKS.meta.allowedModel,
      instruction: 'Draft the website meta description (server-side prompt).',
      mockDraft: { summary: 'Meta description', changes: [], payload: { text: template } },
      ai: { kind: 'meta', input, apply: (text, d) => ({ ...d, payload: { text } }) },
    },
    opts,
  )
  return { text: (draft.payload as { text: string }).text, source: draft.source ?? 'mock', model: draft.model, note: draft.note }
}

export interface ArticleDraft { title: string; body: string; source: 'ai' | 'mock'; model?: string; note?: string }

export function templateArticle(agent: Agent, topic: string): { title: string; body: string } {
  const t = topic.trim().replace(/[?.!]+$/, '') || 'Getting a home loan'
  return {
    title: t.length > 80 ? `${t.slice(0, 77).trim()}…` : t,
    body: `${t} is a common question for home buyers in ${agent.city}. The right answer depends on your finances and goals, so the best first step is a short conversation to review your options.\n\nI am ${firstName(agent.name)}, a ${agent.title.toLowerCase()} with ${agent.yearsExperience}+ years of experience. I can walk you through the process step by step.`,
  }
}

/** Draft an AI-answerable article on a topic. The owner edits it and decides whether to save or publish it. */
export async function draftArticle(agent: Agent, topic: string, opts?: GenerateOptions & { focus?: string }): Promise<ArticleDraft> {
  const input: ArticleInput = { ...factsOf(agent), topic: topic.trim().slice(0, 240), ...(opts?.focus ? { focus: opts.focus.slice(0, 240) } : {}) }
  const template = templateArticle(agent, topic)
  const draft = await generateSkillDraft(
    {
      skillId: 'ai-article',
      model: AI_TASKS.article.allowedModel,
      instruction: 'Draft an AI-answerable article (server-side prompt).',
      mockDraft: { summary: 'Article', changes: [], payload: template },
      ai: { kind: 'article', input, apply: (text, d, fields) => ({ ...d, payload: { title: fields?.title ?? template.title, body: fields?.body ?? text } }) },
    },
    opts,
  )
  const art = draft.payload as { title: string; body: string }
  return { ...art, source: draft.source ?? 'mock', model: draft.model, note: draft.note }
}

export function templateFaq(agent: Agent, question: string): string {
  return `${question.trim().replace(/\?+$/, '')} depends on your situation. I would be glad to go through it with you, so please get in touch and we can look at your options together. — ${firstName(agent.name)}`
}

/** Draft the answer to an FAQ question. */
export async function draftFaqAnswer(agent: Agent, question: string, opts?: GenerateOptions): Promise<TextDraft> {
  const input: FaqInput = { ...factsOf(agent), question: question.trim().slice(0, 240) }
  const template = templateFaq(agent, question)
  const draft = await generateSkillDraft(
    {
      skillId: 'faq-answer',
      model: AI_TASKS.faq.allowedModel,
      instruction: 'Draft the FAQ answer (server-side prompt).',
      mockDraft: { summary: 'FAQ answer', changes: [], payload: { text: template } },
      ai: { kind: 'faq', input, apply: (text, d) => ({ ...d, payload: { text } }) },
    },
    opts,
  )
  return { text: (draft.payload as { text: string }).text, source: draft.source ?? 'mock', model: draft.model, note: draft.note }
}

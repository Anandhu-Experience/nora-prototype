import * as api from '../../mock/api'
import { readReviewFacts } from '../../mock/database'
import { AI_TASKS, type ReplyInput } from '../../profile/aiTasks'
import { templateReply } from '../../profile/aiDrafts'
import type { Review } from '../../profile/types'
import { defineSkill, type Draft, type Finding } from '../types'
import doc from './SKILL.md?raw'

interface ReviewRead { agentFirstName: string; agentTitle: string; unreplied: Review[] }
interface ReviewContext extends ReviewRead { review: Review }

const firstName = (name: string) => name.replace(/^agent\s+/i, '').trim().split(/\s+/)[0] || 'there'
const snippet = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

export const reviewsSkill = defineSkill<ReviewRead>({
  id: 'review-reply',
  name: 'Review Reply',
  description: 'Draft a public reply to a client review that has none, with the AI model.',
  domain: 'reviews',
  kind: 'action',
  priority: 85,
  allowedModel: AI_TASKS['review-reply'].allowedModel,
  requiresApproval: true,
  repeatable: true,
  approveCta: 'Post reply',
  editLimit: AI_TASKS['review-reply'].maxChars,
  whenToUse: ['One or more reviews have no public reply', 'The review text passes the input guardrails'],
  whenNotToUse: ['Every review already has a reply', 'The user declined the suggestion'],
  doc,

  evaluate(graph) {
    const { total, unreplied } = graph.reviews
    if (unreplied === 0) return { applies: false, reason: `All ${total} reviews have a reply`, relevance: 0 }
    return { applies: true, reason: `${unreplied} of ${total} reviews have no reply`, relevance: Math.min(100, Math.round((unreplied / Math.max(1, total)) * 100)) }
  },

  scoreChange() {
    const review = readReviewFacts().unreplied[0]
    return review ? { reply: [review.id] } : null
  },

  expectedOutcome(graph) {
    const n = graph.reviews.unreplied
    return n ? { label: 'Reviews without a reply', before: String(n), after: String(n - 1) } : null
  },

  proposal(graph) {
    const n = graph.reviews.unreplied
    return { message: `${n} of your reviews ${n === 1 ? 'has' : 'have'} no reply yet. Shall I draft one in your voice?`, cta: 'Draft a reply' }
  },

  read: () => api.getReviewsToReply(),

  validate(data) {
    const review = data.unreplied[0]
    const findings: Finding[] = review ? [{ id: review.id, label: `${review.author}, ${review.rating} stars`, detail: snippet(review.text) }] : []
    return { findings, context: review ? ({ ...data, review } satisfies ReviewContext) : data }
  },

  buildDraftRequest({ context }) {
    const { agentFirstName, agentTitle, review } = context as ReviewContext
    const input: ReplyInput = { agentFirstName, agentTitle, reviewerFirstName: firstName(review.author), rating: review.rating, reviewText: review.text.slice(0, 1000) }
    const template = templateReply(review)
    const changes: Draft['changes'] = [{ label: `Reply to ${review.author} (${review.rating} stars): “${snippet(review.text, 90)}”`, before: 'No reply yet', after: template }]
    return {
      skillId: 'review-reply',
      model: AI_TASKS['review-reply'].allowedModel,
      instruction: 'Draft a public reply to the review (server-side prompt).',
      mockDraft: { summary: `Reply to ${review.author}’s review`, changes, payload: { reviewId: review.id, text: template } },
      ai: {
        kind: 'review-reply',
        input,
        apply: (text, draft) => {
          draft.changes[0]!.after = text
          ;(draft.payload as { text: string }).text = text
          return draft
        },
      },
    }
  },

  editDraft(draft, text) {
    const next = structuredClone(draft)
    next.changes[0]!.after = text
    ;(next.payload as { text: string }).text = text
    return next
  },

  async write(draft) {
    const { reviewId, text } = draft.payload as { reviewId: string; text: string }
    await api.replyToReview(reviewId, text)
  },
})

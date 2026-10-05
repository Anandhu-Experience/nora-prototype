import type { AiTaskKind } from '../profile/aiTasks.ts'

/**
 * Guided NORA has no text box, so its "input" is which action was asked for. This is the allow-list: every skill or feature that may
 * ask for AI text, and the draft kinds each one is allowed to request. A tampered or unknown request is refused before any model call.
 * The NORA skill registry is checked against this list in a test, so adding a skill without listing it here fails.
 */
export const KNOWN_ACTIONS: Record<string, readonly AiTaskKind[]> = {
  'profile-completion': ['bio'],
  'listing-optimization': [],
  'web-analytics-insight': [],
  'voce-explore': [],
  'review-reply': ['review-reply'],
  'service-description': ['service'],
  'meta-description': ['meta'],
  'ai-article': ['article'],
  'faq-answer': ['faq'],
}

export type ActionCheck = { ok: true } | { ok: false; code: 'unknown_skill' | 'action_not_allowed'; message: string }

/** `skillId` is optional so older callers keep working; when it is given it must be known and allowed to request this kind. */
export function validateAction(skillId: unknown, kind: AiTaskKind): ActionCheck {
  if (skillId === undefined) return { ok: true }
  if (typeof skillId !== 'string' || !Object.prototype.hasOwnProperty.call(KNOWN_ACTIONS, skillId)) return { ok: false, code: 'unknown_skill', message: 'That action is not recognised.' }
  if (!KNOWN_ACTIONS[skillId]!.includes(kind)) return { ok: false, code: 'action_not_allowed', message: 'That action is not allowed to request this kind of draft.' }
  return { ok: true }
}

/** For template drafts that carry no AI task: only the skill id can be wrong. */
export function validateSkill(skillId: unknown): ActionCheck {
  if (typeof skillId !== 'string' || !Object.prototype.hasOwnProperty.call(KNOWN_ACTIONS, skillId)) return { ok: false, code: 'unknown_skill', message: 'That action is not recognised.' }
  return { ok: true }
}

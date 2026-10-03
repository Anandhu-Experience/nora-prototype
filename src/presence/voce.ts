import type { AiAnswer } from '../profile/assistant'
import { getState } from '../profile/store'
import { createStore, nowIso, uid, wait } from './persist'
import { srsNow } from './srs'
import { TODAY } from './insights'

export type PlanId = 'EXPLORE' | 'ENGAGE' | 'AMPLIFY'
export const PLANS: { id: PlanId; credits: number; price: string; blurb: string }[] = [
  { id: 'EXPLORE', credits: 50, price: 'Free', blurb: 'Try AI drafting. 10 drafts a month.' },
  { id: 'ENGAGE', credits: 200, price: 'Included with Pro', blurb: '40 drafts a month, scheduling and analytics.' },
  { id: 'AMPLIFY', credits: 600, price: '$49 / month', blurb: '120 drafts a month, priority AI answer checks.' },
]
export const DRAFT_COST = 5
export const TITLE_MAX = 90
export const BODY_MAX = 5000
export const MIN_PUBLISH_WORDS = 30

export type ArticleStatus = 'draft' | 'scheduled' | 'published'
export interface Article {
  id: string
  title: string
  body: string
  status: ArticleStatus
  /** 'ai' and 'mock' are drafted by NORA (real model or labelled template); 'manual' is typed by the agent. */
  origin: 'ai' | 'mock' | 'manual'
  topic: string
  updatedAt: string
  publishAt?: string
  publishedAt?: string
}
export interface Faq { id: string; question: string; answer: string; at: string }
export type EngineId = 'chatgpt' | 'perplexity' | 'gemini' | 'google' | 'copilot' | 'claude'
export interface PresenceCheck { mentioned: number; at: string }

export interface VoceState {
  /** Authority points from a complete profile (kept here: the formula below adds only content). */
  base: number
  plan: PlanId
  creditsUsed: number
  articles: Article[]
  faqs: Faq[]
  checks: Partial<Record<EngineId, PresenceCheck>>
}

export const voceStore = createStore<VoceState>('nora-presence-voce-v2', () => ({
  base: 3,
  plan: 'ENGAGE',
  creditsUsed: 0,
  articles: [
    { id: 'a-seed-1', title: 'First-time buyer checklist', body: 'Buying your first home is exciting, and a short checklist keeps it calm. Start by checking your credit report, then work out a monthly payment you are comfortable with. Gather payslips, bank statements and ID before you apply, and ask for a mortgage agreement in principle so sellers take your offer seriously.', status: 'draft', origin: 'manual', topic: 'First-time buyer checklist', updatedAt: '2026-09-24T11:00:00Z' },
  ],
  faqs: [],
  checks: {},
}))

/* ---------- authority score ---------- */
export const ARTICLE_POINTS = 10
export const ARTICLE_CAP = 70
export const FAQ_POINTS = 3
export const FAQ_CAP = 27

export const publishedCount = (s: VoceState): number => s.articles.filter((a) => a.status === 'published').length
export const answeredCount = (s: VoceState): number => s.faqs.filter((f) => f.answer.trim()).length
export const articlePoints = (s: VoceState): number => Math.min(ARTICLE_CAP, publishedCount(s) * ARTICLE_POINTS)
export const answerPoints = (s: VoceState): number => Math.min(FAQ_CAP, answeredCount(s) * FAQ_POINTS)
/**
 * AI Authority Score, 0 to 100: a small base (seeded at 3) + 10 per PUBLISHED article (cap 70) + 3 per ANSWERED FAQ (cap 27).
 * Drafts and scheduled articles earn nothing until they go live.
 */
export const authorityScore = (s: VoceState): number => Math.min(100, s.base + articlePoints(s) + answerPoints(s))
export const vocePoints = authorityScore
export const projectedScore = (s: VoceState, extraPublished: number): number =>
  Math.min(100, s.base + Math.min(ARTICLE_CAP, (publishedCount(s) + extraPublished) * ARTICLE_POINTS) + answerPoints(s))

/* ---------- credits & plan ---------- */
export const planOf = (s: VoceState) => PLANS.find((p) => p.id === s.plan)!
export const creditsAvailable = (s: VoceState): number => Math.max(0, planOf(s).credits - s.creditsUsed)
export const canDraft = (s: VoceState): boolean => creditsAvailable(s) >= DRAFT_COST
/** Spend the cost of one AI draft. Returns false (and spends nothing) when there are not enough credits. */
export function spendDraftCredits(): boolean {
  if (!canDraft(voceStore.get())) return false
  voceStore.set((s) => ({ ...s, creditsUsed: s.creditsUsed + DRAFT_COST }))
  return true
}
export const setPlan = (plan: PlanId): void => voceStore.set((s) => ({ ...s, plan }))

/* ---------- articles ---------- */
export const wordCount = (t: string): number => (t.trim() ? t.trim().split(/\s+/).length : 0)
export function validateArticle(title: string, body: string, forPublish: boolean): { title?: string; body?: string } {
  const e: { title?: string; body?: string } = {}
  if (!title.trim()) e.title = 'Add a title.'
  else if (title.length > TITLE_MAX) e.title = `Keep the title under ${TITLE_MAX} characters.`
  if (body.length > BODY_MAX) e.body = `Keep the article under ${BODY_MAX} characters.`
  else if (forPublish && wordCount(body) < MIN_PUBLISH_WORDS) e.body = `Write at least ${MIN_PUBLISH_WORDS} words before publishing (now ${wordCount(body)}).`
  return e
}
export const scheduleError = (date: string): string | null => (!/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Pick a date.' : date <= TODAY ? 'Pick a future date.' : null)

type Input = { id?: string; title: string; body: string; topic?: string; origin?: Article['origin'] }
/** Create or update an article, keeping its status (new ones are drafts). Returns its id. */
export function saveArticle(input: Input): string {
  const id = input.id ?? uid('a')
  voceStore.set((s) => {
    const prev = s.articles.find((a) => a.id === id)
    const next: Article = { id, title: input.title.trim(), body: input.body.trim(), topic: input.topic ?? prev?.topic ?? input.title.trim(), origin: input.origin ?? prev?.origin ?? 'manual', status: prev?.status ?? 'draft', updatedAt: nowIso(), publishAt: prev?.publishAt, publishedAt: prev?.publishedAt }
    return { ...s, articles: prev ? s.articles.map((a) => (a.id === id ? next : a)) : [next, ...s.articles] }
  })
  return id
}
const setStatus = (id: string, patch: Partial<Article>) => voceStore.set((s) => ({ ...s, articles: s.articles.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: nowIso() } : a)) }))
export const scheduleArticle = (id: string, date: string): string | null => {
  const err = scheduleError(date)
  if (!err) setStatus(id, { status: 'scheduled', publishAt: date })
  return err
}
/** Publishing is async (mock latency) and only ever runs from an explicit click. */
export async function publishArticle(id: string): Promise<void> {
  await wait()
  setStatus(id, { status: 'published', publishedAt: nowIso(), publishAt: undefined })
}
export const unpublishArticle = (id: string): void => setStatus(id, { status: 'draft', publishedAt: undefined, publishAt: undefined })
export const deleteArticle = (id: string): void => voceStore.set((s) => ({ ...s, articles: s.articles.filter((a) => a.id !== id) }))

/* ---------- FAQs ---------- */
export const SUGGESTED_FAQS = ['How much can I borrow?', 'What is an FHA loan?', 'How much deposit do I need?', 'What documents do I need for a mortgage?']
export function saveFaq(question: string, answer: string, id?: string): string | null {
  if (question.trim().length < 5) return 'Write the question clients ask.'
  if (answer.trim().length < 20) return 'Write an answer of at least 20 characters.'
  voceStore.set((s) => {
    const f: Faq = { id: id ?? uid('f'), question: question.trim(), answer: answer.trim(), at: nowIso() }
    return { ...s, faqs: id && s.faqs.some((x) => x.id === id) ? s.faqs.map((x) => (x.id === id ? f : x)) : [f, ...s.faqs] }
  })
  return null
}
export const deleteFaq = (id: string): void => voceStore.set((s) => ({ ...s, faqs: s.faqs.filter((f) => f.id !== id) }))

export const GENERAL_FAQS: { q: string; a: string }[] = [
  { q: 'What is VOCE?', a: 'VOCE is the AI writing and visibility assistant inside Experience.com. It helps you write helpful articles and answers that AI assistants (ChatGPT, Perplexity, Gemini, Google AI) can quote when a home buyer asks a question, and it tracks how visible you are.' },
  { q: 'How does VOCE work with Experience.com?', a: 'Your profile, reviews and specialties feed the drafts, so the writing sounds like you and states only facts you already publish. Published articles and answers are linked to your profile and listings, which helps assistants connect them to you.' },
  { q: 'Can I use VOCE for free?', a: 'Yes. The Explore plan is free and includes 50 credits a month. Pro members get Engage with 200 credits a month. Each AI draft costs 5 credits; saving and publishing are free.' },
  { q: 'What is my AI Authority Score?', a: 'A 0 to 100 measure of how much helpful, published content you have for AI assistants to draw on. It counts published articles (10 points each, up to 70) and answered FAQs (3 points each, up to 27), plus a small base for your profile.' },
  { q: 'How can I improve my AI Authority Score?', a: 'Publish articles on the questions your clients ask, answer your FAQs in your own words, and keep your profile, reviews and listings complete. Drafts and scheduled articles only count once they are published.' },
]

/* ---------- content analytics (derived from published articles) ---------- */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}
const SOURCES = ['ChatGPT', 'Perplexity', 'Google AI', 'Gemini']
export function contentAnalytics(s: VoceState): { views: number; engaged: number; shares: number; topSource: string } {
  const pub = s.articles.filter((a) => a.status === 'published')
  const views = pub.reduce((n, a) => n + 36 + Math.round(hash(a.title) * 90), 0)
  const bySource = new Map<string, number>()
  pub.forEach((a) => { const src = SOURCES[Math.floor(hash(`${a.title}:src`) * SOURCES.length)]!; bySource.set(src, (bySource.get(src) ?? 0) + 1) })
  const top = [...bySource.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
  return { views, engaged: Math.round(views * 0.42), shares: Math.round(views * 0.06), topSource: top ? top[0] : '-' }
}

/* ---------- AI answer presence (simulated) ---------- */
export const ENGINES: { id: EngineId; name: string; letter: string; weight: number }[] = [
  { id: 'chatgpt', name: 'ChatGPT', letter: 'C', weight: 1 },
  { id: 'perplexity', name: 'Perplexity', letter: 'P', weight: 1.15 },
  { id: 'gemini', name: 'Gemini', letter: 'G', weight: 0.9 },
  { id: 'google', name: 'Google AI', letter: 'G', weight: 1.05 },
  { id: 'copilot', name: 'Copilot', letter: 'M', weight: 0.8 },
  { id: 'claude', name: 'Claude', letter: 'A', weight: 0.95 },
]
const TEST_PROMPTS = ['best mortgage loan officer in Birmingham', 'who can help a first-time buyer get an FHA loan', 'how much can I borrow for a house', 'trusted mortgage advisor near me', 'first-time buyer checklist mortgage', 'loan officer with strong reviews in Birmingham']
/** Mocked: mentions out of 10 test prompts, rising with the authority score and published articles. */
export function presenceFor(id: EngineId, authority: number, published: number): number {
  const w = ENGINES.find((e) => e.id === id)!.weight
  return Math.max(0, Math.min(10, Math.floor((authority / 14 + published * 0.5) * w)))
}
export const sentimentOf = (mentioned: number): { label: 'Not mentioned' | 'Neutral' | 'Positive'; tone: 'slate' | 'amber' | 'green' } =>
  mentioned === 0 ? { label: 'Not mentioned', tone: 'slate' } : mentioned < 4 ? { label: 'Neutral', tone: 'amber' } : { label: 'Positive', tone: 'green' }
export const mentionPrompt = (id: EngineId): string => TEST_PROMPTS[Math.floor(hash(`prompt:${id}`) * TEST_PROMPTS.length)]!
export function presenceNow(s: VoceState, id: EngineId): number {
  return s.checks[id]?.mentioned ?? presenceFor(id, 3, 0)
}
export async function runPresenceCheck(id: EngineId): Promise<number> {
  await wait()
  const s = voceStore.get()
  const mentioned = presenceFor(id, authorityScore(s), publishedCount(s))
  voceStore.set((x) => ({ ...x, checks: { ...x.checks, [id]: { mentioned, at: nowIso() } } }))
  return mentioned
}
export function whyNotMentioned(s: VoceState, topSpecialty: string): string {
  const pub = publishedCount(s)
  if (pub === 0) return `You have no published articles, so assistants have nothing of yours to quote. Publish one on "${topSpecialty}" first.`
  if (answeredCount(s) < 2) return 'Assistants favour direct question-and-answer content. Answer two more FAQs in your own words.'
  return 'Keep going: publish one more article each week and keep your reviews and listings up to date.'
}

/* ---------- NORA ---------- */
export type VoceAction = { kind: 'write'; topic: string } | { kind: 'faq'; question: string } | { kind: 'edit'; id: string }
export interface VoceSuggestion { id: string; title: string; detail: string; cta: string; impact?: string; action: VoceAction }
export function voceSuggestions(s: VoceState, topSpecialty: string): VoceSuggestion[] {
  const out: VoceSuggestion[] = []
  const draft = s.articles.find((a) => a.status === 'draft')
  if (draft) out.push({ id: 'publish-draft', title: 'Publish your draft', detail: `"${draft.title}" is ready to review. Publishing it takes you to ${projectedScore(s, 1)}/100.`, cta: 'Open draft', impact: `+${ARTICLE_POINTS} pts`, action: { kind: 'edit', id: draft.id } })
  if (publishedCount(s) < 3) out.push({ id: 'write-specialty', title: `Write about ${topSpecialty}`, detail: 'Your top specialty is what clients ask AI assistants about. NORA drafts it, you approve it.', cta: 'Open studio', impact: `+${ARTICLE_POINTS} pts`, action: { kind: 'write', topic: `What to know about ${topSpecialty}` } })
  const q = SUGGESTED_FAQS.find((x) => !s.faqs.some((f) => f.question.toLowerCase() === x.toLowerCase()))
  if (q) out.push({ id: 'answer-faq', title: `Answer "${q}"`, detail: 'Direct answers are the content AI assistants quote most.', cta: 'Draft answer', impact: `+${FAQ_POINTS} pts`, action: { kind: 'faq', question: q } })
  return out
}

export function voceAnswer(): AiAnswer {
  const s = voceStore.get()
  const state = getState()
  const me = state.agents[state.viewerId]!
  const score = authorityScore(s)
  const srs = srsNow(me).total
  const drafts = s.articles.filter((a) => a.status === 'draft').length
  const sched = s.articles.filter((a) => a.status === 'scheduled').length
  const n = ENGINES.filter((e) => presenceNow(s, e.id) > 0).length
  return {
    intro: `Your AI Authority Score is ${score}/100. Publishing 3 articles would take it to about ${projectedScore(s, 3)}.`,
    items: [
      { title: 'Articles', detail: `${publishedCount(s)} published, ${sched} scheduled, ${drafts} draft${drafts === 1 ? '' : 's'}. Only published articles score.` },
      { title: 'Answers', detail: `${answeredCount(s)} FAQs answered (${answerPoints(s)} of ${FAQ_CAP} points).` },
      { title: 'Credits', detail: `${creditsAvailable(s)} of ${planOf(s).credits} credits left on ${s.plan}. Each AI draft costs ${DRAFT_COST}; publishing is free.` },
      { title: 'AI answer presence (simulated)', detail: `Mentioned by ${n} of ${ENGINES.length} assistants in the last demo check. Your Search Rank Score is ${srs}/850.` },
    ],
    links: [{ label: 'Open AI Visibility', to: '/ai-visibility' }, { label: 'Search Rank Score', to: '/search-rank' }],
  }
}

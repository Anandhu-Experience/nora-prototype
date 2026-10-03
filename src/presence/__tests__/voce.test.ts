import { beforeEach, describe, expect, it } from 'vitest'
import { setLatency } from '../persist'
import { DRAFT_COST, answeredCount, authorityScore, canDraft, contentAnalytics, creditsAvailable, deleteArticle, presenceFor, projectedScore, publishArticle, publishedCount, runPresenceCheck, saveArticle, saveFaq, scheduleArticle, setPlan, spendDraftCredits, unpublishArticle, validateArticle, voceAnswer, voceStore, voceSuggestions } from '../voce'

beforeEach(() => { setLatency(0); voceStore.reset() })
const body = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ')

describe('authority score', () => {
  it('seeds at 3 with one draft and the ENGAGE plan', () => {
    const s = voceStore.get()
    expect(authorityScore(s)).toBe(3)
    expect(publishedCount(s)).toBe(0)
    expect(s.articles.filter((a) => a.status === 'draft')).toHaveLength(1)
    expect(s.plan).toBe('ENGAGE')
    expect(creditsAvailable(s)).toBe(200)
  })
  it('counts only published articles and answered FAQs, with caps', async () => {
    const id = saveArticle({ title: 'T', body })
    expect(authorityScore(voceStore.get())).toBe(3)
    scheduleArticle(id, '2026-11-01')
    expect(authorityScore(voceStore.get())).toBe(3)
    await publishArticle(id)
    expect(authorityScore(voceStore.get())).toBe(13)
    unpublishArticle(id)
    expect(authorityScore(voceStore.get())).toBe(3)
    for (let i = 0; i < 12; i++) { const a = saveArticle({ title: `T${i}`, body }); await publishArticle(a) }
    expect(authorityScore(voceStore.get())).toBe(73)
    for (let i = 0; i < 20; i++) saveFaq(`Question number ${i}?`, 'A proper answer that is long enough.')
    expect(answeredCount(voceStore.get())).toBe(20)
    expect(authorityScore(voceStore.get())).toBe(100)
  })
  it('projects the effect of publishing', () => {
    expect(projectedScore(voceStore.get(), 3)).toBe(33)
    expect(projectedScore(voceStore.get(), 50)).toBe(73)
  })
})

describe('articles', () => {
  it('schedule needs a future date; delete removes', () => {
    const id = saveArticle({ title: 'T', body })
    expect(scheduleArticle(id, '2026-10-02')).toMatch(/future/)
    expect(scheduleArticle(id, '2026-10-20')).toBeNull()
    expect(voceStore.get().articles.find((a) => a.id === id)!.status).toBe('scheduled')
    deleteArticle(id)
    expect(voceStore.get().articles.find((a) => a.id === id)).toBeUndefined()
  })
  it('validates title and body limits', () => {
    expect(validateArticle('', body, false).title).toBeTruthy()
    expect(validateArticle('x'.repeat(91), body, false).title).toBeTruthy()
    expect(validateArticle('T', 'too short', true).body).toBeTruthy()
    expect(validateArticle('T', 'too short', false)).toEqual({})
    expect(validateArticle('T', body, true)).toEqual({})
  })
})

describe('credits and plan', () => {
  it('each AI draft spends 5 credits and stops at zero', () => {
    expect(spendDraftCredits()).toBe(true)
    expect(creditsAvailable(voceStore.get())).toBe(200 - DRAFT_COST)
    voceStore.set((s) => ({ ...s, creditsUsed: 198 }))
    expect(canDraft(voceStore.get())).toBe(false)
    expect(spendDraftCredits()).toBe(false)
    setPlan('AMPLIFY')
    expect(creditsAvailable(voceStore.get())).toBe(600 - 198)
  })
})

describe('analytics, presence, NORA', () => {
  it('content analytics derive from published articles', async () => {
    expect(contentAnalytics(voceStore.get())).toEqual({ views: 0, engaged: 0, shares: 0, topSource: '-' })
    await publishArticle(saveArticle({ title: 'FHA loans', body }))
    const a = contentAnalytics(voceStore.get())
    expect(a.views).toBeGreaterThan(0)
    expect(a).toEqual(contentAnalytics(voceStore.get()))
  })
  it('simulated presence rises with score and articles, and a check stores it', async () => {
    expect(presenceFor('chatgpt', 80, 5)).toBeGreaterThan(presenceFor('chatgpt', 3, 0))
    await publishArticle(saveArticle({ title: 'A', body }))
    const n = await runPresenceCheck('perplexity')
    expect(voceStore.get().checks.perplexity!.mentioned).toBe(n)
  })
  it('suggestions disappear when resolved and the answer uses live data', () => {
    const ids = voceSuggestions(voceStore.get(), 'FHA loans').map((s) => s.id)
    expect(ids).toEqual(['publish-draft', 'write-specialty', 'answer-faq'])
    saveFaq('How much can I borrow?', 'It depends on your income and debts, so let us run the numbers.')
    expect(voceSuggestions(voceStore.get(), 'FHA loans').find((s) => s.id === 'answer-faq')!.title).not.toContain('How much can I borrow')
    expect(voceAnswer().intro).toContain('/100')
  })
})

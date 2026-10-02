import { beforeEach, describe, expect, it, vi } from 'vitest'
import { answer, draftMessage } from '../assistant'
import { isTopRated, ratingStats, satisfaction, similarAgents, insightsFor, vcard } from '../selectors'
import { actions, getState } from '../store'

beforeEach(() => {
  vi.useFakeTimers()
  actions.reset()
})

const arj = () => getState().agents.arjunan!

describe('ratings', () => {
  it('computes average, distribution and top-rated from reviews', () => {
    const s = ratingStats(arj().reviews)
    expect(s.count).toBe(3)
    expect(s.avg).toBeCloseTo(4.67, 2)
    expect(s.dist.map((d) => d.pct)).toEqual([67, 33, 0, 0, 0])
    expect(isTopRated(arj())).toBe(true)
    expect(satisfaction(arj())).toBe(93)
  })

  it('addReview updates stats, activity and notifies the owner', () => {
    actions.addReview('arjunan', { author: 'Kim', rating: 1, text: 'Not great at all.' })
    expect(arj().reviews).toHaveLength(4)
    expect(ratingStats(arj().reviews).avg).toBeCloseTo(3.75, 2)
    expect(isTopRated(arj())).toBe(false)
    expect(arj().activity[0]!.text).toContain('1-star')
    expect(getState().notifications[0]!.text).toContain('Kim')
  })

  it('does not notify the viewer about reviews on other agents', () => {
    const before = getState().notifications.length
    actions.addReview('sofia-marin', { author: 'Kim', rating: 5, text: 'Great.' })
    expect(getState().notifications).toHaveLength(before)
  })
})

describe('profile edits', () => {
  it('saveProfile persists changes and logs activity', () => {
    actions.saveProfile('arjunan', { ...arj(), title: 'Senior Loan Officer', yearsExperience: 9 })
    expect(arj().title).toBe('Senior Loan Officer')
    expect(arj().activity[0]!.type).toBe('profile')
  })
  it('replyToReview attaches the reply', () => {
    actions.replyToReview('arjunan', 'r1', 'Thanks John!')
    expect(arj().reviews.find((r) => r.id === 'r1')!.reply).toBe('Thanks John!')
  })
})

describe('messaging', () => {
  it('sendReferral appends to the thread and the agent auto-replies', () => {
    actions.sendReferral('priya-nair', 'Can you take a referral?')
    let t = getState().threads.find((x) => x.withAgentId === 'priya-nair')!
    expect(t.messages.at(-1)!.text).toBe('Can you take a referral?')
    vi.advanceTimersByTime(5000)
    t = getState().threads.find((x) => x.withAgentId === 'priya-nair')!
    expect(t.messages.at(-1)!.from).toBe('them')
    expect(t.unread).toBe(true)
    expect(getState().notifications[0]!.text).toContain('Priya Nair')
  })
  it('creates a thread for a new recipient and moves it to the top', () => {
    actions.sendReferral('marcus-lee', 'Hello')
    expect(getState().threads[0]!.withAgentId).toBe('marcus-lee')
  })
  it('markThreadRead / markAllNotificationsRead', () => {
    actions.markThreadRead('t-sofia')
    expect(getState().threads.find((t) => t.id === 't-sofia')!.unread).toBe(false)
    actions.markAllNotificationsRead()
    expect(getState().notifications.every((n) => n.read)).toBe(true)
  })
})

describe('assistant', () => {
  it('answers from the agent’s real data', () => {
    const a = answer(arj(), getState(), 'Summarize this agent’s reviews')
    expect(a.intro).toContain('4.67')
    const strengths = answer(arj(), getState(), 'What are their key strengths?')
    expect(strengths.items!.map((i) => i.title)).toContain('Quick Response Time')
    expect(answer(arj(), getState(), 'what services do they offer').items).toHaveLength(3)
    expect(answer(arj(), getState(), 'asdf').text).toContain('reviews')
  })
  it('comparison questions are answered from other agents’ data', () => {
    const a = answer(arj(), getState(), 'how do they compare')
    expect(a.items!.length).toBe(2)
  })
  it('drafts differ by tone and variant', () => {
    const f = draftMessage(arj(), { purpose: 'referral', tone: 'friendly' })
    const p = draftMessage(arj(), { purpose: 'referral', tone: 'professional' })
    expect(f).toContain('Hi Arjunan')
    expect(p).toContain('Dear Arjunan')
    expect(draftMessage(arj(), { purpose: 'referral', tone: 'friendly', variant: 1 })).not.toBe(f)
  })
})

describe('selectors', () => {
  it('similar agents prefer the same city, never include self', () => {
    const sim = similarAgents(getState(), arj())
    expect(sim.some((a) => a.id === 'arjunan')).toBe(false)
    expect(sim[0]!.city).toBe('Birmingham')
  })
  it('insights and vcard are derived from data', () => {
    expect(insightsFor(arj()).map((i) => i.text)).toContain('Typically responds within 1 hour')
    expect(vcard(arj())).toContain('FN:Agent Arjunan')
  })
})

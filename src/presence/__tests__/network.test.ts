import { beforeEach, describe, expect, it } from 'vitest'
import { seedState } from '../../profile/seed'
import type { Thread } from '../../profile/types'
import {
  MAX_PROMOTED, folderThreads, followUp, networkAnswer, networkPoints, networkStore, partnerOf, promote, promotedPartners, referralCounts,
  referralRows, regeneratePromoCode, removePromoted, respondToRequest, savePotential, setReferralStatus, sortRows, staleReceived, threadReferrals, toggleArchive, toggleStar,
} from '../network'
import { setLatency } from '../persist'

const seed = seedState()
const agents = seed.agents
beforeEach(() => { setLatency(0); networkStore.reset() })

const fill = () => { for (let i = promotedPartners().length; i < MAX_PROMOTED; i++) promote({ id: `x${i}`, name: `X${i}`, title: 't', city: 'c' }) }

describe('partners', () => {
  it('seeds two promoted and one potential partner', () => {
    expect(promotedPartners().map((p) => p.id)).toEqual(['priya-nair', 'marcus-lee'])
    expect(networkStore.get().potential).toHaveLength(1)
  })
  it('promotes up to 8 then reports full, moving potential partners up', () => {
    expect(promote(partnerOf(agents['daniel-okafor']!))).toBe('ok')
    expect(networkStore.get().potential).toHaveLength(0)
    expect(promote(partnerOf(agents['daniel-okafor']!))).toBe('already')
    fill()
    expect(promotedPartners()).toHaveLength(MAX_PROMOTED)
    expect(promote({ id: 'extra', name: 'E', title: '', city: '' })).toBe('full')
  })
  it('saves once and not when already promoted; removes', () => {
    expect(savePotential(partnerOf(agents['sofia-marin']!))).toBe(true)
    expect(savePotential(partnerOf(agents['sofia-marin']!))).toBe(false)
    expect(savePotential(partnerOf(agents['priya-nair']!))).toBe(false)
    removePromoted('priya-nair')
    expect(promotedPartners().map((p) => p.id)).toEqual(['marcus-lee'])
  })
  it('accepting a request promotes the requester when there is room, else keeps it pending', () => {
    expect(respondToRequest('pr-1', true)).toBe('accepted')
    expect(promotedPartners().some((p) => p.id === 'pr-1')).toBe(true)
    fill()
    expect(respondToRequest('pr-2', true)).toBe('full')
    expect(networkStore.get().requests.find((r) => r.id === 'pr-2')!.status).toBe('pending')
    expect(respondToRequest('pr-2', false)).toBe('declined')
    expect(respondToRequest('nope', true)).toBe('missing')
  })
  it('regenerates the promo code', () => {
    const c = regeneratePromoCode(() => 0)
    expect(c).toBe('ARJ-AAAA-10OFF')
    expect(networkStore.get().promoCode).toBe(c)
  })
  it('scores by promoted partners', () => {
    expect(networkPoints(networkStore.get())).toBe(28)
  })
})

describe('referrals', () => {
  const rows = () => referralRows(networkStore.get(), seed.threads, agents)
  it('seeds received, requested and given, and derives thread referrals', () => {
    expect(referralCounts(rows())).toEqual({ received: 6, requested: 3, given: 2 })
    const t = threadReferrals(seed.threads, agents)
    expect(t.map((r) => [r.name, r.kind])).toEqual([['Priya Nair', 'requested']])
  })
  it('a reply to a thread started by them counts as given; new threads count as requested', () => {
    const threads: Thread[] = [
      { id: 't1', withName: 'Sofia Marin', withAgentId: 'sofia-marin', unread: false, messages: [{ id: 'a', from: 'them', at: '2026-09-01T00:00:00Z', text: 'hi' }, { id: 'b', from: 'me', at: '2026-09-02T00:00:00Z', text: 'yes' }] },
      { id: 't2', withName: 'Daniel Okafor', withAgentId: 'daniel-okafor', unread: false, messages: [{ id: 'c', from: 'me', at: '2026-09-03T00:00:00Z', text: 'hello' }, { id: 'd', from: 'me', at: '2026-09-04T00:00:00Z', text: 'ping' }] },
    ]
    const r = referralRows(networkStore.get(), threads, agents)
    expect(r.find((x) => x.id === 'thread-t1')!.kind).toBe('given')
    const t2 = r.find((x) => x.id === 'thread-t2')!
    expect([t2.kind, t2.attempts, t2.lastFollowUp]).toEqual(['requested', 1, '2026-09-04T00:00:00Z'])
    expect(referralCounts(r).requested).toBe(3)
  })
  it('follow-up increments attempts and stamps the date; convert and archive change status', () => {
    followUp('rc-1', 0, '2026-10-02T00:00:00Z')
    followUp('rc-1', 1, '2026-10-03T00:00:00Z')
    const r = rows().find((x) => x.id === 'rc-1')!
    expect([r.attempts, r.lastFollowUp]).toEqual([2, '2026-10-03T00:00:00Z'])
    setReferralStatus(['rc-1', 'rc-2'], 'archived')
    expect(referralCounts(rows()).received).toBe(4)
    setReferralStatus(['rc-3'], 'converted')
    expect(rows().find((x) => x.id === 'rc-3')!.status).toBe('converted')
  })
  it('finds received referrals not followed up in 7 days', () => {
    const now = Date.parse('2026-10-02T12:00:00Z')
    expect(staleReceived(rows(), now).map((r) => r.id).sort()).toEqual(['rc-1', 'rc-2', 'rc-3'])
    followUp('rc-1', 0, '2026-10-01T00:00:00Z')
    expect(staleReceived(rows(), now).map((r) => r.id)).not.toContain('rc-1')
  })
  it('sorts rows', () => {
    const r = rows().filter((x) => x.kind === 'received')
    expect(sortRows(r, 'name', 1)[0]!.name).toBe('Abigail Charles')
    expect(sortRows(r, 'at', -1)[0]!.id).toBe('rc-5')
    expect(sortRows(r, 'attempts', -1)[0]!.attempts).toBe(2)
  })
})

describe('messages folders', () => {
  it('filters inbox, starred, archived and searches name, email and phone', () => {
    const f = (folder: 'inbox' | 'starred' | 'archived', q = '') => folderThreads(networkStore.get(), seed.threads, agents, folder, q).map((t) => t.id)
    expect(f('inbox')).toEqual(['t-sofia', 't-priya'])
    expect(f('starred')).toEqual(['t-sofia'])
    toggleArchive('t-sofia')
    expect(f('inbox')).toEqual(['t-priya'])
    expect(f('archived')).toEqual(['t-sofia'])
    expect(f('starred')).toEqual([])
    toggleStar('t-priya')
    expect(f('starred')).toEqual(['t-priya'])
    expect(f('inbox', 'northernhome')).toEqual(['t-priya'])
    expect(f('inbox', '161 555')).toEqual(['t-priya'])
    expect(f('inbox', 'zzz')).toEqual([])
  })
})

describe('networkAnswer', () => {
  it('summarises live data with links', () => {
    const a = networkAnswer()
    expect(a.intro).toContain('2 of 8')
    expect(a.items!.some((i) => i.detail.includes('ARJ-NAF-10OFF'))).toBe(true)
    expect(a.links![0]!.to).toBe('/network?tab=partners')
  })
})

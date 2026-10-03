import { beforeEach, describe, expect, it } from 'vitest'
import { setLatency } from '../persist'
import { actions, getState } from '../../profile/store'
import { nextActions } from '../../profile/ui/srs/nextActions'
import { peerBreakdown, scoreHistory, whyAhead } from '../../profile/ui/srs/peers'
import { DRIVER_MAX, PEERS } from '../srs'
import { websiteStore } from '../website'

beforeEach(() => {
  setLatency(0)
  actions.reset()
  websiteStore.reset()
})

describe('nextActions', () => {
  it('ranks actions by points per effort and includes the website fixes', () => {
    const list = nextActions(getState().agents.arjunan!)
    expect(list.length).toBeGreaterThan(0)
    const ratio = (a: { points: number; effort: number }) => a.points / a.effort
    for (let i = 1; i < list.length; i++) expect(ratio(list[i - 1]!)).toBeGreaterThanOrEqual(ratio(list[i]!))
    const meta = list.find((a) => a.id === 'site-tag-description')!
    expect(meta.points).toBe(24)
    expect(meta.to).toBe('/analytics')
    expect(list.every((a) => a.points > 0 && a.effort >= 1)).toBe(true)
  })

  it('drops the website action once it is fixed', () => {
    websiteStore.set((s) => ({ ...s, tagValues: { description: 'x' }, scan: { ...s.scan!, tags: { ...s.scan!.tags, description: { ok: true, value: 'x' } } } }))
    expect(nextActions(getState().agents.arjunan!).some((a) => a.id === 'site-tag-description')).toBe(false)
  })
})

describe('peers', () => {
  it('breakdown sums to the score within driver maximums', () => {
    for (const p of PEERS) {
      const b = peerBreakdown(p.id, p.score)
      expect(Object.values(b).reduce((a, c) => a + c, 0)).toBe(p.score)
      for (const [k, v] of Object.entries(b)) expect(v).toBeLessThanOrEqual(DRIVER_MAX[k as keyof typeof DRIVER_MAX])
    }
  })

  it('explains where a higher peer is ahead', () => {
    const mine = { profile: 50, website: 100, reviews: 100, listings: 10, connections: 10 }
    const why = whyAhead(PEERS[0]!, mine)
    expect(why.length).toBeGreaterThan(0)
    expect(why.every((w) => w.diff > 0)).toBe(true)
  })

  it('history ends at the current score', () => {
    const h = scoreHistory(321)
    expect(h).toHaveLength(12)
    expect(h[11]).toBe(321)
  })
})

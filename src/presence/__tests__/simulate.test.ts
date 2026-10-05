import { beforeEach, describe, expect, it } from 'vitest'
import { actions, getState } from '../../profile/store'
import { connect, connectionsStore } from '../connections'
import { resetPresence, setLatency } from '../persist'
import { BANDS, REPLY_POINTS, bandOf, reviewsPoints, simulate, srsNow } from '../srs'

const me = () => getState().agents[getState().viewerId]!
beforeEach(() => { setLatency(0); actions.reset(); resetPresence() })

describe('score bands', () => {
  it('uses the V2 bands', () => {
    expect(BANDS.map((b) => [b.label, b.min, b.max])).toEqual([['Poor', 0, 349], ['Fair', 350, 499], ['Good', 500, 649], ['Excellent', 650, 850]])
    expect([0, 349, 350, 499, 500, 649, 650, 850].map((n) => bandOf(n).label)).toEqual(['Poor', 'Poor', 'Fair', 'Fair', 'Good', 'Good', 'Excellent', 'Excellent'])
  })
})

describe('reply points', () => {
  it('each public reply adds a point, inside the reviews cap', () => {
    const a = me()
    const base = reviewsPoints({ ...a, reviews: a.reviews.map((r) => ({ ...r, reply: '' })) })
    expect(reviewsPoints({ ...a, reviews: a.reviews.map((r, i) => ({ ...r, reply: i < 2 ? 'x' : '' })) })).toBe(base + 2 * REPLY_POINTS)
    expect(reviewsPoints({ ...a, reviews: [...Array(40)].map((_, i) => ({ ...a.reviews[0]!, id: `r${i}`, rating: 5, reply: 'x' })) })).toBeLessThanOrEqual(300)
  })
})

describe('simulate: what a change is worth, without making it', () => {
  it('prices connecting Google at its 30 points and shows the rank effect', () => {
    const before = srsNow(me()).total
    const sim = simulate(me(), { connect: ['google'] })
    expect(sim.before.total).toBe(before)
    expect(sim.delta).toBe(30)
    expect(sim.lines).toEqual([{ id: 'connections', label: 'Connections', before: 25, after: 55 }])
    expect(sim.rankAfter).toBeLessThanOrEqual(sim.rankBefore)
    expect(connectionsStore.get().conns.google.connected).toBe(false) // nothing was written
    expect(srsNow(me()).total).toBe(before)
  })

  it('prices a reply on one review at the reply point, and the profile patch at the completeness it adds', () => {
    const open = me().reviews.find((r) => !r.reply?.trim())!
    expect(simulate(me(), { reply: [open.id] }).delta).toBe(REPLY_POINTS)
    const thin = simulate(me(), { profile: { specialties: ['a', 'b', 'c', 'd', 'e'] } })
    expect(thin.delta).toBeGreaterThan(0)
    expect(simulate(me(), {}).delta).toBe(0)
  })

  it('matches what really happens when the change is made', async () => {
    const sim = simulate(me(), { connect: ['google'] })
    await connect('google')
    expect(srsNow(me()).total - sim.before.total).toBe(sim.delta)
    const open = me().reviews.find((r) => !r.reply?.trim())!
    const sim2 = simulate(me(), { reply: [open.id] })
    const t0 = srsNow(me()).total
    actions.replyToReview(me().id, open.id, 'Thanks!')
    expect(srsNow(me()).total - t0).toBe(sim2.delta)
  })
})

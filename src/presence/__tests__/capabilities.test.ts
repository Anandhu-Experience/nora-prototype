import { beforeEach, describe, expect, it } from 'vitest'
import { actions, getState } from '../../profile/store'
import { capabilityState } from '../capabilities'
import { connect, connectionsStore } from '../connections'
import { applyFix, listingsStore, proposeFix, saveInfo } from '../listings'
import { napConflicts } from '../nap'
import { collectIssues } from '../noraOs'
import { resetPresence, setLatency } from '../persist'
import { explainSrs, simulate, srsNow } from '../srs'

const me = () => getState().agents[getState().viewerId]!
beforeEach(() => { setLatency(0); actions.reset(); resetPresence() })

describe('every issue belongs to a capability and carries its worth', () => {
  it('tags each issue with one of the five capability areas', () => {
    const issues = collectIssues(me())
    expect(issues.length).toBeGreaterThan(5)
    for (const i of issues) expect(['identity', 'local', 'reputation', 'discoverability', 'content']).toContain(i.capability)
    expect(new Set(issues.map((i) => i.capability)).size).toBeGreaterThanOrEqual(4)
  })

  it('prices fixes with the live score maths, not a separate estimate', () => {
    const a = me()
    const issues = collectIssues(a)
    const google = issues.find((i) => i.id === 'conn:google')!
    expect(google.points).toBe(simulate(a, { connect: ['google'] }).delta)
    expect(google.points).toBe(30)
    const reply = issues.find((i) => i.id.startsWith('review:'))!
    expect(reply.points).toBe(simulate(a, { reply: [reply.id.slice(7)] }).delta)
    const specialties = issues.find((i) => i.id === 'profile:specialties')!
    expect(specialties.points).toBeGreaterThan(0)
  })

  it('lists mismatches first, then the biggest worth, within a priority', () => {
    const issues = collectIssues(me())
    expect(issues[0]!.id).toBe('nap:listings:phone') // an inconsistency in your details outranks a points gain
    const high = issues.filter((i) => i.severity === 'high' && !i.id.startsWith('nap:'))
    for (let k = 1; k < high.length; k++) expect(high[k - 1]!.points ?? 0).toBeGreaterThanOrEqual(high[k]!.points ?? 0)
  })
})

describe('capability health: existing figures only', () => {
  it('has the five areas, with 0 to 100 bars taken from existing numbers', () => {
    const h = capabilityState(me())
    expect(h.map((x) => x.id)).toEqual(['identity', 'local', 'reputation', 'discoverability', 'content'])
    for (const x of h) { expect(x.pct).toBeGreaterThanOrEqual(0); expect(x.pct).toBeLessThanOrEqual(100) }
    expect(h[0]!.headline).toMatch(/^85% complete$/) // the same completeness the profile rules give
    expect(h[3]!.headline).toContain(`${srsNow(me()).total} of 850`)
  })

  it('status comes from the open issues, and clears when the last one is fixed', async () => {
    const before = capabilityState(me()).find((x) => x.id === 'local')!
    expect(before.status).toBe('critical')
    expect(before.top).not.toBeNull()
    await connect('google')
    expect(capabilityState(me()).find((x) => x.id === 'local')!.issues.some((i) => i.id === 'conn:google')).toBe(false)
  })

  it('reputation reports the unanswered reviews and the reply rate from the real reviews', () => {
    const r = capabilityState(me()).find((x) => x.id === 'reputation')!
    expect(r.detail).toMatch(/2 unanswered · reply rate 33%/)
    const a = me()
    actions.replyToReview(a.id, a.reviews.find((x) => !x.reply?.trim())!.id, 'Thanks!')
    expect(capabilityState(me()).find((x) => x.id === 'reputation')!.detail).toMatch(/1 unanswered · reply rate 67%/)
  })
})

describe('name, phone and hours must agree', () => {
  it('flags the seeded listing phone that differs from the profile, and clears it once corrected', () => {
    const c = napConflicts(me())
    expect(c.map((x) => x.id)).toContain('listings:phone')
    expect(collectIssues(me()).find((i) => i.id === 'nap:listings:phone')).toMatchObject({ severity: 'high', cta: 'Review Issue', to: '/listings?fix=phone' })
    applyFix(proposeFix('phone'))
    expect(napConflicts(me()).some((x) => x.id === 'listings:phone')).toBe(false)
  })

  it('ignores spacing and country-code formatting of the same number', () => {
    saveInfo({ ...listingsStore.get().info, phone: '0121 555 0142' })
    expect(napConflicts(me()).some((x) => x.id === 'listings:phone')).toBe(false)
  })

  it('a profile edit shows up as a mismatch without copying any data', () => {
    applyFix(proposeFix('phone'))
    expect(napConflicts(me()).length).toBe(0)
    actions.saveProfile(me().id, { ...me(), phone: '+44 20 7946 0000' })
    expect(napConflicts(me()).map((x) => x.id)).toContain('listings:phone')
    expect(listingsStore.get().info.phone).not.toBe('+44 20 7946 0000') // the listing still holds its own value until the user approves the fix
  })
})

describe('explain: why the score is what it is', () => {
  it('gives each driver what earned it and what is missing, adding up to the live score', () => {
    const lines = explainSrs(me())
    expect(lines.map((l) => l.id)).toEqual(['profile', 'website', 'reviews', 'listings', 'connections'])
    expect(lines.reduce((n, l) => n + l.points, 0)).toBe(srsNow(me()).total)
    const profile = lines[0]!
    expect(profile.missing.join(' ')).toContain('at least 5 specialties')
    expect(lines.find((l) => l.id === 'connections')!.missing.join(' ')).toContain('Google')
    expect(connectionsStore.get().conns.google.connected).toBe(false)
  })
})

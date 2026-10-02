import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../mock/database'
import { buildGraph } from '../mock/graph'
import * as api from '../mock/api'
import { SCENARIO_IDS } from '../mock/user'

beforeEach(() => {
  api.setApiLatency(0)
  resetDatabase('profile-needed')
})

describe('mock graph', () => {
  it('scenario A: profile needs bio + specialties at 70%', () => {
    const g = buildGraph()
    expect(g.profile.missing).toEqual(['bio', 'specialties'])
    expect(g.profile.completeness).toBe(70)
    expect(g.listings.incomplete).toBe(0)
    expect(g.analytics.trend).toBe('flat')
    expect(g.voce.hasProfile).toBe(false)
  })

  it('scenario B: nothing actionable', () => {
    resetDatabase('all-complete')
    const g = buildGraph()
    expect(g.profile).toEqual({ completeness: 100, missing: [] })
    expect(g.listings.incomplete).toBe(0)
    expect(g.connections.health).toBe('healthy')
    expect(g.analytics.trend).toBe('flat')
  })

  it('scenario C: VOCE profile exists', () => {
    resetDatabase('voce-exists')
    expect(buildGraph().voce).toMatchObject({ hasProfile: true, authorityScore: 78, articles: 12, questionsAnswered: 18 })
  })

  it('scenario D: several applicable signals', () => {
    resetDatabase('multi-action')
    const g = buildGraph()
    expect(g.profile.missing.length).toBe(2)
    expect(g.listings.incompleteIds).toEqual(['L3'])
    expect(g.analytics).toMatchObject({ trend: 'up', changePct: 38 })
  })

  it('every scenario builds a graph', () => {
    for (const id of SCENARIO_IDS) {
      resetDatabase(id)
      expect(buildGraph().user.id).toBe('user-123')
    }
  })
})

describe('mock api', () => {
  it('reads return copies, not store references', async () => {
    const p = await api.getProfile()
    p.bio = 'mutated'
    expect((await api.getProfile()).bio).toBe('')
  })

  it('graph does not change until the API writes; then it reflects the write', async () => {
    const before = buildGraph()
    await api.getProfile()
    expect(buildGraph()).toEqual(before)

    await api.updateProfile({ bio: 'New bio', specialties: ['a', 'b', 'c', 'd', 'e'] })
    const after = buildGraph()
    expect(after.profile).toEqual({ completeness: 100, missing: [] })
  })

  it('updateListing fixes the incomplete listing', async () => {
    resetDatabase('multi-action')
    await api.updateListing('L3', { description: 'Full description', photoCount: 6 })
    expect(buildGraph().listings.incomplete).toBe(0)
  })

  it('updateListing rejects unknown ids', async () => {
    await expect(api.updateListing('nope', {})).rejects.toThrow()
  })
})

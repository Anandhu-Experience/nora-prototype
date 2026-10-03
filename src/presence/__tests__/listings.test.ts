import { beforeEach, describe, expect, it } from 'vitest'
import { connect, connectionsStore } from '../connections'
import { analyticsCsv, applyFix, dataIssues, listingsAnalytics, listingsAnswer, listingsPoints, listingsStore, listingsSummary, proposeFix, publishAllReady, publishBlocker, publishSite, setLocked, validateInfo, validServiceArea } from '../listings'
import { setLatency } from '../persist'

beforeEach(() => { setLatency(0); listingsStore.reset(); connectionsStore.reset() })

describe('listings', () => {
  it('seed has realistic mix and issues', () => {
    const s = listingsStore.get()
    expect(s.sites.length).toBeGreaterThanOrEqual(14)
    expect(listingsSummary(s)).toMatchObject({ published: 3, issues: 2 })
    expect(listingsPoints(s)).toBeGreaterThanOrEqual(0)
    expect(listingsPoints(s)).toBeLessThanOrEqual(100)
  })
  it('validates phone, required and service area', () => {
    const i = { ...listingsStore.get().info, phone: 'abc', name: '', serviceArea: 'Birminghm' }
    const e = validateInfo(i, ['Birmingham'])
    expect(e.phone && e.name && e.serviceArea).toBeTruthy()
    expect(validServiceArea('birmingham', ['Birmingham'])).toBe(true)
    expect(validServiceArea('Leeds, West Yorkshire', ['Birmingham'])).toBe(true)
    expect(validServiceArea('Leeds', ['Birmingham'])).toBe(false)
  })
  it('AI fixes resolve issues and raise points', () => {
    const before = listingsPoints(listingsStore.get())
    for (const f of ['serviceArea', 'placeId'] as const) applyFix(proposeFix(f))
    const s = listingsStore.get()
    expect(dataIssues(s.info)).toHaveLength(0)
    expect(listingsPoints(s)).toBeGreaterThan(before)
  })
  it('publishing moves status, Yelp fails once then retries, Google needs connection', async () => {
    expect(await publishSite('yellowpages')).toBe('published')
    expect(await publishSite('yelp')).toBe('failed')
    expect(await publishSite('yelp')).toBe('published')
    expect(publishBlocker('google')).toBe('google')
    expect(await publishSite('google')).toBe('blocked')
    await connect('google')
    expect(await publishSite('google')).toBe('published')
  })
  it('lock blocks publishing; publish all counts', async () => {
    setLocked(true)
    expect(await publishSite('bbb')).toBe('blocked')
    setLocked(false)
    const r = await publishAllReady()
    expect(r.skipped).toBe(1)
    expect(r.published).toBeGreaterThan(5)
    expect(listingsSummary(listingsStore.get()).ready).toBe(1)
  })
  it('analytics range sizes and csv', () => {
    expect(listingsAnalytics('7D').labels).toHaveLength(7)
    const d = listingsAnalytics('1Y')
    expect(d.views).toBe(d.mapsTotal + d.searchTotal)
    expect(analyticsCsv('7D').split('\n')).toHaveLength(8)
    expect(listingsAnswer().links![0]!.to).toBe('/listings')
  })
})

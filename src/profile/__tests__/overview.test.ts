import { beforeEach, describe, expect, it } from 'vitest'
import { SRS_MAX, srsNow } from '../../presence/srs'
import { MIN_AWARDS, MIN_BIO_CHARS, isUploadedCover, recommendedActions, reviewSources, timeAgo } from '../selectors'
import { actions, getState } from '../store'

beforeEach(() => actions.reset())
const arj = () => getState().agents.arjunan!

describe('recommended actions (derived from the real profile)', () => {
  it('the seed profile gets every applicable suggestion, in order', () => {
    expect(recommendedActions(arj()).map((a) => a.id)).toEqual(['specialties', 'cover', 'service-areas', 'awards', 'bio'])
  })

  it('each one disappears once the profile no longer needs it', () => {
    const a = arj()
    const without = (patch: Partial<typeof a>) => recommendedActions({ ...a, ...patch }).map((x) => x.id)
    expect(without({ specialties: ['a', 'b', 'c', 'd', 'e'] })).not.toContain('specialties')
    expect(without({ cover: 'data:image/png;base64,AAA' })).not.toContain('cover')
    expect(without({ serviceAreas: ['A', 'B', 'C'] })).not.toContain('service-areas')
    expect(without({ awards: [...a.awards, ...a.awards, ...a.awards].slice(0, MIN_AWARDS) })).not.toContain('awards')
    expect(without({ about: 'x'.repeat(MIN_BIO_CHARS) })).not.toContain('bio')
    expect(without({ photoUrl: '' })).toContain('photo')
  })

  it('a complete profile has nothing to suggest', () => {
    const full = { ...arj(), specialties: ['a', 'b', 'c', 'd', 'e'], cover: 'data:image/png;base64,AAA', serviceAreas: ['A', 'B', 'C'], awards: Array(5).fill(arj().awards[0]!), about: 'x'.repeat(MIN_BIO_CHARS) }
    expect(recommendedActions(full)).toEqual([])
  })

  it('treats a missing serviceAreas field (older saved data) as none', () => {
    const legacy = { ...arj(), serviceAreas: undefined as unknown as string[] }
    expect(recommendedActions(legacy).map((a) => a.id)).toContain('service-areas')
  })

  it('knows an uploaded cover from a preset', () => {
    expect(isUploadedCover('sunset')).toBe(false)
    expect(isUploadedCover('data:image/png;base64,AAA')).toBe(true)
  })
})

describe('search rank score', () => {
  it('is bounded by 850, is the sum of its drivers, and rises when the profile improves or is reviewed well', () => {
    const base = srsNow(arj())
    expect(base.total).toBeGreaterThan(0)
    expect(base.total).toBeLessThanOrEqual(SRS_MAX)
    expect(base.drivers.reduce((n, d) => n + d.points, 0)).toBe(base.total)
    expect(base.drivers.reduce((n, d) => n + d.max, 0)).toBe(SRS_MAX)
    expect(srsNow({ ...arj(), about: '', specialties: [] }).total).toBeLessThan(base.total)
    actions.addReview('arjunan', { author: 'Kim', rating: 5, text: 'Wonderful, thank you so much.' })
    expect(srsNow(arj()).total).toBeGreaterThan(base.total)
  })
})

describe('review sources', () => {
  it('splits the owner’s reviews by where they came from', () => {
    const by = Object.fromEntries(reviewSources(arj()).map((s) => [s.source, s]))
    expect(by.Google).toMatchObject({ count: 1, avg: 5 })
    expect(by.Facebook).toMatchObject({ count: 1, avg: 5 })
    expect(by['Experience.com']).toMatchObject({ count: 1, avg: 4 })
  })

  it('a review posted here is an Experience.com review', () => {
    actions.addReview('arjunan', { author: 'Kim', rating: 3, text: 'It was okay overall.' })
    expect(arj().reviews[0]!.source).toBe('Experience.com')
    expect(reviewSources(arj()).find((s) => s.source === 'Experience.com')!.count).toBe(2)
  })

  it('a source with no reviews reports zero, not NaN', () => {
    expect(reviewSources({ ...arj(), reviews: [] }).every((s) => s.count === 0 && s.avg === 0)).toBe(true)
  })
})

describe('time ago', () => {
  const now = new Date('2026-10-02T00:00:00Z').getTime()
  it.each([
    ['2026-10-02T00:00:00Z', 'today'], ['2026-10-01T00:00:00Z', '1 day ago'], ['2026-09-25T00:00:00Z', '1 week ago'],
    ['2026-09-18T00:00:00Z', '2 weeks ago'], ['2026-07-02T00:00:00Z', '3 months ago'], ['2024-10-02T00:00:00Z', '2 years ago'],
  ])('%s -> %s', (iso, want) => expect(timeAgo(iso, now)).toBe(want))
})

describe('publishing', () => {
  it('setPublished flips the flag and records it', () => {
    actions.setPublished('arjunan', false)
    expect(arj().published).toBe(false)
    expect(arj().activity[0]!.text).toBe('Unpublished your profile')
    actions.setPublished('arjunan', true)
    expect(arj().activity[0]!.text).toBe('Published your profile')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { TODAY, buildReportRows, delta, generateReport, insightsStore, previousWindow, rangeError, requestStatus, requestsThisMonth, reviewSeries, rowsToText, sendReviewRequest, series, setCustomRange, setRange, unlock, validateRequest, windowFor, googleUnlocked } from '../insights'
import { setLatency } from '../persist'

beforeEach(() => { setLatency(0); insightsStore.reset() })

describe('date ranges and series', () => {
  it('windows end today and have the right length', () => {
    expect(windowFor('7d').end).toBe(TODAY)
    expect(series('views', windowFor('7d')).values).toHaveLength(7)
    expect(series('views', windowFor('1m')).values).toHaveLength(30)
    expect(series('views', windowFor('yesterday')).values).toHaveLength(24)
    expect(windowFor('yesterday').start).toBe('2026-10-01')
    expect(series('views', windowFor('1y')).values.length).toBeGreaterThan(10)
  })
  it('is deterministic and the buckets add up to the total', () => {
    const w = windowFor('6m')
    const a = series('impressions', w), b = series('impressions', w)
    expect(a).toEqual(b)
    expect(a.values.reduce((x, y) => x + y, 0)).toBe(a.total)
    const day = series('actions', windowFor('yesterday'))
    expect(day.values.reduce((x, y) => x + y, 0)).toBe(day.total)
  })
  it('a longer range contains the shorter one and deltas compare to the previous period', () => {
    expect(series('views', windowFor('1m')).total).toBeGreaterThan(series('views', windowFor('7d')).total)
    const d = delta('views', windowFor('7d'))
    expect(d.previous).toBe(series('views', previousWindow(windowFor('7d'))).total)
    expect(previousWindow(windowFor('7d')).end).toBe('2026-09-25')
  })
  it('review series have three aligned lines', () => {
    const r = reviewSeries(windowFor('1m'))
    expect(r.experience).toHaveLength(r.labels.length)
    expect(r.google).toHaveLength(r.labels.length)
  })
  it('validates custom ranges and persists the range in the store', () => {
    expect(rangeError('2026-09-10', '2026-09-01')).toMatch(/on or before/)
    expect(rangeError('2026-09-01', '2026-12-01')).toMatch(/future/)
    expect(setCustomRange('2026-09-10', '2026-09-01')).not.toBeNull()
    expect(insightsStore.get().range).toBe('1m')
    expect(setCustomRange('2026-09-01', '2026-09-10')).toBeNull()
    expect(insightsStore.get().range).toBe('custom')
    expect(series('views', windowFor('custom', '2026-09-01', '2026-09-10')).values).toHaveLength(10)
    setRange('7d')
    expect(insightsStore.get().range).toBe('7d')
  })
})

describe('unlock conditions', () => {
  it('needs Pro, Google and an SRS of 400', () => {
    expect(unlock(true, false, 95).unlocked).toBe(false)
    expect(unlock(true, false, 95).gap).toBe(305)
    expect(unlock(true, true, 399).unlocked).toBe(false)
    expect(unlock(true, true, 400).unlocked).toBe(true)
    expect(unlock(false, true, 500).unlocked).toBe(false)
    expect(googleUnlocked(true, 400)).toBe(true)
    expect(googleUnlocked(false, 800)).toBe(false)
  })
})

describe('review requests', () => {
  it('validates by channel', () => {
    expect(validateRequest('A', 'x', 'Email')).toEqual({ name: 'Enter the client name.', contact: 'Enter a valid email address.' })
    expect(validateRequest('Ann Lee', 'ann@example.com', 'Email')).toEqual({})
    expect(validateRequest('Ann Lee', '12', 'SMS').contact).toBeTruthy()
    expect(validateRequest('Ann Lee', '+44 7700 900111', 'SMS')).toEqual({})
  })
  it('adds a request that progresses Sent -> Opened -> Reviewed over time', () => {
    const before = insightsStore.get().requests.length
    const r = sendReviewRequest({ name: 'Ann Lee', contact: 'ann@example.com', channel: 'Email', message: 'Hi' })
    expect(insightsStore.get().requests).toHaveLength(before + 1)
    const t = new Date(r.sentAt).getTime()
    expect(requestStatus(r, t + 1000)).toBe('Sent')
    expect(requestStatus(r, t + 8000)).toBe('Opened')
    expect(requestStatus({ ...r, outcome: 'reviewed' }, t + 20000)).toBe('Reviewed')
    expect(requestStatus({ ...r, outcome: 'opened' }, t + 20000)).toBe('Opened')
    expect(requestsThisMonth(insightsStore.get(), r.sentAt)).toBe(1)
    expect(requestsThisMonth(insightsStore.get(), '2026-09-30')).toBe(2)
  })
})

describe('reports', () => {
  it('generates an entry in the activity feed and builds real rows', async () => {
    const e = await generateReport({ type: 'full', format: 'CSV', campaign: 'All', start: '2026-09-01', end: '2026-09-30' })
    expect(insightsStore.get().reports[0]!.id).toBe(e.id)
    const rows = buildReportRows('full', { start: e.start, end: e.end }, 'All')
    const csv = rowsToText(rows, ',')
    expect(csv).toContain('Page views')
    expect(csv).toContain('Google Business Profile')
    expect(csv).toContain('Experience.com')
    expect(buildReportRows('traffic', { start: e.start, end: e.end }, 'Facebook')).not.toEqual(buildReportRows('traffic', { start: e.start, end: e.end }, 'All'))
    expect(rowsToText(rows, '\t')).toContain('\t')
  })
})

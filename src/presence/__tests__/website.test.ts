import { beforeEach, describe, expect, it } from 'vitest'
import { setLatency } from '../persist'
import { buildReportHtml, normalizeUrl, recommendedTag, verifyOutcome, websiteAnswer, websiteIssues, websiteActions, websiteParameters, websitePoints, websiteStore, WEBSITE_MAX, scanFromAudit, SEED_URL } from '../website'

const agent = { name: 'Matt Reeves', title: 'Mortgage Loan Officer', city: 'Birmingham', phone: '+44 121 555 0142' }

beforeEach(() => {
  setLatency(0)
  websiteStore.reset()
})

describe('scoring', () => {
  it('weights sum to 250 and the seed scores ~150', () => {
    const s = websiteStore.get()
    expect(websiteParameters(s).reduce((n, p) => n + p.max, 0)).toBe(WEBSITE_MAX)
    expect(websiteParameters(s).every((p) => p.items.reduce((n, i) => n + i.max, 0) === p.max)).toBe(true)
    expect(websitePoints(s)).toBe(149)
  })

  it('is 0 when not verified', () => {
    expect(websitePoints({ ...websiteStore.get(), status: 'failed' })).toBe(0)
    expect(websitePoints({ ...websiteStore.get(), status: 'none' })).toBe(0)
  })

  it('lists issues by value, meta description first', () => {
    const issues = websiteIssues(websiteStore.get())
    expect(issues[0]!.id).toBe('tag-description')
    expect(issues[0]!.gain).toBe(24)
  })
})

describe('urls and verification', () => {
  it('normalises the address', () => {
    expect(normalizeUrl('www.site.com/a/?utm_source=x&id=2#top')).toBe('https://www.site.com/a?id=2')
    expect(normalizeUrl('site.com')).toBe('https://site.com')
    expect(normalizeUrl('not a url')).toBe('')
  })

  it('gives a specific reason when verification fails and passes once the tag is added', async () => {
    websiteActions.saveUrl('www.randomsite.com?utm_campaign=a')
    expect(websiteStore.get().url).toBe('https://www.randomsite.com')
    expect(await websiteActions.verify(agent)).toBe(false)
    expect(websiteStore.get().failure!.code).toBe('tag')
    websiteActions.addTagForMe()
    expect(await websiteActions.verify(agent)).toBe(true)
    expect(websiteStore.get().status).toBe('verified')
    expect(websiteStore.get().scan).not.toBeNull()
    expect(verifyOutcome('https://down.example.org', false)!.code).toBe('unreachable')
  })

  it('verifies example hosts straight away and scans', async () => {
    websiteActions.saveUrl('mattreeves.example.com')
    expect(websitePoints(websiteStore.get())).toBe(0)
    expect(await websiteActions.verify(agent)).toBe(true)
    expect(websitePoints(websiteStore.get())).toBeGreaterThan(0)
  })
})

describe('fixes', () => {
  it('applying a tag adds its points and survives a re-scan', async () => {
    const before = websitePoints(websiteStore.get())
    websiteActions.applyTag('description', 'Mortgage advice in Birmingham.')
    expect(websitePoints(websiteStore.get())).toBe(before + 24)
    await websiteActions.scan(agent)
    expect(websitePoints(websiteStore.get())).toBe(before + 24)
  })

  it('marking load time fixed improves the measured time', async () => {
    await websiteActions.markFixed('load', agent)
    const s = websiteStore.get()
    expect(s.scan!.loadTime).toBeLessThanOrEqual(2.5)
    expect(websitePoints(s)).toBe(149 + 20)
  })

  it('recommended tags are deterministic', () => {
    expect(recommendedTag('twitter', agent).html).toContain('summary_large_image')
  })
})

describe('report and NORA', () => {
  it('the report has the score and recommendations', () => {
    const html = buildReportHtml(websiteStore.get(), 'Matt Reeves', '2026-10-02T00:00:00.000Z')
    expect(html).toContain('149')
    expect(html).toContain('Meta description')
    expect(html).toContain('Recommendations')
  })

  it('answers from live data', () => {
    const a = websiteAnswer()
    expect(a.intro).toContain('149')
    expect(a.items!.length).toBeGreaterThan(0)
    expect(a.links![0]!.to).toBe('/analytics')
  })
})

describe('mapping a live audit onto the page', () => {
  it('turns found items into earned items, and an unmeasured load time into null', () => {
    const scan = scanFromAudit({
      page: { title: 'T', description: '', robots: 'index', language: 'en', charset: 'utf-8', og: '', google: '', twitter: '' },
      nap: { name: true, phone: false, address: false }, reviews: { widget: false, schema: true, count: 12 },
      security: { ssl: true, expires: '2027-03-14', httpsRedirect: false }, load: { seconds: null }, lighthouse: null, notes: [],
    }, { name: 'Matt Reeves', phone: '+44 1', city: 'Birmingham' })
    expect(scan.loadTime).toBeNull()
    expect(scan.tags.title.ok).toBe(true)
    expect(scan.tags.description.ok).toBe(false)
    expect(scan.nap.name).toEqual({ ok: true, value: 'Matt Reeves' })
    expect(scan.nap.phone.ok).toBe(false)
    expect(scan.reviews).toEqual({ widget: false, schema: true, count: 12 })
  })
})

describe('the app\'s own profile address', () => {
  it('needs no verification, while another real host still does', () => {
    expect(verifyOutcome(SEED_URL, false)).toBeNull()
    expect(verifyOutcome('https://some-other-site.test/page', false)?.code).toBe('tag')
  })
})

describe('a failed live scan', () => {
  it('keeps the previous results and says why, instead of inventing a score', async () => {
    websiteStore.set((s) => ({ ...s, url: 'https://real-site.test/profile/x', status: 'verified', tagInstalled: true, scan: s.scan }))
    const before = websiteStore.get().scan
    const real = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'unreachable', message: 'The site answered with an error (404).' }), { status: 502 })) as typeof fetch
    try { await websiteActions.scan() } finally { globalThis.fetch = real }
    const s = websiteStore.get()
    expect(s.scanFailed).toBe(true)
    expect(s.scanNote).toMatch(/404/)
    expect(s.scan).toEqual(before)
  })
  it('still shows labelled sample data when there is no server to ask', async () => {
    websiteStore.set((s) => ({ ...s, url: 'https://another-site.test', status: 'verified', tagInstalled: true, scan: null, scanFailed: false }))
    const real = globalThis.fetch
    globalThis.fetch = (async () => { throw new TypeError('network down') }) as typeof fetch
    try { await websiteActions.scan() } finally { globalThis.fetch = real }
    const s = websiteStore.get()
    expect(s.scanFailed).toBe(false)
    expect(s.source).toBe('sample')
    expect(s.scan).not.toBeNull()
  })
})

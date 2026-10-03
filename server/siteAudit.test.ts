import { describe, expect, it, vi } from 'vitest'
import { assertPublicUrl, createSiteAuditHandler, isPrivateIp, matchNap, parseHtml } from './siteAudit.ts'

const PAGE = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Agent Arjunan | Mortgage Loan Officer</title>
<meta name="description" content="Mortgage advice &amp; refinancing in Birmingham."><meta name="robots" content="index, follow">
<meta property="og:title" content="Arjunan"><meta property="og:image" content="/x.jpg"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@type":"Person","aggregateRating":{"@type":"AggregateRating","ratingValue":4.7,"reviewCount":12}}</script>
<script>var secret = "ignore me"</script></head><body><h1>Agent Arjunan</h1><p>Call +44 121 555 0142 or visit us in Birmingham.</p></body></html>`

const publicLookup = async () => ['93.184.216.34']
const html = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html' }, ...init })
const psiJson = { lighthouseResult: { categories: { seo: { score: 0.92 }, performance: { score: 0.61 } }, audits: { 'largest-contentful-paint': { numericValue: 2840 }, 'meta-description': { score: 0, scoreDisplayMode: 'binary', title: 'Document does not have a meta description' } } } }

/** A fetch stand-in: the page, the http redirect probe, and PageSpeed. */
function fakeFetch(over: Partial<{ page: () => Response; psi: () => Response }> = {}) {
  return vi.fn(async (input: string | URL) => {
    const u = String(input)
    if (u.includes('googleapis.com/pagespeedonline')) return (over.psi ?? (() => new Response(JSON.stringify(psiJson), { status: 200 })))()
    if (u.startsWith('http://')) return new Response(null, { status: 301, headers: { location: 'https://site.test/' } })
    return (over.page ?? (() => html(PAGE)))()
  })
}
const handler = (fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) =>
  createSiteAuditHandler({ fetchImpl, lookup: publicLookup, tlsCheck: async () => ({ ssl: true, expires: '2027-03-14' }), env: { PAGESPEED_API_KEY: 'test-key' }, ...extra })

describe('keeping the fetcher on public addresses', () => {
  it('knows private ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.5', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect(isPrivateIp(ip), ip).toBe(true)
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111']) expect(isPrivateIp(ip), ip).toBe(false)
  })
  it('refuses localhost, private IPs, odd ports, other protocols, credentials, and names that resolve privately', async () => {
    for (const u of ['http://localhost/', 'http://127.0.0.1/', 'http://[::1]/', 'http://192.168.0.1/admin', 'https://site.local/', 'http://x.test:8080/', 'ftp://x.test/', 'file:///etc/passwd', 'https://user:pw@x.test/', 'not a url']) {
      await expect(assertPublicUrl(u, publicLookup), u).rejects.toThrow()
    }
    await expect(assertPublicUrl('https://sneaky.test/', async () => ['10.0.0.8'])).rejects.toThrow(/Private/)
    await expect(assertPublicUrl('https://ok.test/', publicLookup)).resolves.toBeInstanceOf(URL)
  })
})

describe('reading the page', () => {
  const p = parseHtml(PAGE)
  it('finds the meta tags, language, charset, Open Graph, Twitter card and schema', () => {
    expect(p).toMatchObject({ title: 'Agent Arjunan | Mortgage Loan Officer', description: 'Mortgage advice & refinancing in Birmingham.', robots: 'index, follow', language: 'en-GB', charset: 'utf-8', twitter: 'summary_large_image', google: '' })
    expect(p.og).toBe('og:title, og:image')
    expect(p.schemaReviews).toEqual({ present: true, count: 12 })
  })
  it('matches name, phone and address in the visible text only', () => {
    expect(p.text).not.toContain('ignore me')
    expect(matchNap(p.text, { name: 'Agent Arjunan', phone: '+44 121 555 0142', address: 'Birmingham' })).toEqual({ name: true, phone: true, address: true })
    expect(matchNap(p.text, { name: 'Someone Else', phone: '+44 20 7946 0958', address: 'Leeds' })).toEqual({ name: false, phone: false, address: false })
  })
})

describe('the audit handler', () => {
  it('returns the page checks, SSL, redirect and PageSpeed results', async () => {
    const r = await handler(fakeFetch() as never)({ url: 'https://site.test/', nap: { name: 'Agent Arjunan', phone: '+44 121 555 0142', address: 'Birmingham' } })
    expect(r.status).toBe(200)
    const b = r.body as Exclude<typeof r.body, { error: string }>
    expect(b.page.title).toContain('Arjunan')
    expect(b.nap).toEqual({ name: true, phone: true, address: true })
    expect(b.security).toEqual({ ssl: true, expires: '2027-03-14', httpsRedirect: true })
    expect(b.load).toEqual({ seconds: 2.8, source: 'pagespeed' })
    expect(b.lighthouse).toMatchObject({ seo: 92, performance: 61 })
    expect(b.lighthouse!.issues[0]!.id).toBe('meta-description')
  })

  it('sends the API key to PageSpeed, never to the site', async () => {
    const f = fakeFetch()
    await handler(f as never)({ url: 'https://site.test/' })
    const urls = f.mock.calls.map((c) => String(c[0]))
    expect(urls.find((u) => u.includes('pagespeedonline'))).toContain('key=test-key')
    expect(urls.filter((u) => !u.includes('pagespeedonline')).every((u) => !u.includes('test-key'))).toBe(true)
  })

  it('still answers when PageSpeed fails, with a note and no load time', async () => {
    const r = await handler(fakeFetch({ psi: () => new Response('{}', { status: 429 }) }) as never)({ url: 'https://site.test/' })
    const b = r.body as Exclude<typeof r.body, { error: string }>
    expect(r.status).toBe(200)
    expect(b.load).toEqual({ seconds: null, source: null })
    expect(b.notes.join(' ')).toMatch(/Load time could not be measured/)
  })

  it('refuses a private address and a redirect into one, without fetching them', async () => {
    const f = fakeFetch()
    expect((await handler(f as never)({ url: 'http://169.254.169.254/latest/meta-data' })).status).toBe(422)
    expect(f).not.toHaveBeenCalled()
    const redirecting = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:3000/secret' } }))
    const r = await handler(redirecting as never)({ url: 'https://site.test/' })
    expect(r.status).toBe(422)
    expect(redirecting).toHaveBeenCalledTimes(1)
  })

  it('rejects bad bodies, non-HTML and oversized pages, and rate-limits', async () => {
    const h = handler(fakeFetch() as never)
    expect((await h(null)).status).toBe(400)
    expect((await h({ url: 5 })).status).toBe(400)
    expect((await handler(fakeFetch({ page: () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) }) as never)({ url: 'https://site.test/' })).body).toMatchObject({ error: 'not_html' })
    expect((await handler(fakeFetch({ page: () => html('x'.repeat(1_600_000)) }) as never)({ url: 'https://site.test/' })).body).toMatchObject({ error: 'too_large' })
    let t = 0
    const limited = handler(fakeFetch() as never, { now: () => t, limit: { max: 2, windowMs: 1000 } })
    await limited({ url: 'https://site.test/' }); await limited({ url: 'https://site.test/' })
    expect((await limited({ url: 'https://site.test/' })).status).toBe(429)
    t = 2000
    expect((await limited({ url: 'https://site.test/' })).status).toBe(200)
  })

  it('reports an unreachable site as a 502 with a plain message', async () => {
    const down = vi.fn(async () => { throw new TypeError('fetch failed') })
    const r = await handler(down as never)({ url: 'https://site.test/' })
    expect(r.status).toBe(502)
    expect((r.body as { message: string }).message).toMatch(/could not reach/i)
  })
})

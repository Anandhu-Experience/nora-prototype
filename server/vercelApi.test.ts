import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { profileMeta, renderProfileHtml, seededAgent } from './profilePage.ts'

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>nora-prototype</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>`

describe('the server-rendered public profile', () => {
  const a = seededAgent('arjunan')!
  const out = renderProfileHtml(INDEX, a, 'https://app.vercel.app')

  it('puts a real title, description, canonical, Open Graph and Twitter tags in the head', () => {
    expect(out).toContain('<title>Agent Arjunan | Mortgage Loan Officer in Birmingham</title>')
    expect(out).toContain('<meta name="description" content="Dedicated mortgage loan officer')
    expect(out).toContain('<link rel="canonical" href="https://app.vercel.app/profile/arjunan" />')
    expect(out).toContain('property="og:title"')
    expect(out).toContain('name="twitter:card"')
    expect(out).toContain('<meta name="robots" content="index, follow" />')
    expect(out).toContain('<html lang="en-GB"')
    expect(out).toContain('<meta charset="UTF-8" />')
    expect(profileMeta(a, 'https://x').description.length).toBeLessThanOrEqual(156)
  })

  it('adds JSON-LD that parses and carries the rating, address and hours', () => {
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(out)![1]!
    const g = JSON.parse(json)['@graph']
    expect(g[0].aggregateRating.reviewCount).toBe(3)
    expect(g[1].address.streetAddress).toBe('45 Colmore Row')
    expect(g[1].openingHoursSpecification.length).toBeGreaterThan(0)
  })

  it('puts the profile text where a crawler that skips JavaScript will read it, and keeps the app script', () => {
    expect(out).toMatch(/<div id="root"><main><article><h1>Agent Arjunan<\/h1>/)
    expect(out).toContain('+44 121 555 0142')
    expect(out).toContain('Birmingham')
    expect(out).toContain('<script type="module" src="/assets/index.js"></script>')
  })

  it('marks an unpublished profile noindex and cannot be broken out of by profile text', () => {
    const hostile = { ...a, published: false, name: 'A </script><script>alert(1)</script>', about: 'x "quoted" <b>bold</b>' }
    const o = renderProfileHtml(INDEX, hostile, 'https://app.vercel.app')
    expect(o).toContain('noindex, nofollow')
    expect(o).not.toContain('<script>alert(1)</script>')
    expect(o).not.toContain('<b>bold</b>')
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(o)![1]!
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

/** The bundled functions under api/, run through a real HTTP server the way Vercel calls them. */
describe('the bundled Vercel functions (api/)', () => {
  const realFetch = globalThis.fetch
  let server: Server
  let port = 0
  let which: 'profile' | 'audit' = 'profile'
  let profile: (req: unknown, res: unknown) => Promise<void>
  let audit: (req: unknown, res: unknown) => Promise<void>

  beforeAll(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p) as Promise<{ default: (req: unknown, res: unknown) => Promise<void> }>
    profile = (await load('../api/profile.js')).default
    audit = (await load('../api/seo/audit.js')).default
    server = createServer((req, res) => void (which === 'profile' ? profile(req, res) : audit(req, res)))
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    port = (server.address() as AddressInfo).port
    // the profile function reads this deployment's own index.html over https; serve it from memory
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      const u = String(input)
      if (u === 'https://app.vercel.app/index.html') return new Response(INDEX, { status: 200, headers: { 'content-type': 'text/html' } })
      return realFetch(input, init)
    })
  })
  afterAll(() => { vi.unstubAllGlobals(); server.close() })

  const call = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
    realFetch(`http://127.0.0.1:${port}${path}`, { ...init, headers: { 'x-forwarded-host': 'app.vercel.app', 'x-forwarded-proto': 'https', ...init.headers } })

  it('profile: returns the rendered page for a known agent and the plain app shell for an unknown one', async () => {
    which = 'profile'
    const ok = await call('/api/profile?id=arjunan')
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toMatch(/text\/html/)
    expect(await ok.text()).toContain('<title>Agent Arjunan | Mortgage Loan Officer in Birmingham</title>')
    const unknown = await call('/api/profile?id=nobody')
    expect(await unknown.text()).toContain('<title>nora-prototype</title>')
  })

  it('profile: refuses a host that is not a plain public hostname', async () => {
    which = 'profile'
    for (const host of ['localhost:3000', '127.0.0.1', '10.0.0.5', 'evil host', 'a.b/../c']) {
      expect((await call('/api/profile?id=arjunan', { headers: { 'x-forwarded-host': host } })).status, host).toBe(400)
    }
  })

  it('audit: POST only, validates the body, and refuses private addresses', async () => {
    which = 'audit'
    expect((await call('/api/seo/audit')).status).toBe(405)
    expect((await call('/api/seo/audit', { method: 'POST', body: 'not json' })).status).toBe(400)
    const blocked = await call('/api/seo/audit', { method: 'POST', body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data' }) })
    expect(blocked.status).toBe(422)
    expect(await blocked.json()).toMatchObject({ error: 'blocked_address' })
  })
})

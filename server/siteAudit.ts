import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { connect as tlsConnect } from 'node:tls'

/**
 * Server half of the Web Analytics scan: POST /api/seo/audit { url, nap? }.
 * It fetches the public page itself (title, meta tags, schema, text), checks the SSL certificate and the http to https redirect,
 * and asks Google's PageSpeed Insights API (free, key in PAGESPEED_API_KEY) for load time and Lighthouse scores.
 * Because it fetches a URL a person typed, every address (and every redirect) is checked to be public before it is contacted.
 */

export interface AuditNap { name?: string; phone?: string; address?: string }
export interface AuditResult {
  url: string
  fetchedAt: string
  page: {
    title: string; description: string; robots: string; language: string; charset: string
    og: string; google: string; twitter: string
  }
  nap: { name: boolean; phone: boolean; address: boolean }
  reviews: { widget: boolean; schema: boolean; count: number }
  security: { ssl: boolean; expires: string; httpsRedirect: boolean }
  load: { seconds: number | null; source: 'pagespeed' | null }
  lighthouse: { seo: number | null; performance: number | null; issues: { id: string; title: string }[] } | null
  /** Anything that could not be checked, in plain words. */
  notes: string[]
}

export interface AuditDeps {
  fetchImpl?: typeof fetch
  lookup?: (host: string) => Promise<string[]>
  tlsCheck?: (host: string) => Promise<{ ssl: boolean; expires: string }>
  env?: Record<string, string | undefined>
  now?: () => number
  limit?: { max: number; windowMs: number }
}

/* ---------------- keeping the fetcher away from private addresses ---------------- */

export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  if (isIP(v) === 4) {
    const [a, b] = v.split('.').map(Number) as [number, number]
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  if (isIP(v) === 6) return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')
  return true // not an address at all: refuse
}

type AuditCode = 'invalid_url' | 'blocked_address' | 'unreachable' | 'not_html' | 'too_large'
export class AuditError extends Error {
  code: AuditCode
  constructor(code: AuditCode, message: string) { super(message); this.code = code }
}

const defaultLookup = async (host: string): Promise<string[]> => (await dnsLookup(host, { all: true })).map((a) => a.address)

/** Throws unless the URL is plain http(s) to a public host. Returns the parsed URL. */
export async function assertPublicUrl(raw: string, lookup: (h: string) => Promise<string[]> = defaultLookup): Promise<URL> {
  let u: URL
  try { u = new URL(raw) } catch { throw new AuditError('invalid_url', 'That does not look like a website address.') }
  if (!/^https?:$/.test(u.protocol)) throw new AuditError('invalid_url', 'Only http and https addresses can be checked.')
  if (u.username || u.password) throw new AuditError('invalid_url', 'Addresses with a login in them cannot be checked.')
  if (u.port && !['80', '443'].includes(u.port)) throw new AuditError('blocked_address', 'Only standard web ports can be checked.')
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new AuditError('blocked_address', 'Private and local addresses cannot be checked.')
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new AuditError('blocked_address', 'Private and local addresses cannot be checked.')
    return u
  }
  let addrs: string[]
  try { addrs = await lookup(host) } catch { throw new AuditError('unreachable', `We could not find ${host}. Check the address.`) }
  if (!addrs.length || addrs.some(isPrivateIp)) throw new AuditError('blocked_address', 'Private and local addresses cannot be checked.')
  return u
}

/* ---------------- fetching ---------------- */

const MAX_BYTES = 1_500_000
const UA = 'NoraSiteAudit/1.0 (+read-only SEO check)'

async function readCapped(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return await res.text()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > max) { void reader.cancel(); throw new AuditError('too_large', 'The page is too large to check.') }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/** GET with manual redirects (at most 4), checking every hop. */
export async function fetchPage(url: string, deps: Required<Pick<AuditDeps, 'fetchImpl' | 'lookup'>>, timeoutMs = 9000): Promise<{ html: string; finalUrl: string }> {
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    const u = await assertPublicUrl(current, deps.lookup)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await deps.fetchImpl(u, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } })
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { current = new URL(res.headers.get('location')!, u).toString(); continue }
      if (!res.ok) throw new AuditError('unreachable', `The site answered with an error (${res.status}).`)
      if (!/html/i.test(res.headers.get('content-type') ?? 'text/html')) throw new AuditError('not_html', 'That address is not a web page.')
      return { html: await readCapped(res, MAX_BYTES), finalUrl: u.toString() }
    } catch (e) {
      if (e instanceof AuditError) throw e
      throw new AuditError('unreachable', (e as Error)?.name === 'AbortError' ? 'The site took too long to answer.' : 'We could not reach the site.')
    } finally { clearTimeout(timer) }
  }
  throw new AuditError('unreachable', 'The site redirected too many times.')
}

/* ---------------- reading the HTML (no dependencies) ---------------- */

const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim()

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? ''
  return out
}

export interface Parsed {
  title: string; description: string; robots: string; language: string; charset: string; og: string; google: string; twitter: string
  schemaReviews: { count: number; present: boolean }; widget: boolean; text: string
}

export function parseHtml(html: string): Parsed {
  const head = html.slice(0, 200_000)
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]))
  const named = (n: string) => metas.find((m) => m.name?.toLowerCase() === n)?.content ?? ''
  const og = metas.filter((m) => m.property?.toLowerCase().startsWith('og:')).map((m) => m.property!.toLowerCase())
  const charset = metas.find((m) => m.charset)?.charset ?? /charset=([\w-]+)/i.exec(metas.find((m) => m['http-equiv']?.toLowerCase() === 'content-type')?.content ?? '')?.[1] ?? ''
  let reviews = { count: 0, present: false }
  for (const m of html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) return n.forEach(walk)
        if (!n || typeof n !== 'object') return
        const o = n as Record<string, unknown>
        const agg = o.aggregateRating as Record<string, unknown> | undefined
        if (agg) reviews = { present: true, count: Math.max(reviews.count, Number(agg.reviewCount ?? agg.ratingCount ?? 0) || 0) }
        Object.values(o).forEach(walk)
      }
      walk(JSON.parse(m[1]!))
    } catch { /* invalid JSON-LD is ignored */ }
  }
  const text = decode(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))
  return {
    title: decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? ''),
    description: decode(named('description')),
    robots: decode(named('robots')),
    language: /<html[^>]*\blang\s*=\s*["']([^"']+)/i.exec(head)?.[1] ?? '',
    charset,
    og: [...new Set(og)].join(', '),
    google: decode(named('google-site-verification')) ? 'google-site-verification' : '',
    twitter: decode(named('twitter:card')),
    schemaReviews: reviews,
    widget: /experience\.com|review-widget|reviews?-badge|data-reviews/i.test(html),
    text,
  }
}

/** Does the page mention the agent's name, phone number and address? (A plain text match.) */
export function matchNap(text: string, nap: AuditNap = {}): { name: boolean; phone: boolean; address: boolean } {
  const lower = text.toLowerCase()
  const name = (nap.name ?? '').replace(/^agent\s+/i, '').trim().toLowerCase()
  const digits = (nap.phone ?? '').replace(/\D/g, '')
  const tail = digits.length >= 7 ? digits.slice(-9) : ''
  return {
    name: !!name && lower.includes(name),
    phone: !!tail && text.replace(/\D/g, '').includes(tail),
    address: !!(nap.address ?? '').trim() && lower.includes(nap.address!.trim().toLowerCase()),
  }
}

/* ---------------- SSL, redirect, PageSpeed ---------------- */

const defaultTlsCheck = (host: string): Promise<{ ssl: boolean; expires: string }> =>
  new Promise((resolve) => {
    const done = (v: { ssl: boolean; expires: string }) => { try { socket.destroy() } catch { /* already closed */ } resolve(v) }
    const socket = tlsConnect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 6000 }, () => {
      const cert = socket.getPeerCertificate()
      const until = cert?.valid_to ? new Date(cert.valid_to) : null
      done({ ssl: socket.authorized && !!until && until.getTime() > Date.now(), expires: until && !Number.isNaN(until.getTime()) ? until.toISOString().slice(0, 10) : '' })
    })
    socket.on('error', () => done({ ssl: false, expires: '' }))
    socket.on('timeout', () => done({ ssl: false, expires: '' }))
  })

async function httpsRedirects(host: string, deps: Required<Pick<AuditDeps, 'fetchImpl' | 'lookup'>>): Promise<boolean> {
  try {
    const u = await assertPublicUrl(`http://${host}/`, deps.lookup)
    const res = await deps.fetchImpl(u, { redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) })
    return res.status >= 300 && res.status < 400 && /^https:\/\//i.test(res.headers.get('location') ?? '')
  } catch { return false }
}

interface Psi { seconds: number | null; seo: number | null; performance: number | null; issues: { id: string; title: string }[] }

async function pageSpeed(url: string, key: string | undefined, fetchImpl: typeof fetch): Promise<Psi> {
  const q = new URLSearchParams({ url, strategy: 'mobile' })
  q.append('category', 'seo'); q.append('category', 'performance')
  if (key) q.set('key', key)
  const res = await fetchImpl(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(70_000) })
  if (!res.ok) throw new Error(`PageSpeed Insights answered ${res.status}`)
  const j = (await res.json()) as { lighthouseResult?: { categories?: Record<string, { score: number | null }>; audits?: Record<string, { score: number | null; scoreDisplayMode?: string; title?: string; numericValue?: number }> } }
  const lh = j.lighthouseResult
  if (!lh) throw new Error('PageSpeed Insights returned no result')
  const lcp = lh.audits?.['largest-contentful-paint']?.numericValue
  const seoAudits = Object.entries(lh.audits ?? {}).filter(([, a]) => a.scoreDisplayMode === 'binary' && a.score === 0)
  const seoIds = new Set(['document-title', 'meta-description', 'http-status-code', 'link-text', 'crawlable-anchors', 'is-crawlable', 'robots-txt', 'image-alt', 'hreflang', 'canonical', 'viewport', 'html-has-lang', 'font-size', 'tap-targets'])
  return {
    seconds: typeof lcp === 'number' ? Math.round(lcp / 100) / 10 : null,
    seo: lh.categories?.seo?.score != null ? Math.round(lh.categories.seo.score * 100) : null,
    performance: lh.categories?.performance?.score != null ? Math.round(lh.categories.performance.score * 100) : null,
    issues: seoAudits.filter(([id]) => seoIds.has(id)).map(([id, a]) => ({ id, title: a.title ?? id })).slice(0, 8),
  }
}

/* ---------------- handler ---------------- */

export interface AuditReply { status: number; body: AuditResult | { error: string; message: string } }

export function createSiteAuditHandler(deps: AuditDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch
  const lookup = deps.lookup ?? defaultLookup
  const tlsCheck = deps.tlsCheck ?? defaultTlsCheck
  const env = deps.env ?? process.env
  const now = deps.now ?? Date.now
  const { max, windowMs } = deps.limit ?? { max: 6, windowMs: 60_000 }
  const hits: number[] = []

  return async function handle(body: unknown): Promise<AuditReply> {
    const o = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
    if (!o || typeof o.url !== 'string' || o.url.length > 2000) return { status: 400, body: { error: 'invalid_url', message: 'Send a website address.' } }
    const napIn = typeof o.nap === 'object' && o.nap !== null ? (o.nap as Record<string, unknown>) : {}
    const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined)
    const nap: AuditNap = { name: s(napIn.name, 120), phone: s(napIn.phone, 40), address: s(napIn.address, 160) }

    const t = now()
    while (hits.length && t - hits[0]! > windowMs) hits.shift()
    if (hits.length >= max) return { status: 429, body: { error: 'rate_limited', message: 'Too many scans. Try again in a minute.' } }
    hits.push(t)

    const d = { fetchImpl, lookup }
    try {
      const { html, finalUrl } = await fetchPage(o.url, d)
      const host = new URL(finalUrl).hostname
      const notes: string[] = []
      const [tls, redirect, psi] = await Promise.all([
        finalUrl.startsWith('https:') ? tlsCheck(host) : Promise.resolve({ ssl: false, expires: '' }),
        httpsRedirects(host, d),
        pageSpeed(finalUrl, env.PAGESPEED_API_KEY, fetchImpl).catch((e: Error) => { notes.push(`Load time could not be measured: ${e.message}.`); return null }),
      ])
      const p = parseHtml(html)
      const result: AuditResult = {
        url: finalUrl,
        fetchedAt: new Date(now()).toISOString(),
        page: { title: p.title, description: p.description, robots: p.robots, language: p.language, charset: p.charset, og: p.og, google: p.google, twitter: p.twitter },
        nap: matchNap(p.text, nap),
        reviews: { widget: p.widget || p.schemaReviews.present, schema: p.schemaReviews.present, count: p.schemaReviews.count },
        security: { ssl: tls.ssl, expires: tls.expires, httpsRedirect: redirect },
        load: { seconds: psi?.seconds ?? null, source: psi?.seconds != null ? 'pagespeed' : null },
        lighthouse: psi ? { seo: psi.seo, performance: psi.performance, issues: psi.issues } : null,
        notes,
      }
      return { status: 200, body: result }
    } catch (e) {
      if (e instanceof AuditError) return { status: e.code === 'unreachable' ? 502 : 422, body: { error: e.code, message: e.message } }
      return { status: 500, body: { error: 'internal', message: 'The scan failed.' } }
    }
  }
}

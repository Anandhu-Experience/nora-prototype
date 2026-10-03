import type { AiAnswer } from '../profile/assistant'
import type { Agent } from '../profile/types'
import { createStore, latency, nowIso, wait } from './persist'

/**
 * Web Analytics: an audit of the agent's own website, scored out of 250.
 *
 * Point weights (they sum to 250):
 *   NAP data      40   name 14, address 13, phone 13
 *   Load time     40   good (<= 2.5s) 40, needs improvement (2.6-4.0s) 20, poor (> 4.0s) 0
 *   HTML data     90   meta description 24, title 12, robots 8, language 8, charset 8, Facebook (og) 12, Google 6, X card 12
 *   Reviews       40   review widget 16, review schema 14, review count shown 10
 *   Site security 40   valid SSL certificate 28, HTTPS redirect 12
 * An unverified site earns 0.
 */
export const WEBSITE_MAX = 250
export type ParamId = 'nap' | 'load' | 'html' | 'reviews' | 'security'
export type TagId = 'description' | 'robots' | 'language' | 'charset' | 'title' | 'og' | 'google' | 'twitter'

export const PARAM_MAX: Record<ParamId, number> = { nap: 40, load: 40, html: 90, reviews: 40, security: 40 }
export const PARAM_LABEL: Record<ParamId, string> = { nap: 'NAP Data', load: 'Load Time', html: 'HTML Data', reviews: 'Reviews on page', security: 'Site Security' }
export const TAGS: { id: TagId; label: string; points: number; hint: string }[] = [
  { id: 'description', label: 'Meta description', points: 24, hint: 'The snippet search engines show under your link.' },
  { id: 'title', label: 'Title tag', points: 12, hint: 'The page title shown in search results and browser tabs.' },
  { id: 'robots', label: 'Robots', points: 8, hint: 'Tells search engines they may index the page.' },
  { id: 'language', label: 'Language', points: 8, hint: 'Declares the language of the page.' },
  { id: 'charset', label: 'Charset', points: 8, hint: 'Makes sure text renders correctly.' },
  { id: 'og', label: 'Facebook (Open Graph)', points: 12, hint: 'Controls how links look when shared on Facebook and LinkedIn.' },
  { id: 'google', label: 'Google', points: 6, hint: 'Google site tag used by Search Console.' },
  { id: 'twitter', label: 'X (Twitter card)', points: 12, hint: 'Controls how links look when shared on X.' },
]

export type SiteStatus = 'none' | 'verifying' | 'failed' | 'verified'
export interface Failure { code: 'invalid' | 'tag' | 'unreachable'; reason: string; fix: string }
interface Field { ok: boolean; value: string }
export interface Scan {
  nap: { name: Field; address: Field; phone: Field }
  /** Seconds to the largest paint, or null when it could not be measured. */
  loadTime: number | null
  tags: Record<TagId, Field>
  reviews: { widget: boolean; schema: boolean; count: number }
  security: { ssl: boolean; expires: string; httpsRedirect: boolean }
}
export interface WebsiteState {
  url: string
  status: SiteStatus
  failure: Failure | null
  /** The verification tag has been placed on the site (by the owner or by "Add it for me"). */
  tagInstalled: boolean
  scanning: boolean
  scannedAt: string | null
  scan: Scan | null
  /** Fixes the owner confirmed; they survive a re-scan. */
  fixes: string[]
  tagValues: Partial<Record<TagId, string>>
  /** Where the last scan came from: a real check of the site, or labelled sample data. */
  source?: 'live' | 'sample'
  /** Why a scan fell back to sample data, or anything that could not be checked in a live one. */
  scanNote?: string
  /** Lighthouse scores from PageSpeed Insights (live scans only). */
  lighthouse?: { seo: number | null; performance: number | null; issues: { id: string; title: string }[] } | null
}

export const SEED_URL = 'https://www.newamerican.example/arjunan'
const f = (value: string): Field => ({ ok: true, value })
const none: Field = { ok: false, value: '' }

const SEED_SCAN: Scan = {
  nap: { name: f('Agent Arjunan'), address: none, phone: f('+44 121 555 0142') },
  loadTime: 3.1,
  tags: {
    description: none,
    title: f('Agent Arjunan | Mortgage Loan Officer in Birmingham'),
    robots: f('index, follow'),
    language: f('en-GB'),
    charset: f('UTF-8'),
    og: f('og:title, og:description, og:image'),
    google: none,
    twitter: none,
  },
  reviews: { widget: true, schema: false, count: 3 },
  security: { ssl: true, expires: '2027-03-14', httpsRedirect: false },
}

const seed = (): WebsiteState => ({ url: SEED_URL, status: 'verified', failure: null, tagInstalled: true, scanning: false, scannedAt: '2026-09-30T09:12:00.000Z', scan: SEED_SCAN, fixes: [], tagValues: {} })
export const websiteStore = createStore<WebsiteState>('nora-presence-website-v2', seed)

/* ---------------- URL handling and the mock checks ---------------- */

const TRACKING = /^(utm_|fbclid|gclid|msclkid|mc_|igshid|ref$|ref_src$)/i
/** Add https://, drop tracking parameters, the fragment and a trailing slash. Returns '' when it is not a URL. */
export function normalizeUrl(raw: string): string {
  let t = raw.trim().replace(/\s+/g, '')
  if (!t) return ''
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = `https://${t}`
  try {
    const u = new URL(t)
    if (!/^https?:$/.test(u.protocol) || !/^[^.]+(\.[^.]+)+$/.test(u.hostname) && u.hostname !== 'localhost') return ''
    ;[...u.searchParams.keys()].forEach((k) => TRACKING.test(k) && u.searchParams.delete(k))
    u.hash = ''
    const s = u.toString()
    return s.endsWith('/') && u.pathname === '/' && !u.search ? s.slice(0, -1) : s.replace(/\/(\?|$)/, '$1')
  } catch {
    return ''
  }
}
const hostOf = (url: string): string => { try { return new URL(url).hostname.toLowerCase() } catch { return '' } }
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** The meta tag the owner adds to prove the site is theirs (deterministic per URL). */
export const verificationTag = (url: string): string => `<meta name="nora-site-verification" content="nora-${hash(hostOf(url) || url).toString(36)}">`

/** Mock verification: example/newamerican hosts pass, "blocked"/"down" hosts cannot be reached, others have no tag yet. */
export function verifyOutcome(url: string, tagInstalled: boolean): Failure | null {
  const host = hostOf(url)
  if (!host) return { code: 'invalid', reason: 'That does not look like a website address.', fix: 'Enter an address like www.yourname.com.' }
  if (/blocked|down|offline/.test(host)) return { code: 'unreachable', reason: `We could not reach ${host}. The site did not answer (timeout).`, fix: 'Check that the site is online and not blocking our checker, then try again.' }
  if (/example|newamerican/.test(host) || tagInstalled) return null
  return { code: 'tag', reason: `We could not find the verification tag on ${host}.`, fix: 'Copy the tag into the <head> of your home page, or let us add it for you.' }
}

function baseScan(url: string, agent?: Pick<Agent, 'name' | 'title' | 'city' | 'phone'>): Scan {
  const host = hostOf(url)
  if (/newamerican/.test(host)) return SEED_SCAN
  const h = hash(host)
  const bit = (n: number) => ((h >> n) & 1) === 1
  const title = agent ? `${agent.name} | ${agent.title} in ${agent.city}` : host
  const fld = (n: number, v: string): Field => (bit(n) ? f(v) : none)
  return {
    nap: { name: f(agent?.name ?? host), address: fld(1, 'Birmingham, B1 1AA'), phone: fld(2, agent?.phone ?? '+44 121 555 0142') },
    loadTime: Math.round((1.4 + ((h >> 5) % 36) / 10) * 10) / 10,
    tags: { description: fld(3, 'Mortgage advice in Birmingham.'), title: f(title), robots: fld(4, 'index, follow'), language: fld(5, 'en-GB'), charset: f('UTF-8'), og: fld(6, 'og:title, og:description'), google: fld(7, 'google-site-verification'), twitter: fld(8, 'summary_large_image') },
    reviews: { widget: bit(9), schema: bit(10), count: bit(9) ? 2 + (h % 9) : 0 },
    security: { ssl: url.startsWith('https:'), expires: '2027-01-21', httpsRedirect: url.startsWith('https:') && bit(11) },
  }
}

/** The tag value we recommend for a missing tag (deterministic, from the profile). */
export function recommendedTag(id: TagId, agent: Pick<Agent, 'name' | 'title' | 'city'>, description?: string): { value: string; html: string } {
  const title = `${agent.name} | ${agent.title} in ${agent.city}`
  switch (id) {
    case 'description': return { value: description ?? '', html: `<meta name="description" content="${description ?? ''}">` }
    case 'title': return { value: title, html: `<title>${title}</title>` }
    case 'robots': return { value: 'index, follow', html: '<meta name="robots" content="index, follow">' }
    case 'language': return { value: 'en-GB', html: '<html lang="en-GB">' }
    case 'charset': return { value: 'UTF-8', html: '<meta charset="UTF-8">' }
    case 'og': return { value: 'og:title, og:description, og:image', html: `<meta property="og:title" content="${title}">\n<meta property="og:description" content="Mortgage advice from ${agent.name}">\n<meta property="og:image" content="/share.jpg">` }
    case 'google': return { value: 'google-site-verification', html: '<meta name="google-site-verification" content="paste-your-code">' }
    case 'twitter': return { value: 'summary_large_image', html: '<meta name="twitter:card" content="summary_large_image">' }
  }
}

/* ---------------- scoring ---------------- */

export interface Item { id: string; param: ParamId; label: string; ok: boolean; value: string; points: number; max: number; fix: string }
export interface Parameter { id: ParamId; label: string; max: number; points: number; items: Item[] }
export type LoadBand = 'good' | 'needs' | 'poor'
export const loadBand = (t: number): LoadBand => (t <= 2.5 ? 'good' : t <= 4 ? 'needs' : 'poor')
const LOAD_PTS: Record<LoadBand, number> = { good: 40, needs: 20, poor: 0 }

const it = (id: string, param: ParamId, label: string, ok: boolean, value: string, max: number, fix: string, points = ok ? max : 0): Item => ({ id, param, label, ok, value, points, max, fix })

/** Every checked item with its earned points. Empty until the site is scanned. */
export function websiteItems(s: WebsiteState): Item[] {
  const c = s.scan
  if (!c) return []
  const band = c.loadTime == null ? 'poor' : loadBand(c.loadTime)
  return [
    it('nap-name', 'nap', 'Name', c.nap.name.ok, c.nap.name.value, 14, 'Show your full name consistently in the header and footer.'),
    it('nap-address', 'nap', 'Work address', c.nap.address.ok, c.nap.address.value, 13, 'Add your office address to the footer or contact page, exactly as on your listings.'),
    it('nap-phone', 'nap', 'Phone number', c.nap.phone.ok, c.nap.phone.value, 13, 'Add a clickable phone number to the header and footer.'),
    it('load', 'load', 'Page load time', band === 'good', c.loadTime == null ? 'Not measured' : `${c.loadTime.toFixed(1)}s`, 40, 'Compress hero images, enable caching and remove unused scripts to get under 2.5 seconds.', LOAD_PTS[band]),
    ...TAGS.map((t) => it(`tag-${t.id}`, 'html', t.label, c.tags[t.id].ok, c.tags[t.id].value, t.points, `Add the ${t.label.toLowerCase()} tag to the <head> of your home page.`)),
    it('rev-widget', 'reviews', 'Review widget on page', c.reviews.widget, c.reviews.widget ? 'Widget found' : '', 16, 'Embed your Experience.com review widget on your home page.'),
    it('rev-schema', 'reviews', 'Review schema markup', c.reviews.schema, c.reviews.schema ? 'AggregateRating found' : '', 14, 'Add AggregateRating structured data so stars can appear in search results.'),
    it('rev-count', 'reviews', 'Review count shown', c.reviews.count > 0, c.reviews.count > 0 ? `${c.reviews.count} reviews shown` : '', 10, 'Show how many reviews you have next to your star rating.'),
    it('sec-ssl', 'security', 'SSL certificate valid', c.security.ssl, c.security.ssl ? `Expires ${c.security.expires}` : '', 28, 'Install a valid SSL certificate (most hosts offer one free) and renew it before it expires.'),
    it('sec-https', 'security', 'HTTPS redirect', c.security.httpsRedirect, c.security.httpsRedirect ? 'http redirects to https' : '', 12, 'Redirect all http:// traffic to https:// in your hosting settings.'),
  ]
}

export function websiteParameters(s: WebsiteState): Parameter[] {
  const items = websiteItems(s)
  return (Object.keys(PARAM_MAX) as ParamId[]).map((id) => {
    const own = items.filter((i) => i.param === id)
    return { id, label: PARAM_LABEL[id], max: PARAM_MAX[id], points: own.reduce((n, i) => n + i.points, 0), items: own }
  })
}

/** Contract: this module's contribution to the Search Rank Score, 0 to 250. 0 when the site is not verified or not scanned. */
export const websitePoints = (s: WebsiteState): number => (s.status === 'verified' && s.scan ? Math.min(WEBSITE_MAX, websiteItems(s).reduce((n, i) => n + i.points, 0)) : 0)

/** Failing items, most valuable first. */
export const websiteIssues = (s: WebsiteState): (Item & { gain: number })[] =>
  websiteItems(s).filter((i) => i.points < i.max).map((i) => ({ ...i, gain: i.id === 'load' ? i.max - i.points : i.max })).sort((a, b) => b.gain - a.gain)

/* ---------------- actions ---------------- */

const patch = (p: Partial<WebsiteState>) => websiteStore.set((s) => ({ ...s, ...p }))

/** Re-apply the fixes the owner confirmed on top of a fresh scan. */
function withFixes(base: Scan, s: WebsiteState): Scan {
  const c: Scan = JSON.parse(JSON.stringify(base))
  const has = (id: string) => s.fixes.includes(id)
  if (has('nap-name')) c.nap.name = f(c.nap.name.value || 'Agent Arjunan')
  if (has('nap-address')) c.nap.address = f('Birmingham, B1 1AA')
  if (has('nap-phone')) c.nap.phone = f(c.nap.phone.value || '+44 121 555 0142')
  if (has('load') && c.loadTime != null) c.loadTime = Math.min(c.loadTime, Math.max(1.8, Math.round((c.loadTime - 1.3) * 10) / 10))
  if (has('rev-widget')) c.reviews.widget = true
  if (has('rev-schema')) c.reviews.schema = true
  if (has('rev-count')) c.reviews.count = Math.max(c.reviews.count, 3)
  if (has('sec-ssl')) { c.security.ssl = true; c.security.expires = '2027-10-02' }
  if (has('sec-https')) c.security.httpsRedirect = true
  for (const t of TAGS) { const v = s.tagValues[t.id]; if (v) c.tags[t.id] = f(v) }
  return c
}

/* ---------------- live scan (server: /api/seo/audit) ---------------- */

interface AuditResponse {
  page: Record<'title' | 'description' | 'robots' | 'language' | 'charset' | 'og' | 'google' | 'twitter', string>
  nap: { name: boolean; phone: boolean; address: boolean }
  reviews: { widget: boolean; schema: boolean; count: number }
  security: { ssl: boolean; expires: string; httpsRedirect: boolean }
  load: { seconds: number | null }
  lighthouse: WebsiteState['lighthouse']
  notes: string[]
}

/** The demo and unreachable-on-purpose addresses never go to the network. */
const isDemoHost = (url: string): boolean => /example|newamerican|blocked|down|offline/.test(hostOf(url))

const REASON: Record<string, string> = {
  invalid_url: 'That address cannot be checked.', blocked_address: 'Private and local addresses cannot be checked.', unreachable: 'The site could not be reached.',
  not_html: 'That address is not a web page.', too_large: 'The page is too large to check.', rate_limited: 'Too many scans in a minute. Try again shortly.',
}

/** Maps the server's audit onto our Scan. Exported for tests. */
export function scanFromAudit(a: AuditResponse, agent?: Pick<Agent, 'name' | 'phone' | 'city'>): Scan {
  const fld = (ok: boolean, value: string): Field => (ok ? f(value) : none)
  const t = (v: string): Field => (v ? f(v) : none)
  return {
    nap: { name: fld(a.nap.name, agent?.name ?? 'Found on page'), address: fld(a.nap.address, agent?.city ?? 'Found on page'), phone: fld(a.nap.phone, agent?.phone ?? 'Found on page') },
    loadTime: a.load.seconds,
    tags: { description: t(a.page.description), title: t(a.page.title), robots: t(a.page.robots), language: t(a.page.language), charset: t(a.page.charset), og: t(a.page.og), google: t(a.page.google), twitter: t(a.page.twitter) },
    reviews: { widget: a.reviews.widget, schema: a.reviews.schema, count: a.reviews.count },
    security: { ssl: a.security.ssl, expires: a.security.expires, httpsRedirect: a.security.httpsRedirect },
  }
}

type LiveOutcome = { ok: true; scan: Scan; lighthouse: WebsiteState['lighthouse']; notes: string[] } | { ok: false; reason: string }

async function liveScan(url: string, agent?: Pick<Agent, 'name' | 'title' | 'city' | 'phone'>): Promise<LiveOutcome> {
  if (isDemoHost(url)) return { ok: false, reason: 'This is a demo address, so sample data is shown. Enter a real public website to run a live scan.' }
  try {
    const res = await fetch('/api/seo/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, nap: { name: agent?.name, phone: agent?.phone, address: agent?.city } }), signal: AbortSignal.timeout(100_000) })
    const body = (await res.json()) as AuditResponse & { error?: string; message?: string }
    if (!res.ok) return { ok: false, reason: body.message ?? REASON[body.error ?? ''] ?? 'The live scan is unavailable, so sample data is shown.' }
    return { ok: true, scan: scanFromAudit(body, agent), lighthouse: body.lighthouse, notes: body.notes }
  } catch {
    return { ok: false, reason: 'The live scan is unavailable here, so sample data is shown.' }
  }
}

export const websiteActions = {
  /** Normalise and store the address. Clears the previous verification and scan. Returns the stored URL ('' if invalid). */
  saveUrl(raw: string): string {
    const url = normalizeUrl(raw)
    if (!url) { patch({ url: raw.trim(), status: 'failed', failure: verifyOutcome('', false), scan: null, scannedAt: null, fixes: [], tagValues: {} }); return '' }
    patch({ url, status: 'none', failure: null, tagInstalled: false, scan: null, scannedAt: null, fixes: [], tagValues: {} })
    return url
  },
  /** Verify ownership (spinner, then verified or a failure with the reason). A verified site is scanned straight away. */
  async verify(agent?: Pick<Agent, 'name' | 'title' | 'city' | 'phone'>): Promise<boolean> {
    patch({ status: 'verifying', failure: null })
    await wait()
    const s = websiteStore.get()
    const fail = verifyOutcome(s.url, s.tagInstalled)
    if (fail) { patch({ status: 'failed', failure: fail }); return false }
    patch({ status: 'verified', failure: null })
    await websiteActions.scan(agent)
    return true
  },
  /** The "Add it for me" fix: places the tag on the site (mock), so the next check passes. */
  addTagForMe() { patch({ tagInstalled: true }) },
  async scan(agent?: Pick<Agent, 'name' | 'title' | 'city' | 'phone'>): Promise<void> {
    patch({ scanning: true })
    const s = websiteStore.get()
    const live = await liveScan(s.url, agent)
    if (live.ok) {
      patch({ scanning: false, scan: withFixes(live.scan, s), scannedAt: nowIso(), source: 'live', lighthouse: live.lighthouse, scanNote: live.notes.join(' ') })
      return
    }
    await wait(Math.round(latency * 2.5))
    patch({ scanning: false, scan: withFixes(baseScan(s.url, agent), s), scannedAt: nowIso(), source: 'sample', lighthouse: null, scanNote: live.reason })
  },
  /** Apply a missing tag the owner approved (a draft or the recommended value). */
  applyTag(id: TagId, value: string): void {
    const v = value.trim()
    if (!v) return
    websiteStore.set((s) => ({ ...s, tagValues: { ...s.tagValues, [id]: v }, scan: s.scan ? { ...s.scan, tags: { ...s.scan.tags, [id]: f(v) } } : s.scan }))
  },
  /** "Mark as fixed / Re-scan": remember the fix and scan again. */
  async markFixed(itemId: string, agent?: Pick<Agent, 'name' | 'title' | 'city' | 'phone'>): Promise<void> {
    websiteStore.set((s) => ({ ...s, fixes: s.fixes.includes(itemId) ? s.fixes : [...s.fixes, itemId] }))
    await websiteActions.scan(agent)
  },
}

/* ---------------- report and NORA ---------------- */

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** A self-contained, printable HTML report (no dependencies): open it and use Print / Save as PDF. */
export function buildReportHtml(s: WebsiteState, agentName: string, generatedAt: string = nowIso()): string {
  const total = websitePoints(s)
  const params = websiteParameters(s)
  const issues = websiteIssues(s)
  const rows = (p: Parameter) => p.items.map((i) => `<tr><td>${esc(i.label)}</td><td class="${i.points >= i.max ? 'ok' : i.points > 0 ? 'mid' : 'bad'}">${i.points >= i.max ? 'Available' : i.points > 0 ? 'Needs improvement' : 'Not available'}</td><td>${esc(i.value || '-')}</td><td class="r">${i.points}/${i.max}</td></tr>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Website report - ${esc(agentName)}</title><style>
body{font:14px/1.5 system-ui,sans-serif;color:#0f172a;max-width:780px;margin:32px auto;padding:0 20px}h1{margin:0}h2{margin:28px 0 8px;font-size:16px}
.hero{background:linear-gradient(135deg,#1e1b4b,#1d4ed8);color:#fff;border-radius:16px;padding:24px}.score{font-size:44px;font-weight:700}
.bar{height:8px;background:rgba(255,255,255,.25);border-radius:9px}.bar i{display:block;height:8px;background:#fff;border-radius:9px}
table{width:100%;border-collapse:collapse}td{padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:13px}.r{text-align:right}.ok{color:#047857}.mid{color:#b45309}.bad{color:#be123c}
.rec{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:6px 0}button{margin-top:16px;padding:8px 14px}@media print{button{display:none}}
</style></head><body><div class="hero"><div>Website report</div><h1>${esc(agentName)}</h1><div>${esc(s.url)}</div><div class="score">${total}<small>/${WEBSITE_MAX}</small></div><div class="bar"><i style="width:${Math.round((total / WEBSITE_MAX) * 100)}%"></i></div><div>Generated ${esc(generatedAt.slice(0, 10))}</div></div>
${params.map((p) => `<h2>${esc(p.label)} (${p.points}/${p.max})</h2><table>${rows(p)}</table>`).join('')}
<h2>Recommendations</h2>${issues.length ? issues.map((i) => `<div class="rec"><b>${esc(i.label)}</b> (+${i.gain} pts)<br>${esc(i.fix)}</div>`).join('') : '<p>Nothing to fix. Great work.</p>'}
<button onclick="window.print()">Print or save as PDF</button></body></html>`
}

/** What NORA says when asked "how is my website doing?" (live data). */
export const websiteAnswer = (): AiAnswer => {
  const s = websiteStore.get()
  if (s.status !== 'verified' || !s.scan) return { intro: s.url ? 'Your website is not verified yet, so it earns 0 of 250 points.' : 'You have not added your website yet. It is worth up to 250 points.', items: [{ title: 'Verify your site', detail: 'Add the verification tag or let NORA add it for you.' }], links: [{ label: 'Open Web Analytics', to: '/analytics' }] }
  const total = websitePoints(s)
  const issues = websiteIssues(s)
  const meta = issues.filter((i) => i.param === 'html').reduce((n, i) => n + i.gain, 0)
  return {
    intro: `Your website scores ${total} of ${WEBSITE_MAX}.${meta ? ` Fixing the meta tags is worth +${meta} points.` : ''}`,
    items: issues.length ? issues.slice(0, 4).map((i) => ({ title: `${i.label} (+${i.gain} pts)`, detail: i.fix })) : [{ title: 'Everything checks out', detail: 'All 250 points are earned.' }],
    links: [{ label: 'Open Web Analytics', to: '/analytics' }, { label: 'Search Rank Score', to: '/search-rank' }],
  }
}

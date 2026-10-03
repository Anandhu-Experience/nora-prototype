import type { AiAnswer } from '../profile/assistant'
import { agentHours, hoursSummary } from '../profile/details'
import { seedState } from '../profile/seed'
import { getState as getProfile } from '../profile/store'
import { cities as profileCities } from '../profile/selectors'
import { connectionsStore, isConnected } from './connections'
import { createStore, nowIso, uid, wait } from './persist'

export interface BusinessInfo { name: string; address: string; phone: string; category: string; website: string; hours: string; serviceArea: string; placeId: string }
export type InfoField = keyof BusinessInfo
export type SiteStatus = 'ready' | 'initiated' | 'in_process' | 'published' | 'failed'
export interface Site { id: string; name: string; status: SiteStatus; note: string; publishedAt: string; url: string; failsOnce?: boolean }
export type Range = '7D' | '1M' | '6M' | '1Y'
export interface ListingsState {
  info: BusinessInfo
  sites: Site[]
  /** Manager lock (demo switch): disables "Push to publish". */
  locked: boolean
  qaNoteDismissed: boolean
  range: Range
  reports: { id: string; range: Range; at: string; rows: number }[]
}

export const FIELD_LABEL: Record<InfoField, string> = { name: 'Business name', address: 'Address', phone: 'Phone', category: 'Category', website: 'Website', hours: 'Hours', serviceArea: 'Service area', placeId: 'Place ID' }
export const LOCK_MESSAGE = 'Publishing is locked by your manager. Ask them to unlock it before pushing your listings.'

const site = (id: string, name: string, status: SiteStatus, extra: Partial<Site> = {}): Site => ({ id, name, status, note: '', publishedAt: '', url: '', ...extra })

export const listingsStore = createStore<ListingsState>('nora-presence-listings-v2', () => ({
  info: { name: 'Agent Arjunan | New American Funding', address: '45 Colmore Row, Birmingham B3 2BH, UK', phone: '+44 121 496 0123', category: 'Mortgage broker', website: 'https://www.newamericanfunding.com/arjunan', hours: hoursSummary(agentHours(seedState().agents.arjunan!)), serviceArea: 'Birminghm', placeId: 'PENDING' },
  sites: [
    site('google', 'Google Business Profile', 'ready', { url: 'https://business.google.com' }),
    site('facebook', 'Facebook', 'published', { publishedAt: '2026-03-14T10:05:00.000Z', url: 'https://facebook.com/agentarjunan' }),
    site('yelp', 'Yelp', 'failed', { note: 'Needs phone verification', failsOnce: true, url: 'https://yelp.com' }),
    site('bing', 'Bing Places', 'published', { publishedAt: '2026-04-02T09:00:00.000Z', url: 'https://bingplaces.com' }),
    site('apple', 'Apple Maps', 'published', { publishedAt: '2026-05-21T12:30:00.000Z', url: 'https://maps.apple.com' }),
    site('foursquare', 'Foursquare', 'initiated', { note: 'Submitted, waiting for the directory', url: 'https://foursquare.com' }),
    site('yellowpages', 'Yellow Pages', 'ready', { url: 'https://yell.com' }),
    site('mapquest', 'MapQuest', 'ready', { url: 'https://mapquest.com' }),
    site('nextdoor', 'Nextdoor', 'ready', { url: 'https://nextdoor.com' }),
    site('bbb', 'Better Business Bureau', 'ready', { url: 'https://bbb.org' }),
    site('superpages', 'Superpages', 'ready', { url: 'https://superpages.com' }),
    site('manta', 'Manta', 'ready', { url: 'https://manta.com' }),
    site('hotfrog', 'Hotfrog', 'ready', { url: 'https://hotfrog.com' }),
    site('cylex', 'Cylex', 'ready', { url: 'https://cylex.com' }),
  ],
  locked: false, qaNoteDismissed: false, range: '1M', reports: [],
}))

/* ---------- validation and data issues ---------- */

const PHONE = /^\+?[\d\s().-]+$/
const PLACE_ID = /^ChIJ[\w-]{12,}$/
const CITY_REGION = /^[A-Za-z][A-Za-z .'-]+,\s*[A-Za-z][A-Za-z .'-]+$/

export const knownCities = (): string[] => profileCities(getProfile())

/** Service area must be a real city from the app's cities list, or a "City, Region" pattern. */
export function validServiceArea(v: string, cityList: string[] = knownCities()): boolean {
  const t = v.trim()
  return cityList.some((c) => c.toLowerCase() === t.toLowerCase()) || CITY_REGION.test(t)
}

/** Field errors for the business info (empty object when everything is valid). */
export function validateInfo(info: BusinessInfo, cityList: string[] = knownCities()): Partial<Record<InfoField, string>> {
  const e: Partial<Record<InfoField, string>> = {}
  for (const f of ['name', 'address', 'phone', 'category', 'serviceArea'] as const) if (!info[f].trim()) e[f] = `${FIELD_LABEL[f]} is required.`
  const digits = info.phone.replace(/\D/g, '').length
  if (info.phone.trim() && (!PHONE.test(info.phone.trim()) || digits < 7 || digits > 15)) e.phone = 'Enter a valid phone number, e.g. +44 121 496 0123.'
  if (info.website.trim()) { try { const u = new URL(info.website.trim()); if (!/^https?:$/.test(u.protocol)) throw new Error('p') } catch { e.website = 'Enter a full link starting with https://' } }
  if (info.serviceArea.trim() && !validServiceArea(info.serviceArea, cityList)) e.serviceArea = 'Use a real city (e.g. Birmingham) or the pattern "City, Region".'
  if (info.placeId.trim() && !PLACE_ID.test(info.placeId.trim())) e.placeId = 'That does not look like a Google place ID (it starts with ChIJ).'
  return e
}

export interface DataIssue { id: InfoField; message: string; points: number }
const ISSUE_MESSAGE: Partial<Record<InfoField, string>> = {
  serviceArea: 'Service area is invalid. Check the provider place ID and use a real city.',
  placeId: 'Place ID is missing or malformed, so directories cannot match your listing.',
  phone: 'Phone number is invalid. Directories will reject the listing.',
  website: 'Website link is invalid.',
}
/** Data issues are derived from the info, so they resolve the moment the data is fixed. */
export function dataIssues(info: BusinessInfo, cityList: string[] = knownCities()): DataIssue[] {
  const e = validateInfo(info, cityList)
  const placeMissing = !info.placeId.trim()
  return (['serviceArea', 'placeId', 'phone', 'website'] as const)
    .filter((f) => (f === 'placeId' ? placeMissing || !!e.placeId : !!e[f]))
    .map((f) => ({ id: f, message: ISSUE_MESSAGE[f]!, points: 12 }))
}

export interface FixProposal { field: InfoField; value: string; reason: string }
const hash = (s: string): string => { let h = 5381; for (const ch of s) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(36).toUpperCase() }

/** Deterministic AI fix proposal from the profile data. The user reviews it before it is applied. */
export function proposeFix(field: InfoField, info: BusinessInfo = listingsStore.get().info): FixProposal {
  const s = getProfile()
  const a = s.agents[s.viewerId]!
  const cityList = knownCities()
  switch (field) {
    case 'serviceArea': {
      const area = a.serviceAreas.find((c) => validServiceArea(c, cityList)) ?? a.location
      return { field, value: area, reason: `Taken from the service areas on your profile (${a.serviceAreas.join(', ') || a.location}).` }
    }
    case 'placeId':
      return { field, value: `ChIJ${hash(info.name + info.address).padEnd(8, 'x')}${hash(info.address).padEnd(8, 'x')}`, reason: 'Looked up from your business name and address on Google Maps.' }
    case 'phone':
      return { field, value: a.phone, reason: 'Taken from the phone number on your profile.' }
    case 'website':
      return { field, value: a.social.website || info.website, reason: 'Taken from the website on your profile.' }
    default:
      return { field, value: info[field], reason: 'No change needed.' }
  }
}

export function saveInfo(info: BusinessInfo): void { listingsStore.set((s) => ({ ...s, info: { ...info } })) }
export const applyFix = (p: FixProposal): void => listingsStore.set((s) => ({ ...s, info: { ...s.info, [p.field]: p.value } }))
export const setLocked = (locked: boolean): void => listingsStore.set((s) => ({ ...s, locked }))
export const dismissQaNote = (): void => listingsStore.set((s) => ({ ...s, qaNoteDismissed: true }))
export const setRange = (range: Range): void => listingsStore.set((s) => ({ ...s, range }))

/* ---------- scoring and summary ---------- */

/**
 * 0..100. 60 points from published/total sites. 40 points from business-info completeness (share of the 8 fields
 * filled), minus 12 per open data issue (floored at 0). Rises when sites publish or issues are resolved.
 */
export function listingsPoints(s: ListingsState): number {
  const published = s.sites.filter((x) => x.status === 'published').length
  const filled = (Object.keys(s.info) as InfoField[]).filter((f) => s.info[f].trim()).length
  const info40 = Math.max(0, 40 * (filled / 8) - dataIssues(s.info).length * 12)
  return Math.max(0, Math.min(100, Math.round(60 * (published / Math.max(1, s.sites.length)) + info40)))
}

export const listingsSummary = (s: ListingsState): { total: number; published: number; ready: number; issues: number } => ({
  total: s.sites.length,
  published: s.sites.filter((x) => x.status === 'published').length,
  ready: s.sites.filter((x) => x.status === 'ready').length,
  issues: dataIssues(s.info).length,
})
export const inProcessCount = (s: ListingsState): number => s.sites.filter((x) => x.status === 'initiated' || x.status === 'in_process').length

/* ---------- publishing ---------- */

const patch = (id: string, p: Partial<Site>) => listingsStore.set((s) => ({ ...s, sites: s.sites.map((x) => (x.id === id ? { ...x, ...p } : x)) }))

/** Why a site cannot be published right now (null when it can). */
export function publishBlocker(id: string): 'locked' | 'google' | null {
  const s = listingsStore.get()
  if (s.locked) return 'locked'
  if (id === 'google' && !isConnected(connectionsStore.get(), 'google')) return 'google'
  return null
}

/** initiated -> in-process -> published. A site flagged failsOnce fails the first time (needs verification). */
export async function publishSite(id: string): Promise<'published' | 'failed' | 'blocked'> {
  const x = listingsStore.get().sites.find((v) => v.id === id)
  if (!x || publishBlocker(id)) return 'blocked'
  patch(id, { status: 'initiated', note: 'Submitting' })
  await wait()
  patch(id, { status: 'in_process', note: 'Directory is processing' })
  await wait()
  if (x.failsOnce) { patch(id, { status: 'failed', note: 'Needs phone verification', failsOnce: false }); return 'failed' }
  patch(id, { status: 'published', note: '', publishedAt: nowIso() })
  return 'published'
}

/** Moves a pending site (initiated / in-process) to published. */
export async function refreshSite(id: string): Promise<void> {
  await wait()
  patch(id, { status: 'published', note: '', publishedAt: nowIso() })
}

export async function publishAllReady(): Promise<{ published: number; failed: number; skipped: number }> {
  const ids = listingsStore.get().sites.filter((x) => x.status === 'ready').map((x) => x.id)
  const res = await Promise.all(ids.map((id) => publishSite(id)))
  return { published: res.filter((r) => r === 'published').length, failed: res.filter((r) => r === 'failed').length, skipped: res.filter((r) => r === 'blocked').length }
}

/* ---------- analytics (mock, deterministic) ---------- */

export interface AnalyticsData { labels: string[]; maps: number[]; search: number[]; calls: number[]; directions: number[]; website: number[]; bookings: number[]; views: number; mapsTotal: number; searchTotal: number; actions: { calls: number; directions: number; website: number; bookings: number } }
const SIZE: Record<Range, number> = { '7D': 7, '1M': 30, '6M': 26, '1Y': 12 }
const SCALE: Record<Range, number> = { '7D': 1, '1M': 1, '6M': 7, '1Y': 30 }
const wave = (i: number, seed: number, base: number): number => Math.max(1, Math.round(base * (1 + 0.28 * Math.sin(i * 0.9 + seed) + 0.1 * Math.cos(i * 2.3 + seed * 2) + i * 0.012)))
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0)

export function listingsAnalytics(range: Range): AnalyticsData {
  const n = SIZE[range], k = SCALE[range]
  const mk = (seed: number, base: number) => Array.from({ length: n }, (_, i) => wave(i, seed, base * k))
  const labels = Array.from({ length: n }, (_, i) => range === '7D' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]! : range === '1M' ? `${i + 1} Sep` : range === '6M' ? `W${i + 1}` : ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i]!)
  const maps = mk(1, 22), search = mk(2, 34), calls = mk(3, 2), directions = mk(4, 3), website = mk(5, 4), bookings = mk(6, 1)
  return { labels, maps, search, calls, directions, website, bookings, views: sum(maps) + sum(search), mapsTotal: sum(maps), searchTotal: sum(search), actions: { calls: sum(calls), directions: sum(directions), website: sum(website), bookings: sum(bookings) } }
}

export function analyticsCsv(range: Range): string {
  const d = listingsAnalytics(range)
  const rows = d.labels.map((l, i) => [l, d.maps[i], d.search[i], d.calls[i], d.directions[i], d.website[i], d.bookings[i]].join(','))
  return ['Period,Google Maps views,Search views,Calls,Directions,Website clicks,Bookings', ...rows].join('\n')
}

export async function generateReport(range: Range): Promise<{ csv: string; filename: string }> {
  await wait()
  const csv = analyticsCsv(range)
  listingsStore.set((s) => ({ ...s, reports: [{ id: uid('rep'), range, at: nowIso(), rows: SIZE[range] }, ...s.reports].slice(0, 10) }))
  return { csv, filename: `listing-analytics-${range.toLowerCase()}.csv` }
}

/* ---------- NORA ---------- */

export function listingsAnswer(): AiAnswer {
  const s = listingsStore.get()
  const sm = listingsSummary(s)
  const issues = dataIssues(s.info)
  const google = isConnected(connectionsStore.get(), 'google')
  return {
    intro: `${sm.published} of ${sm.total} listing sites are published and ${sm.ready} are ready to go. Your listings earn ${listingsPoints(s)} of 100 points.`,
    items: [
      { title: issues.length ? `${issues.length} data issue${issues.length > 1 ? 's' : ''} to fix` : 'Business info is clean', detail: issues.length ? issues.map((i) => i.message).join(' ') : 'Name, address and phone match across directories.' },
      { title: `${sm.ready} sites ready to publish`, detail: s.locked ? LOCK_MESSAGE : issues.length ? 'Fix the data issues first so every directory gets correct details.' : 'Use "Publish to all ready" on the Publish tab.' },
      { title: google ? 'Google is connected' : 'Google is not connected', detail: google ? 'Analytics and publishing to Google Business Profile are available.' : 'Connect Google to publish to Google Business Profile and unlock listing analytics.' },
      ...(s.sites.some((x) => x.status === 'failed') ? [{ title: 'A site needs attention', detail: s.sites.filter((x) => x.status === 'failed').map((x) => `${x.name}: ${x.note}`).join('; ') }] : []),
    ],
    links: [{ label: 'Open Listings', to: '/listings' }, ...(google ? [] : [{ label: 'Connect Google', to: '/connections' }])],
  }
}

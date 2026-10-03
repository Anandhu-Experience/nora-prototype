import type { AiAnswer } from '../profile/assistant'
import { reviewSources } from '../profile/selectors'
import { getState } from '../profile/store'
import { connectionsStore, isConnected } from './connections'
import { createStore, nowIso, uid, wait } from './persist'
import { srsNow } from './srs'

/** Demo "today". All series end here so the numbers are stable. */
export const TODAY = '2026-10-02'
export const SRS_UNLOCK = 400

export type RangeId = 'yesterday' | '7d' | '15d' | '1m' | '6m' | '1y' | 'custom'
export const RANGES: { id: RangeId; label: string; long: string }[] = [
  { id: 'yesterday', label: 'Yesterday', long: 'yesterday' },
  { id: '7d', label: '7D', long: 'the last 7 days' },
  { id: '15d', label: '15D', long: 'the last 15 days' },
  { id: '1m', label: '1M', long: 'the last 30 days' },
  { id: '6m', label: '6M', long: 'the last 6 months' },
  { id: '1y', label: '1Y', long: 'the last 12 months' },
  { id: 'custom', label: 'Custom', long: 'the custom range' },
]

export type ReportType = 'traffic' | 'reviews' | 'listings' | 'full'
export type ReportFormat = 'PDF' | 'CSV' | 'XLSX'
export type Campaign = 'All' | 'Google Business Profile' | 'Facebook' | 'Website'
export const REPORT_TYPES: { id: ReportType; label: string }[] = [
  { id: 'traffic', label: 'Traffic summary' },
  { id: 'reviews', label: 'Review sources' },
  { id: 'listings', label: 'Listing performance' },
  { id: 'full', label: 'Full performance' },
]
export const CAMPAIGNS: Campaign[] = ['All', 'Google Business Profile', 'Facebook', 'Website']

export interface ReviewRequest {
  id: string
  name: string
  contact: string
  channel: 'Email' | 'SMS'
  message: string
  sentAt: string
  /** Where the request ends up: some clients open it and never review. Fixed at send time so it is deterministic. */
  outcome: 'reviewed' | 'opened'
}
export type RequestStatus = 'Sent' | 'Opened' | 'Reviewed'

export interface ReportEntry {
  id: string
  at: string
  type: ReportType
  format: ReportFormat
  campaign: Campaign
  start: string
  end: string
  status: 'Ready' | 'Failed'
}

export interface InsightsState {
  range: RangeId
  customStart: string
  customEnd: string
  requests: ReviewRequest[]
  reports: ReportEntry[]
}

export const insightsStore = createStore<InsightsState>('nora-presence-insights-v2', () => ({
  range: '1m',
  customStart: '2026-09-01',
  customEnd: TODAY,
  requests: [
    { id: 'rq-1', name: 'Hannah Whitfield', contact: 'hannah.w@example.com', channel: 'Email', message: 'Hi Hannah, thank you for choosing me for your mortgage. Would you leave a short review?', sentAt: '2026-09-12T10:00:00Z', outcome: 'reviewed' },
    { id: 'rq-2', name: 'Tom Okafor', contact: '+44 7700 900123', channel: 'SMS', message: 'Hi Tom, would you share a quick review of your home loan experience?', sentAt: '2026-09-20T15:30:00Z', outcome: 'opened' },
  ],
  reports: [
    { id: 'rp-1', at: '2026-09-15T09:00:00Z', type: 'traffic', format: 'PDF', campaign: 'All', start: '2026-08-17', end: '2026-09-15', status: 'Ready' },
    { id: 'rp-2', at: '2026-09-28T16:20:00Z', type: 'reviews', format: 'CSV', campaign: 'All', start: '2026-08-29', end: '2026-09-28', status: 'Ready' },
  ],
}))

/** Insights does not feed the Search Rank Score (the plan keeps them apart). Kept as a zero for the contract. */
export const insightsPoints = (_s: InsightsState): number => 0

/* ---------- dates ---------- */
const DAY = 86_400_000
export const toIso = (d: Date): string => d.toISOString().slice(0, 10)
export const addDays = (iso: string, n: number): string => toIso(new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY))
const diffDays = (a: string, b: string): number => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY)

export interface Win { start: string; end: string }
export const rangeError = (start: string, end: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 'Pick a start and an end date.'
  if (start > end) return 'The start date must be on or before the end date.'
  if (end > TODAY) return 'The end date cannot be in the future.'
  return null
}
export function windowFor(range: RangeId, customStart = '', customEnd = ''): Win {
  if (range === 'custom') return rangeError(customStart, customEnd) ? { start: addDays(TODAY, -29), end: TODAY } : { start: customStart, end: customEnd }
  if (range === 'yesterday') return { start: addDays(TODAY, -1), end: addDays(TODAY, -1) }
  const back = { '7d': 6, '15d': 14, '1m': 29, '6m': 182, '1y': 364 }[range]
  return { start: addDays(TODAY, -back), end: TODAY }
}
export const stateWindow = (s: InsightsState): Win => windowFor(s.range, s.customStart, s.customEnd)
export const previousWindow = (w: Win): Win => { const n = diffDays(w.start, w.end) + 1; return { start: addDays(w.start, -n), end: addDays(w.start, -1) } }
export const winLabel = (w: Win): string => (w.start === w.end ? w.start : `${w.start} to ${w.end}`)

/* ---------- deterministic mock series ---------- */
export type Metric = 'views' | 'impressions' | 'actions' | 'maps' | 'search' | 'calls' | 'directions' | 'clicks' | 'rvExperience' | 'rvGoogle' | 'rvFacebook'
const BASE: Record<Metric, number> = { views: 42, impressions: 310, actions: 14, maps: 150, search: 160, calls: 5, directions: 4, clicks: 5, rvExperience: 0.5, rvGoogle: 0.3, rvFacebook: 0.15 }

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}

/** One day of one metric: a base level, a weekly rhythm, a gentle upward trend towards today and per-day noise. */
export function dayValue(metric: Metric, day: string): number {
  const age = diffDays(day, TODAY)
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay()
  const weekly = dow === 0 || dow === 6 ? 0.7 : 1 + (dow === 3 ? 0.12 : 0)
  const trend = 1 + Math.max(0, 1 - age / 365) * 0.35
  const noise = 0.65 + hash(`${metric}:${day}`) * 0.7
  const v = BASE[metric] * weekly * trend * noise
  return BASE[metric] < 1 ? (hash(`r:${metric}:${day}`) < v ? 1 + (hash(`n:${metric}:${day}`) > 0.8 ? 1 : 0) : 0) : Math.round(v)
}

export interface Series { labels: string[]; values: number[]; total: number }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dm = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`

/** The series for a window: hourly for one day, daily up to ~2 months, weekly up to ~8 months, monthly beyond. */
export function series(metric: Metric, w: Win): Series {
  const n = diffDays(w.start, w.end) + 1
  const days = Array.from({ length: n }, (_, i) => addDays(w.start, i))
  const daily = days.map((d) => dayValue(metric, d))
  const total = daily.reduce((a, b) => a + b, 0)
  if (n === 1) {
    const shape = Array.from({ length: 24 }, (_, h) => 0.3 + Math.sin(((h - 6) / 24) * Math.PI * 2) * 0.5 + 0.55 + hash(`${metric}:${w.start}:${h}`) * 0.4)
    const sum = shape.reduce((a, b) => a + b, 0)
    const values = shape.map((s) => Math.floor((s / sum) * total))
    values[values.indexOf(Math.max(...values))]! += total - values.reduce((a, b) => a + b, 0)
    return { labels: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`), values, total }
  }
  if (n <= 62) return { labels: days.map(dm), values: daily, total }
  const bucket = (keyOf: (d: string) => string, labelOf: (d: string) => string): Series => {
    const map = new Map<string, { label: string; v: number }>()
    days.forEach((d, i) => { const k = keyOf(d); const e = map.get(k) ?? { label: labelOf(d), v: 0 }; e.v += daily[i]!; map.set(k, e) })
    const es = [...map.values()]
    return { labels: es.map((e) => e.label), values: es.map((e) => e.v), total }
  }
  if (n <= 240) return bucket((d) => String(Math.floor(diffDays(w.start, d) / 7)), dm)
  return bucket((d) => d.slice(0, 7), (d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`)
}

export const totalOf = (metric: Metric, w: Win): number => series(metric, w).total
export interface Delta { total: number; previous: number; pct: number; dir: 'up' | 'down' | 'flat' }
export function delta(metric: Metric, w: Win): Delta {
  const total = totalOf(metric, w)
  const previous = totalOf(metric, previousWindow(w))
  const pct = previous ? Math.round(((total - previous) / previous) * 100) : 0
  return { total, previous, pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

/** Reviews by source over a window, with the three series the Review Sources chart plots. */
export function reviewSeries(w: Win): { labels: string[]; experience: number[]; google: number[]; facebook: number[] } {
  const e = series('rvExperience', w)
  return { labels: e.labels, experience: e.values, google: series('rvGoogle', w).values, facebook: series('rvFacebook', w).values }
}

/* ---------- unlock (the plan's "3 steps") ---------- */
export interface UnlockStep { id: 'pro' | 'google' | 'srs'; label: string; done: boolean }
export function unlock(pro: boolean, google: boolean, srsTotal: number): { steps: UnlockStep[]; unlocked: boolean; gap: number } {
  const steps: UnlockStep[] = [
    { id: 'pro', label: 'Pro member', done: pro },
    { id: 'google', label: 'Connect Google', done: google },
    { id: 'srs', label: `Reach an SRS of ${SRS_UNLOCK}`, done: srsTotal >= SRS_UNLOCK },
  ]
  return { steps, unlocked: steps.every((s) => s.done), gap: Math.max(0, SRS_UNLOCK - srsTotal) }
}
/** Google-sourced charts need steps 2 and 3 (the viewer is a Pro member). */
export const googleUnlocked = (googleConnected: boolean, srsTotal: number): boolean => googleConnected && srsTotal >= SRS_UNLOCK

/* ---------- review requests ---------- */
export const REQUEST_OPEN_MS = 5000
export const REQUEST_DONE_MS = 12000
export function requestStatus(r: ReviewRequest, now = Date.now()): RequestStatus {
  const age = now - new Date(r.sentAt).getTime()
  if (age < REQUEST_OPEN_MS) return 'Sent'
  if (age < REQUEST_DONE_MS || r.outcome === 'opened') return 'Opened'
  return 'Reviewed'
}
export const validateRequest = (name: string, contact: string, channel: 'Email' | 'SMS'): { name?: string; contact?: string } => {
  const e: { name?: string; contact?: string } = {}
  if (name.trim().length < 2) e.name = 'Enter the client name.'
  const c = contact.trim()
  if (channel === 'Email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) : c.replace(/\D/g, '').length < 7 || !/^[+\d\s().-]+$/.test(c)) e.contact = channel === 'Email' ? 'Enter a valid email address.' : 'Enter a valid phone number.'
  return e
}
export const requestTemplate = (clientName: string, agentFirst: string): string =>
  `Hi ${clientName.trim().split(' ')[0] || 'there'}, it was a pleasure helping you with your home loan. If you have a minute, would you share a short review? It helps other home buyers find a loan officer they can trust. Thank you, ${agentFirst}`

export function sendReviewRequest(input: { name: string; contact: string; channel: 'Email' | 'SMS'; message: string }): ReviewRequest {
  const r: ReviewRequest = { id: uid('rq'), name: input.name.trim(), contact: input.contact.trim(), channel: input.channel, message: input.message.trim(), sentAt: nowIso(), outcome: hash(input.name.trim().toLowerCase()) < 0.65 ? 'reviewed' : 'opened' }
  insightsStore.set((s) => ({ ...s, requests: [r, ...s.requests] }))
  return r
}
/** Requests sent in the current calendar month (the real clock: new requests are stamped with it). */
export const requestsThisMonth = (s: InsightsState, now = nowIso()): number => s.requests.filter((r) => r.sentAt.slice(0, 7) === now.slice(0, 7)).length

/** Requests per day over a window, for the Review Requests chart (sent vs reviewed). */
export function requestSeries(reqs: ReviewRequest[], w: Win, now = Date.now()): { labels: string[]; sent: number[]; reviewed: number[] } {
  const n = Math.min(diffDays(w.start, w.end) + 1, 60)
  const days = Array.from({ length: n }, (_, i) => addDays(w.end, -(n - 1 - i)))
  return {
    labels: days.map(dm),
    sent: days.map((d) => reqs.filter((r) => r.sentAt.slice(0, 10) === d).length),
    reviewed: days.map((d) => reqs.filter((r) => r.sentAt.slice(0, 10) === d && requestStatus(r, now) === 'Reviewed').length),
  }
}

/* ---------- reports ---------- */
export const reportName = (t: ReportType): string => REPORT_TYPES.find((x) => x.id === t)!.label
const SHARE: Record<Campaign, number> = { All: 1, 'Google Business Profile': 0.55, Facebook: 0.25, Website: 0.2 }
const LISTING_SITES = ['Google Business Profile', 'Facebook', 'Yelp', 'Bing Places', 'Apple Maps', 'Zillow']
const SITE_WEIGHT = [0.4, 0.2, 0.14, 0.1, 0.09, 0.07]

/** The table behind a report (first row is the header). Deterministic for a window and campaign. */
export function buildReportRows(type: ReportType, w: Win, campaign: Campaign, counts?: { source: string; count: number; avg: number }[]): string[][] {
  const k = SHARE[campaign]
  const sc = (m: Metric) => Math.round(totalOf(m, w) * k)
  const rows: string[][] = [[`${reportName(type)}`, `${w.start} to ${w.end}`, `Campaign: ${campaign}`], []]
  const traffic = () => {
    rows.push(['Metric', 'Total', 'Change vs previous period'])
    ;(['views', 'impressions', 'actions'] as Metric[]).forEach((m) => {
      const d = delta(m, w)
      rows.push([m === 'views' ? 'Page views' : m === 'impressions' ? 'Impressions' : 'Google actions', String(Math.round(d.total * k)), `${d.pct}%`])
    })
    rows.push(['Impressions on Maps', String(sc('maps')), ''], ['Impressions on Search', String(sc('search')), ''], ['Calls', String(sc('calls')), ''], ['Directions', String(sc('directions')), ''], ['Website clicks', String(sc('clicks')), ''])
  }
  const reviews = () => {
    rows.push(['Source', 'New reviews in period', 'Reviews on profile', 'Average rating'])
    const live = (src: string) => counts?.find((c) => c.source === src)
    ;([['Experience.com', 'rvExperience'], ['Google', 'rvGoogle'], ['Facebook', 'rvFacebook']] as [string, Metric][]).forEach(([src, m]) => rows.push([src, String(totalOf(m, w)), String(live(src)?.count ?? ''), live(src)?.count ? (live(src)!.avg).toFixed(1) : '']))
  }
  const listings = () => {
    rows.push(['Listing site', 'Views', 'Clicks'])
    LISTING_SITES.forEach((s, i) => rows.push([s, String(Math.round(totalOf('impressions', w) * k * SITE_WEIGHT[i]!)), String(Math.round(totalOf('actions', w) * k * SITE_WEIGHT[i]!))]))
  }
  if (type === 'traffic') traffic()
  else if (type === 'reviews') reviews()
  else if (type === 'listings') listings()
  else { traffic(); rows.push([]); reviews(); rows.push([]); listings() }
  return rows
}
const esc = (c: string, sep: string) => (sep === ',' && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)
export const rowsToText = (rows: string[][], sep: ',' | '\t'): string => rows.map((r) => r.map((c) => esc(c, sep)).join(sep)).join('\n')
export const reportFileName = (e: Pick<ReportEntry, 'type' | 'format' | 'start' | 'end'>): string => `${e.type}-report-${e.start}-to-${e.end}.${e.format === 'CSV' ? 'csv' : e.format === 'XLSX' ? 'xls' : 'html'}`

/** Generate a report: a spinner for wait(), then it joins the activity feed. */
export async function generateReport(input: { type: ReportType; format: ReportFormat; campaign: Campaign; start: string; end: string }): Promise<ReportEntry> {
  await wait()
  const e: ReportEntry = { id: uid('rp'), at: nowIso(), ...input, status: 'Ready' }
  insightsStore.set((s) => ({ ...s, reports: [e, ...s.reports] }))
  return e
}

export const setRange = (range: RangeId): void => insightsStore.set((s) => ({ ...s, range }))
export function setCustomRange(start: string, end: string): string | null {
  const err = rangeError(start, end)
  if (!err) insightsStore.set((s) => ({ ...s, range: 'custom', customStart: start, customEnd: end }))
  return err
}

/* ---------- NORA ---------- */
const sign = (n: number) => `${n > 0 ? '+' : ''}${n}%`

/** Suggestions for the AiInsightBar come from here so tests can check them without JSX. */
export function insightFacts(s: InsightsState, google: boolean, srsTotal: number) {
  const w = stateWindow(s)
  const views = delta('views', w), imp = delta('impressions', w), act = delta('actions', w)
  return { w, views, imp, act, sentThisMonth: requestsThisMonth(s), unlock: unlock(true, google, srsTotal), unlocked: googleUnlocked(google, srsTotal) }
}

export function insightsAnswer(): AiAnswer {
  const s = insightsStore.get()
  const state = getState()
  const me = state.agents[state.viewerId]!
  const srs = srsNow(me).total
  const f = insightFacts(s, isConnected(connectionsStore.get(), 'google'), srs)
  const src = reviewSources(me)
  const total = src.reduce((n, x) => n + x.count, 0)
  return {
    intro: `For ${winLabel(f.w)}: ${f.views.total} page views (${sign(f.views.pct)}), ${f.imp.total} impressions (${sign(f.imp.pct)}) and ${f.act.total} Google actions (${sign(f.act.pct)}) versus the previous period.`,
    items: [
      { title: 'Traffic trend', detail: f.views.pct >= 0 ? 'Views are holding up. Keep publishing and answering reviews to protect it.' : 'Views dipped. Fresh content and new reviews usually bring them back.' },
      { title: 'Review sources', detail: total ? src.map((x) => `${x.source} ${x.count}`).join(', ') + ` (${total} reviews on your profile).` : 'No reviews yet. Send a review request to start.' },
      { title: 'Review requests', detail: f.sentThisMonth ? `You sent ${f.sentThisMonth} this month.` : 'You have sent none this month.' },
      { title: 'Google insights', detail: f.unlocked ? 'Unlocked: Google views, impressions and actions are live.' : `Locked until Google is connected and your Search Rank Score reaches ${SRS_UNLOCK} (now ${srs}).` },
    ],
    links: [{ label: 'Open Insights', to: '/insights' }, ...(f.unlocked ? [] : [{ label: 'Improve my score', to: '/search-rank' }])],
  }
}

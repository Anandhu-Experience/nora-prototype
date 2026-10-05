import { useSyncExternalStore } from 'react'
import { PROFILE_WEIGHTS } from '../mock/rules'
import { agentCompleteness, agentGaps, ratingStats } from '../profile/selectors'
import type { Agent } from '../profile/types'
import { connectionMeta, connectionsPoints, connectionsStore, missingConnections, type ConnectionId, type ConnectionsState } from './connections'
import { FIELD_LABEL as LISTING_FIELD, dataIssues, listingsPoints, listingsStore, type BusinessInfo, type ListingsState } from './listings'
import { subscribeAllPresence } from './persist'
import { websiteIssues, websitePoints, websiteStore } from './website'

/** Search Rank Score: out of 850, the sum of five drivers (the plan's composition). */
export const SRS_MAX = 850
export type DriverId = 'profile' | 'website' | 'reviews' | 'listings' | 'connections'

export interface Driver {
  id: DriverId
  label: string
  points: number
  max: number
  /** Where the user goes to improve this driver. */
  to: string
}

export interface Srs {
  total: number
  max: number
  drivers: Driver[]
}

export const DRIVER_MAX: Record<DriverId, number> = { profile: 100, website: 250, reviews: 300, listings: 100, connections: 100 }

/** Points for each public reply, and the most they can earn together. Replies score in V2; the value is assumed here (the architecture doc gives none). */
export const REPLY_POINTS = 1
export const REPLY_CAP = 75

/** Reviews driver: rating quality, volume (up to 20 reviews) and replies, capped at 300. */
export function reviewsPoints(a: Agent): number {
  const r = ratingStats(a.reviews)
  const replies = a.reviews.filter((x) => x.reply?.trim()).length
  return Math.min(DRIVER_MAX.reviews, Math.round((r.avg / 5) * 200 + Math.min(r.count, 20) * 5 + Math.min(REPLY_CAP, replies * REPLY_POINTS)))
}

/** The score bands V2 uses. */
export const BANDS = [
  { id: 'poor', label: 'Poor', min: 0, max: 349 },
  { id: 'fair', label: 'Fair', min: 350, max: 499 },
  { id: 'good', label: 'Good', min: 500, max: 649 },
  { id: 'excellent', label: 'Excellent', min: 650, max: 850 },
] as const
export const bandOf = (total: number): (typeof BANDS)[number] => BANDS.find((b) => total <= b.max) ?? BANDS[3]

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, Math.round(n)))

/** Pure: the score for an agent given the points of the other modules. */
export function computeSrs(a: Agent, p: { website: number; listings: number; connections: number }): Srs {
  const drivers: Driver[] = [
    { id: 'profile', label: 'Profile', points: clamp(agentCompleteness(a), 100), max: DRIVER_MAX.profile, to: '/profile' },
    { id: 'website', label: 'Web Analytics', points: clamp(p.website, 250), max: DRIVER_MAX.website, to: '/analytics' },
    { id: 'reviews', label: 'Reviews', points: reviewsPoints(a), max: DRIVER_MAX.reviews, to: '/profile?tab=reviews' },
    { id: 'listings', label: 'Listings', points: clamp(p.listings, 100), max: DRIVER_MAX.listings, to: '/listings' },
    { id: 'connections', label: 'Connections', points: clamp(p.connections, 100), max: DRIVER_MAX.connections, to: '/connections' },
  ]
  return { total: drivers.reduce((n, d) => n + d.points, 0), max: SRS_MAX, drivers }
}

/** Non-hook read of the live score (for NORA's answers and tests). */
export const srsNow = (a: Agent): Srs =>
  computeSrs(a, { website: websitePoints(websiteStore.get()), listings: listingsPoints(listingsStore.get()), connections: connectionsPoints(connectionsStore.get()) })

/** The live score, re-rendering whenever the profile or any module changes. `a` already subscribes the caller to the profile store. */
export function useSrs(a: Agent): Srs {
  // a cheap version counter keeps the snapshot stable between changes
  const version = useSyncExternalStore(subscribeAllPresence, () => versionNow())
  void version
  return srsNow(a)
}

/** Changes whenever any presence store changes, derived from the three point values. */
const versionNow = (): string => `${websitePoints(websiteStore.get())}|${listingsPoints(listingsStore.get())}|${connectionsPoints(connectionsStore.get())}`

/** Mock peers in the same location, for the leaderboard (their drivers are fixed demo data). */
export interface Peer { id: string; name: string; title: string; rating: number; reviews: number; score: number }
export const PEERS: Peer[] = [
  { id: 'p1', name: 'Mark Bragaw', title: 'Loan Officer', rating: 4.29, reviews: 24, score: 612 },
  { id: 'p2', name: 'Priya Natarajan', title: 'Mortgage Broker', rating: 4.8, reviews: 61, score: 571 },
  { id: 'p3', name: 'James Mike', title: 'Loan Officer', rating: 4.0, reviews: 9, score: 428 },
  { id: 'p4', name: 'Sofia Alvarez', title: 'Home Loan Advisor', rating: 4.55, reviews: 33, score: 366 },
  { id: 'p5', name: 'Tier Manager', title: 'Branch Manager', rating: 3.46, reviews: 87, score: 301 },
]

/** The leaderboard with the viewer slotted in by score. */
export function leaderboard(a: Agent, srs: Srs): { rank: number; me: boolean; id: string; name: string; title: string; rating: number; reviews: number; score: number }[] {
  const r = ratingStats(a.reviews)
  const rows = [...PEERS.map((p) => ({ ...p, me: false })), { id: a.id, name: a.name, title: a.title, rating: r.avg, reviews: r.count, score: srs.total, me: true }]
  return rows.sort((x, y) => y.score - x.score).map((row, i) => ({ ...row, rank: i + 1 }))
}

/* ---------------- simulate: what a change is worth, without making it ---------------- */

/** A change to price before it is made. Nothing here writes to a store. */
export interface SimChange {
  /** Connect these accounts. */
  connect?: ConnectionId[]
  /** Post a reply on these reviews (a reply text is assumed). */
  reply?: string[]
  /** Fields of the profile after the change, e.g. its specialties. */
  profile?: Partial<Agent>
  /** Business info fields of the listing after a fix. */
  listingInfo?: Partial<BusinessInfo>
  /** Publish these listing sites. */
  publish?: string[]
}

export interface Simulation {
  before: Srs
  after: Srs
  delta: number
  /** Drivers that move, with their points before and after. */
  lines: { id: DriverId; label: string; before: number; after: number }[]
  rankBefore: number
  rankAfter: number
  of: number
}

const withConnected = (s: ConnectionsState, ids: ConnectionId[]): ConnectionsState =>
  ({ conns: { ...s.conns, ...Object.fromEntries(ids.map((id) => [id, { ...s.conns[id], connected: true }])) } })

/**
 * The same maths as the live score, run on a copy with the change applied (the architecture doc's `score.simulate`).
 * The browser holds the data, so this is exact for the prototype; in V2 the scoring service owns it.
 */
export function simulate(a: Agent, change: SimChange): Simulation {
  const before = srsNow(a)
  const patched: Agent = {
    ...a,
    ...change.profile,
    reviews: a.reviews.map((r) => (change.reply?.includes(r.id) && !r.reply?.trim() ? { ...r, reply: 'reply' } : r)),
  }
  const conns = change.connect?.length ? withConnected(connectionsStore.get(), change.connect) : connectionsStore.get()
  const ls = listingsStore.get()
  const listings: ListingsState = change.listingInfo || change.publish?.length
    ? { ...ls, info: { ...ls.info, ...change.listingInfo }, sites: ls.sites.map((x) => (change.publish?.includes(x.id) ? { ...x, status: 'published' as const } : x)) }
    : ls
  const after = computeSrs(patched, { website: websitePoints(websiteStore.get()), listings: listingsPoints(listings), connections: connectionsPoints(conns) })
  const lines = after.drivers.flatMap((d, i) => (d.points !== before.drivers[i]!.points ? [{ id: d.id, label: d.label, before: before.drivers[i]!.points, after: d.points }] : []))
  const rank = (srs: Srs) => leaderboard(a, srs).find((r) => r.me)!.rank
  return { before, after, delta: after.total - before.total, lines, rankBefore: rank(before), rankAfter: rank(after), of: PEERS.length + 1 }
}

/* ---------------- explain: why the score is what it is ---------------- */

/** One driver of the score, with what earned its points and what is missing. Built from the same stores the score reads. */
export interface ScoreLine {
  id: DriverId
  label: string
  points: number
  max: number
  /** What earned the points. */
  contributes: string[]
  /** What is not earning points yet, and what it would add. */
  missing: string[]
  to: string
}

export const GAP_LABEL: Record<string, string> = { photoUrl: 'photo', headline: 'headline', phone: 'phone number', location: 'location', bio: 'bio', specialties: 'at least 5 specialties', name: 'name' }

export function explainSrs(a: Agent): ScoreLine[] {
  const srs = srsNow(a)
  const by = (id: DriverId) => srs.drivers.find((d) => d.id === id)!
  const gaps = agentGaps(a)
  const r = ratingStats(a.reviews)
  const replies = a.reviews.filter((x) => x.reply?.trim()).length
  const conns = connectionsStore.get()
  const connected = Object.entries(conns.conns).filter(([, c]) => c.connected).map(([id]) => id)
  const ls = listingsStore.get()
  const published = ls.sites.filter((x) => x.status === 'published').length
  const web = websiteStore.get()
  const issues = dataIssues(ls.info)
  const line = (id: DriverId, contributes: string[], missing: string[]): ScoreLine => ({ id, label: by(id).label, points: by(id).points, max: by(id).max, contributes, missing, to: by(id).to })
  return [
    line('profile',
      [`${by('profile').points} of 100 from the profile fields filled in`],
      gaps.map((g) => `${GAP_LABEL[g] ?? g}: +${PROFILE_WEIGHTS[g as keyof typeof PROFILE_WEIGHTS] ?? 0}`)),
    line('website',
      web.status === 'verified' ? [`${by('website').points} of 250 from the website audit`] : ['No points yet: the website is not verified'],
      web.status === 'verified' ? websiteIssues(web).slice(0, 3).map((i) => `${i.label}: +${i.gain}`) : ['Verify the website: up to +250']),
    line('reviews',
      [`Rating ${r.avg.toFixed(1)} of 5 and ${r.count} review${r.count === 1 ? '' : 's'}`, `${replies} public repl${replies === 1 ? 'y' : 'ies'}`],
      [...(a.reviews.length - replies > 0 ? [`${a.reviews.length - replies} review${a.reviews.length - replies === 1 ? '' : 's'} without a reply: +${REPLY_POINTS} each`] : []), ...(r.count < 20 ? [`${20 - r.count} more reviews: +5 each`] : [])]),
    line('listings',
      [`${published} of ${ls.sites.length} sites published`, ...(issues.length ? [] : ['Business info has no open data issues'])],
      [...ls.sites.filter((x) => x.status === 'ready').slice(0, 2).map((x) => `Publish ${x.name}`), ...issues.slice(0, 2).map((i) => `Fix ${LISTING_FIELD[i.id].toLowerCase()}: +${i.points}`)]),
    line('connections',
      connected.length ? [`Connected: ${connected.map((id) => connectionMeta(id as ConnectionId).name).join(', ')}`] : ['No accounts connected'],
      missingConnections(conns).slice(0, 3).map((m) => `Connect ${m.name}: +${m.points}`)),
  ]
}

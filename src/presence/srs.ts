import { useSyncExternalStore } from 'react'
import { agentCompleteness, ratingStats } from '../profile/selectors'
import type { Agent } from '../profile/types'
import { connectionsPoints, connectionsStore } from './connections'
import { listingsPoints, listingsStore } from './listings'
import { subscribeAllPresence } from './persist'
import { websitePoints, websiteStore } from './website'

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

/** Reviews driver: rating quality plus volume (up to 20 reviews), capped at 300. */
export function reviewsPoints(a: Agent): number {
  const r = ratingStats(a.reviews)
  return Math.min(DRIVER_MAX.reviews, Math.round((r.avg / 5) * 200 + Math.min(r.count, 20) * 5))
}

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

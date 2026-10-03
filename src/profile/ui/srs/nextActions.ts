import * as connections from '../../../presence/connections'
import * as listings from '../../../presence/listings'
import { websiteIssues, websiteStore } from '../../../presence/website'
import { agentCompleteness, recommendedActions } from '../../selectors'
import type { Agent } from '../../types'
import { ratingStats } from '../../selectors'
import { DRIVER_MAX } from '../../../presence/srs'

export interface NextAction {
  id: string
  title: string
  detail: string
  /** Score points available. */
  points: number
  /** Rough effort, 1 (one click) to 5 (a project). */
  effort: number
  /** Where the action happens. */
  to: string
  /** 'profile' actions run NORA's profile skill instead of navigating. */
  fix?: 'profile'
}

/** The other slices are built in parallel and may still be stubs, so read them defensively. */
const conn = connections as unknown as { isConnected?: (s: unknown, id: string) => boolean; connectionsStore?: { get: () => unknown } }
const list = listings as unknown as { listingsSummary?: (s: unknown) => { total: number; published: number; ready: number; issues: number }; listingsStore?: { get: () => unknown } }

const CONNECT: { id: string; label: string; points: number }[] = [
  { id: 'google', label: 'Google', points: 30 },
  { id: 'x', label: 'X', points: 10 },
  { id: 'instagram', label: 'Instagram', points: 10 },
  { id: 'youtube', label: 'YouTube', points: 10 },
]

/** Things that would raise the Search Rank Score, ranked by points per effort. Built from the live modules. */
export function nextActions(agent: Agent): NextAction[] {
  const out: NextAction[] = []

  if (conn.isConnected && conn.connectionsStore) {
    const s = conn.connectionsStore.get()
    for (const c of CONNECT) if (!conn.isConnected(s, c.id)) out.push({ id: `connect-${c.id}`, title: `Connect ${c.label}`, detail: c.id === 'google' ? 'Google is worth the most: it also unlocks Insights and Listings analytics.' : `Linking ${c.label} adds to your Connections score.`, points: c.points, effort: 1, to: '/connections' })
  }

  if (list.listingsSummary && list.listingsStore) {
    const l = list.listingsSummary(list.listingsStore.get())
    if (l.ready > 0 && l.total > 0) out.push({ id: 'publish-listings', title: `Publish ${l.ready} ready listing${l.ready === 1 ? '' : 's'}`, detail: 'These listings have complete data and only need publishing.', points: Math.max(1, Math.round((l.ready / l.total) * DRIVER_MAX.listings)), effort: 2, to: '/listings' })
    if (l.issues > 0) out.push({ id: 'fix-listings', title: `Fix ${l.issues} listing data issue${l.issues === 1 ? '' : 's'}`, detail: 'Inconsistent business details keep listings from going live.', points: Math.max(1, Math.round((l.issues / Math.max(1, l.total)) * 50)), effort: 3, to: '/listings' })
  }

  const site = websiteStore.get()
  if (site.status !== 'verified') out.push({ id: 'verify-site', title: 'Verify your website', detail: 'An unverified site earns 0 of 250 points.', points: 150, effort: 2, to: '/analytics' })
  else for (const i of websiteIssues(site).slice(0, 4)) out.push({ id: `site-${i.id}`, title: i.id === 'tag-description' ? 'Add meta description' : i.id === 'load' ? 'Speed up your site' : `Fix ${i.label.toLowerCase()}`, detail: i.fix, points: i.gain, effort: i.id === 'tag-description' || i.id.startsWith('tag-') ? 1 : i.id === 'load' ? 4 : 2, to: '/analytics' })

  const gaps = recommendedActions(agent)
  if (gaps.length) {
    const each = Math.max(1, Math.round((100 - agentCompleteness(agent)) / gaps.length))
    for (const g of gaps) out.push({ id: `profile-${g.id}`, title: g.title, detail: g.description, points: each, effort: g.id === 'specialties' ? 1 : 2, to: g.id === 'specialties' ? '/profile' : '/profile?edit=1', fix: g.id === 'specialties' ? 'profile' : undefined })
  }

  const r = ratingStats(agent.reviews)
  if (r.count < 20) out.push({ id: 'ask-reviews', title: `Request ${Math.min(5, 20 - r.count)} more reviews`, detail: 'Each review adds 5 points, up to 20 reviews.', points: Math.min(5, 20 - r.count) * 5, effort: 3, to: `/profile/${agent.id}?tab=reviews` })

  return out.sort((a, b) => b.points / b.effort - a.points / a.effort || b.points - a.points)
}

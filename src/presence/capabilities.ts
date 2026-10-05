import { agentCompleteness, agentGaps, ratingStats } from '../profile/selectors'
import type { Agent } from '../profile/types'
import { connectionsStore, CONNECTIONS, isConnected } from './connections'
import { totalOf, windowFor } from './insights'
import { listingsStore } from './listings'
import { napConflicts } from './nap'
import { collectIssues, type CapabilityId, type OsIssue } from './noraOs'
import { bandOf, GAP_LABEL, leaderboard, srsNow } from './srs'
import { authorityScore, publishedCount, voceStore } from './voce'

/**
 * The health of each V3 capability area, for the overview. Nothing is scored here: every number is one the app already
 * has (the score's drivers, the profile completeness rules, review counts, the content authority score).
 */
export interface CapabilityHealth {
  id: CapabilityId
  label: string
  /** 0 to 100, taken from an existing figure; the headline says which. */
  pct: number
  headline: string
  detail: string
  /** From the open issues only: critical if any is high priority, attention if any is open. */
  status: 'healthy' | 'attention' | 'critical'
  issues: OsIssue[]
  top: OsIssue | null
  /** The page that holds the detail. */
  to: string
}

const pct = (n: number, max: number) => (max ? Math.round((n / max) * 100) : 0)

export function capabilityState(a: Agent, issues: OsIssue[] = collectIssues(a)): CapabilityHealth[] {
  const srs = srsNow(a)
  const driver = (id: string) => srs.drivers.find((d) => d.id === id)!
  const of = (id: CapabilityId) => issues.filter((i) => i.capability === id)
  const status = (list: OsIssue[]): CapabilityHealth['status'] => (list.some((i) => i.severity === 'high') ? 'critical' : list.length ? 'attention' : 'healthy')
  const make = (id: CapabilityId, label: string, p: number, headline: string, detail: string, to: string): CapabilityHealth => {
    const list = of(id)
    return { id, label, pct: Math.max(0, Math.min(100, p)), headline, detail, status: status(list), issues: list, top: list[0] ?? null, to }
  }

  const completeness = agentCompleteness(a)
  const gaps = agentGaps(a)
  const ls = listingsStore.get()
  const published = ls.sites.filter((x) => x.status === 'published').length
  const conns = connectionsStore.get()
  const connected = CONNECTIONS.filter((c) => isConnected(conns, c.id)).length
  const nap = napConflicts(a)
  const r = ratingStats(a.reviews)
  const replied = a.reviews.filter((x) => x.reply?.trim()).length
  const unanswered = a.reviews.length - replied
  const rank = leaderboard(a, srs).find((x) => x.me)!.rank
  const views = totalOf('views', windowFor('1m'))

  return [
    make('identity', 'Identity', completeness, `${completeness}% complete`, gaps.length ? `Missing: ${gaps.map((g) => GAP_LABEL[g] ?? g).join(', ')}` : 'Every required field is filled in', '/profile'),
    make('local', 'Local Presence', pct(driver('listings').points + driver('connections').points, driver('listings').max + driver('connections').max), `${published} of ${ls.sites.length} listings published · ${connected} of ${CONNECTIONS.length} accounts connected`, nap.length ? `${nap.length} detail${nap.length === 1 ? ' does' : 's do'} not match your profile` : 'Your name, phone and hours match your profile', '/listings'),
    make('reputation', 'Reputation', pct(driver('reviews').points, driver('reviews').max), r.count ? `${r.avg.toFixed(1)} stars from ${r.count} review${r.count === 1 ? '' : 's'}` : 'No reviews yet', unanswered ? `${unanswered} unanswered · reply rate ${pct(replied, a.reviews.length)}%` : 'Every review has a reply', `/profile/${a.id}?tab=reviews`),
    make('discoverability', 'Discoverability', pct(srs.total, srs.max), `Search Rank Score ${srs.total} of ${srs.max} · ${bandOf(srs.total).label}`, `Rank #${rank} · website ${driver('website').points} of ${driver('website').max}`, '/search-rank'),
    make('content', 'Content & Insights', authorityScore(voceStore.get()), `AI authority ${authorityScore(voceStore.get())} of 100`, `${publishedCount(voceStore.get())} published article${publishedCount(voceStore.get()) === 1 ? '' : 's'} · ${views.toLocaleString()} page views in the last month`, '/insights'),
  ]
}

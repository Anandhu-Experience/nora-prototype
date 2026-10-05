import type { Database } from './types'
import { snapshotDatabase } from './database'
import {
  MEANINGFUL_TREND_PCT,
  missingListingFields,
  missingProfileFields,
  profileCompleteness,
} from './rules'

export type Trend = 'up' | 'down' | 'flat'
export type ConnectionHealth = 'healthy' | 'needs-attention'

/**
 * NORA's structured context about the user. Contextual state, not a source of
 * truth: always rebuilt from the database, never written to directly.
 */
export interface Graph {
  user: { id: string; name: string }
  profile: { completeness: number; missing: string[] }
  listings: { total: number; incomplete: number; incompleteIds: string[] }
  connections: { total: number; health: ConnectionHealth }
  /** Linked accounts that earn Search Rank Score points. */
  accounts: { google: boolean; points: number }
  /** Client reviews, and how many have no public reply. */
  reviews: { total: number; unreplied: number }
  analytics: { visits: number; changePct: number; trend: Trend }
  voce: {
    connected: boolean
    hasProfile: boolean
    authorityScore: number
    articles: number
    questionsAnswered: number
  }
}

export function buildGraphFrom(db: Database): Graph {
  const incomplete = db.listings.filter((l) => missingListingFields(l).length > 0)
  const { visits, previousVisits } = db.analytics
  const changePct = previousVisits
    ? Math.round(((visits - previousVisits) / previousVisits) * 100)
    : 0
  const trend: Trend =
    changePct >= MEANINGFUL_TREND_PCT ? 'up' : changePct <= -MEANINGFUL_TREND_PCT ? 'down' : 'flat'
  const inactiveRatio = db.connections.total ? db.connections.inactive / db.connections.total : 0

  return {
    user: { ...db.user },
    profile: {
      completeness: profileCompleteness(db.profile),
      missing: missingProfileFields(db.profile),
    },
    listings: {
      total: db.listings.length,
      incomplete: incomplete.length,
      incompleteIds: incomplete.map((l) => l.id),
    },
    connections: {
      total: db.connections.total,
      health: inactiveRatio > 0.3 ? 'needs-attention' : 'healthy',
    },
    accounts: { ...db.accounts },
    reviews: { ...db.reviews },
    analytics: { visits, changePct, trend },
    voce: {
      connected: db.voce.hasProfile,
      hasProfile: db.voce.hasProfile,
      authorityScore: db.voce.authorityScore,
      articles: db.voce.articles,
      questionsAnswered: db.voce.questionsAnswered,
    },
  }
}

export function buildGraph(): Graph {
  return buildGraphFrom(snapshotDatabase())
}

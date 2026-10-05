export type ScenarioId = 'live' | 'profile-needed' | 'all-complete' | 'voce-exists' | 'multi-action' | 'google-needed' | 'review-reply-needed'

export interface User {
  id: string
  name: string
}

export interface Profile {
  name: string
  photoUrl: string
  headline: string
  phone: string
  location: string
  bio: string
  specialties: string[]
}

export interface Listing {
  id: string
  title: string
  description: string
  photoCount: number
  price: number | null
}

export interface Analytics {
  visits: number
  previousVisits: number
}

export interface Connections {
  total: number
  inactive: number
}

export interface VoceAccount {
  hasProfile: boolean
  authorityScore: number
  articles: number
  questionsAnswered: number
}

export interface ReviewStats {
  total: number
  unreplied: number
}

export interface Accounts {
  google: boolean
  /** Connection points earned, out of 100. */
  points: number
}

/** Everything the mock "backend" holds. Only api.ts may touch this. */
export interface Database {
  user: User
  profile: Profile
  listings: Listing[]
  analytics: Analytics
  connections: Connections
  /** Linked accounts that earn Search Rank Score points (Google, Facebook...). Live scenario: read from the Connections page. */
  accounts: Accounts
  /** Client reviews and how many have no public reply. Live scenario: read from the Profile page. */
  reviews: ReviewStats
  voce: VoceAccount
}

export interface Scenario {
  id: ScenarioId
  label: string
  description: string
  data: Database
}

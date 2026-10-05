import { seedState } from '../profile/seed'
import type { Database, Profile, Listing, Scenario, ScenarioId } from './types'

/** The profile fixtures mirror the Profile page's seed agent, so NORA and the page describe the same person. */
const arjunan = seedState().agents.arjunan!
const user = { id: 'user-123', name: 'Matt Reeves' }

const completeProfile: Profile = {
  name: arjunan.name,
  photoUrl: arjunan.photoUrl,
  headline: arjunan.title,
  phone: arjunan.phone,
  location: arjunan.location,
  bio: arjunan.about,
  specialties: [...arjunan.specialties, 'Jumbo Loans', 'FHA Loans'],
}
const thinSpecialties = (): string[] => arjunan.specialties.slice(0, 2)

const listing = (id: string, over: Partial<Listing> = {}): Listing => ({
  id,
  title: `Listing ${id}`,
  description: 'Well described listing with all the details buyers expect.',
  photoCount: 8,
  price: 450_000,
  ...over,
})

const completeListings = (): Listing[] => ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => listing(id))

const base = (): Database => ({
  user,
  profile: { ...completeProfile, specialties: [...completeProfile.specialties] },
  listings: completeListings(),
  analytics: { visits: 1250, previousVisits: 1200 }, // +4%: not meaningful
  connections: { total: 42, inactive: 2 },
  accounts: { google: true, points: 55 },
  reviews: { total: 3, unreplied: 0 },
  voce: { hasProfile: false, authorityScore: 0, articles: 0, questionsAnswered: 0 },
})

const A = (): Database => ({
  ...base(),
  profile: { ...completeProfile, bio: '', specialties: thinSpecialties() },
})

const B = (): Database => base()

const C = (): Database => ({
  ...base(),
  voce: { hasProfile: true, authorityScore: 78, articles: 12, questionsAnswered: 18 },
})

/** Everything healthy except Google, which is not connected yet: the account NORA should suggest first. */
const G = (): Database => ({
  ...base(),
  accounts: { google: false, points: 25 },
})

/** Everything healthy except two client reviews that have no public reply yet: the case NORA drafts a reply for. */
const R = (): Database => ({
  ...base(),
  reviews: { total: 3, unreplied: 2 },
})

/** Profile gap + incomplete listing + rising traffic: exercises ranking. */
const D = (): Database => ({
  ...base(),
  profile: { ...completeProfile, bio: '', specialties: thinSpecialties() },
  listings: completeListings().map((l) =>
    l.id === 'L3' ? { ...l, description: '' } : l,
  ),
  analytics: { visits: 1730, previousVisits: 1250 }, // +38%
})

export const SCENARIOS: Record<ScenarioId, Omit<Scenario, 'data'> & { build: () => Database }> = {
  live: {
    id: 'live',
    label: 'Live (Profile page data)',
    description: 'Uses whatever is on the Profile page right now; edits there change what NORA finds.',
    build: B, // other domains are healthy; the profile comes from the Profile page
  },
  'profile-needed': {
    id: 'profile-needed',
    label: 'Profile Needs Improvement',
    description: 'Clears bio and trims specialties on the Profile page; everything else healthy.',
    build: A,
  },
  'all-complete': {
    id: 'all-complete',
    label: 'Everything Complete',
    description: 'Nothing actionable; VOCE offered as exploration.',
    build: B,
  },
  'voce-exists': {
    id: 'voce-exists',
    label: 'VOCE Profile Exists',
    description: 'Everything complete and a VOCE profile is already live.',
    build: C,
  },
  'google-needed': {
    id: 'google-needed',
    label: 'Google Not Connected',
    description: 'Everything healthy except Google Business Profile: NORA suggests connecting it.',
    build: G,
  },
  'review-reply-needed': {
    id: 'review-reply-needed',
    label: 'Reviews Need Replies',
    description: 'Everything healthy except client reviews with no reply: NORA drafts one with the AI model.',
    build: R,
  },
  'multi-action': {
    id: 'multi-action',
    label: 'Multiple Actions (ranking)',
    description: 'Profile gap, incomplete listing and a traffic spike at once.',
    build: D,
  },
}

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[]
export const DEFAULT_SCENARIO: ScenarioId = 'live'

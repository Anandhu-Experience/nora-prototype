import { actions as profileStore, getState as profileState } from '../profile/store'
import { ratingStats } from '../profile/selectors'
import type { BioInput } from '../profile/aiTasks'
import type { Agent } from '../profile/types'
import type { Database, Profile, ScenarioId } from './types'
import { DEFAULT_SCENARIO, SCENARIOS } from './user'

/**
 * In-memory "database". Module-private; only api.ts reads/writes it.
 * Not the graph: the graph is derived from this (see graph.ts).
 *
 * The user's profile is NOT held here. It lives in the Profile page's store
 * (src/profile/store.ts), so NORA and the page always see the same data.
 * Everything else (listings, analytics, connections, VOCE) is local to NORA.
 */
let db: Database = SCENARIOS[DEFAULT_SCENARIO].build()
let scenario: ScenarioId = DEFAULT_SCENARIO

const viewer = (): Agent => {
  const s = profileState()
  return s.agents[s.viewerId]!
}

/** The profile as NORA's rules see it, read from the Profile page store. */
export function readProfile(): Profile {
  const a = viewer()
  return {
    name: a.name,
    photoUrl: a.photoUrl,
    headline: a.title,
    phone: a.phone,
    location: a.location,
    bio: a.about,
    specialties: [...a.specialties],
  }
}

/** Everything a bio may mention, from the Profile page store. Contact details are deliberately excluded. */
export function readBioFacts(): BioInput {
  const a = viewer()
  const r = ratingStats(a.reviews)
  return {
    name: a.name, title: a.title, company: a.company, location: a.location,
    yearsExperience: a.yearsExperience, completedLoans: a.completedLoans, specialties: [...a.specialties],
    services: a.services.map((x) => ({ name: x.name, blurb: x.blurb })),
    rating: { avg: Number(r.avg.toFixed(2)), count: r.count },
    reviewSnippets: [...a.reviews].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 3).map((x) => x.text.slice(0, 280)),
  }
}

const LABELS: Record<keyof Profile, string> = {
  name: 'name', photoUrl: 'photo', headline: 'headline', phone: 'phone number', location: 'location', bio: 'bio', specialties: 'specialties',
}
const joinList = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/** Write through to the Profile page store. `source: 'nora'` logs activity and notifies the user. */
export function writeProfile(patch: Partial<Profile>, source: 'nora' | 'scenario' = 'nora'): void {
  const mapped: Partial<Agent> = {}
  if (patch.name !== undefined) mapped.name = patch.name
  if (patch.photoUrl !== undefined) mapped.photoUrl = patch.photoUrl
  if (patch.headline !== undefined) mapped.title = patch.headline
  if (patch.phone !== undefined) mapped.phone = patch.phone
  if (patch.location !== undefined) mapped.location = patch.location
  if (patch.bio !== undefined) mapped.about = patch.bio
  if (patch.specialties !== undefined) mapped.specialties = [...patch.specialties]

  const what = joinList((Object.keys(patch) as (keyof Profile)[]).map((k) => LABELS[k]))
  profileStore.patchAgent(
    profileState().viewerId,
    mapped,
    source === 'nora' ? { activity: `NORA updated your ${what}`, notify: `NORA updated your ${what}` } : {},
  )
}

export function resetDatabase(id: ScenarioId = scenario): void {
  scenario = id
  db = SCENARIOS[id].build()
  // 'live' keeps the Profile page as-is; the demo scenarios set the profile gaps they illustrate.
  if (id !== 'live') writeProfile({ bio: db.profile.bio, specialties: db.profile.specialties }, 'scenario')
}

export function currentScenario(): ScenarioId {
  return scenario
}

/** Mutable access for api.ts. `profile` here is a scenario fixture only; use readProfile()/writeProfile(). */
export function getDb(): Database {
  return db
}

/** Defensive copy for anything outside the API layer (graph builder, debug UI), with the live profile merged in. */
export function snapshotDatabase(): Database {
  const profile = readProfile()
  return structuredClone({ ...db, profile, user: { ...db.user, name: profile.name.replace(/^agent\s+/i, '') } })
}

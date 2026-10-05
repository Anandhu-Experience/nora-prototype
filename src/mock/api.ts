import { connect, connectionMeta } from '../presence/connections'
import { getDb, readBioFacts, readProfile, readReviewFacts, snapshotDatabase, writeProfile, writeReviewReply } from './database'
import type { BioInput } from '../profile/aiTasks'
import type { Review } from '../profile/types'
import type { Accounts, Analytics, Connections, Listing, Profile, VoceAccount } from './types'

/**
 * Mock services standing in for the existing Profile / Listings / Analytics /
 * Connections / VOCE APIs. No network; they only touch the in-memory database.
 * Reads return copies so callers cannot mutate the store by accident.
 */
let latencyMs = 250
export function setApiLatency(ms: number): void {
  latencyMs = ms
}
const delay = () => new Promise<void>((r) => setTimeout(r, latencyMs))
const copy = <T>(v: T): T => structuredClone(v)

/** Backed by the Profile page's store (see database.ts), not NORA-local state. */
export async function getProfile(): Promise<Profile> {
  await delay()
  return readProfile()
}

export async function getProfileFacts(): Promise<BioInput> {
  await delay()
  return readBioFacts()
}

export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  await delay()
  writeProfile(copy(patch))
  return readProfile()
}

export async function getListings(): Promise<Listing[]> {
  await delay()
  return copy(getDb().listings)
}

export async function updateListing(id: string, patch: Partial<Omit<Listing, 'id'>>): Promise<Listing> {
  await delay()
  const db = getDb()
  const i = db.listings.findIndex((l) => l.id === id)
  if (i < 0) throw new Error(`Listing ${id} not found`)
  db.listings[i] = { ...db.listings[i], ...copy(patch) }
  return copy(db.listings[i])
}

export async function getAnalytics(): Promise<Analytics> {
  await delay()
  return copy(getDb().analytics)
}

export async function getConnections(): Promise<Connections> {
  await delay()
  return copy(getDb().connections)
}

/** Linked accounts and the points they earn. The live scenario reads the Connections page, the demo scenarios their fixture. */
export async function getAccounts(): Promise<Accounts> {
  await delay()
  return snapshotDatabase().accounts
}

/**
 * Connect Google. Callers must only reach this after the user granted access on Google's consent screen.
 * Writes the Connections page (what the user sees) and the scenario fixture (what the demo scenarios read).
 */
export async function connectGoogle(): Promise<Accounts> {
  await delay()
  await connect('google')
  const db = getDb()
  if (!db.accounts.google) db.accounts = { google: true, points: db.accounts.points + connectionMeta('google').points }
  return snapshotDatabase().accounts
}

/** The reviews with no public reply, and who would be replying. */
export async function getReviewsToReply(): Promise<{ agentFirstName: string; agentTitle: string; unreplied: Review[] }> {
  await delay()
  return readReviewFacts()
}

/** Post a public reply. Callers must only reach this after the user approved the text. */
export async function replyToReview(reviewId: string, text: string): Promise<void> {
  await delay()
  writeReviewReply(reviewId, text)
  const db = getDb()
  if (db.reviews.unreplied > 0) db.reviews = { ...db.reviews, unreplied: db.reviews.unreplied - 1 }
}

export async function getVoce(): Promise<VoceAccount> {
  await delay()
  return copy(getDb().voce)
}

/** Mock external redirect targets; VOCE has no real integration. */
export type VoceTarget = 'preview' | 'create' | 'open'
export function getVoceUrl(target: VoceTarget): string {
  const paths = { preview: '/preview', create: '/signup?source=nora', open: '/dashboard' }
  return `https://voce.example.com${paths[target]}`
}

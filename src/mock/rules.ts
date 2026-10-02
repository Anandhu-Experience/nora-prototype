import type { Listing, Profile } from './types'

/**
 * Data-quality rules live with the mock "services" (the existing app's domain),
 * not in NORA. Skills and the graph builder read them through here.
 */
export const MIN_SPECIALTIES = 5
export const MIN_LISTING_PHOTOS = 3
export const MEANINGFUL_TREND_PCT = 20

export type ProfileField = 'photoUrl' | 'headline' | 'phone' | 'location' | 'bio' | 'specialties'

/** Weight of each field toward completeness (sums to 100 with `name`). */
const PROFILE_WEIGHTS: Record<ProfileField | 'name', number> = {
  name: 14,
  photoUrl: 14,
  headline: 14,
  phone: 14,
  location: 14,
  bio: 15,
  specialties: 15,
}

export function missingProfileFields(p: Profile): ProfileField[] {
  const missing: ProfileField[] = []
  if (!p.photoUrl.trim()) missing.push('photoUrl')
  if (!p.headline.trim()) missing.push('headline')
  if (!p.phone.trim()) missing.push('phone')
  if (!p.location.trim()) missing.push('location')
  if (!p.bio.trim()) missing.push('bio')
  if (p.specialties.length < MIN_SPECIALTIES) missing.push('specialties')
  return missing
}

export function profileCompleteness(p: Profile): number {
  const missing = new Set<string>(missingProfileFields(p))
  if (!p.name.trim()) missing.add('name')
  let score = 0
  for (const [field, w] of Object.entries(PROFILE_WEIGHTS)) if (!missing.has(field)) score += w
  return score
}

export type ListingField = 'description' | 'photos' | 'price'

export function missingListingFields(l: Listing): ListingField[] {
  const missing: ListingField[] = []
  if (!l.description.trim()) missing.push('description')
  if (l.photoCount < MIN_LISTING_PHOTOS) missing.push('photos')
  if (l.price === null) missing.push('price')
  return missing
}

/** Completeness after fixing `fixing` fields, given the currently `missing` ones. */
export function completenessAfter(current: number, missing: string[], fixing: string[]): number {
  const gain = fixing.filter((f) => missing.includes(f)).reduce((n, f) => n + (PROFILE_WEIGHTS[f as keyof typeof PROFILE_WEIGHTS] ?? 0), 0)
  return Math.min(100, current + gain)
}

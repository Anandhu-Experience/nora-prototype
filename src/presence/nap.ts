import { agentHours, hoursSummary } from '../profile/details'
import type { Agent } from '../profile/types'
import { FIELD_LABEL, listingsStore, type InfoField } from './listings'
import { websiteStore } from './website'

/**
 * NAP consistency: the professional's name, phone and hours are kept in three places (the profile, the listing and the
 * website scan). This compares them; it stores nothing and changes nothing. The profile is the reference.
 */
export interface NapConflict {
  /** Stable id, e.g. `listings:phone`. */
  id: string
  field: 'name' | 'phone' | 'hours'
  where: 'Listings' | 'Website'
  profile: string
  other: string
  /** The listing field the existing fix flow can correct, when there is one. */
  fixField?: InfoField
}

const digits = (s: string) => s.replace(/\D/g, '')
/** Same number whatever the spacing, brackets or leading zero versus country code. */
const samePhone = (a: string, b: string) => {
  const x = digits(a), y = digits(b)
  return !!x && !!y && (x === y || x.endsWith(y.slice(-9)) && y.endsWith(x.slice(-9)))
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

export function napConflicts(a: Agent): NapConflict[] {
  const out: NapConflict[] = []
  const info = listingsStore.get().info
  if (info.phone.trim() && a.phone.trim() && !samePhone(info.phone, a.phone)) out.push({ id: 'listings:phone', field: 'phone', where: 'Listings', profile: a.phone, other: info.phone, fixField: 'phone' })
  if (info.name.trim() && !norm(info.name).includes(norm(a.name))) out.push({ id: 'listings:name', field: 'name', where: 'Listings', profile: a.name, other: info.name })
  const hours = hoursSummary(agentHours(a))
  if (info.hours.trim() && hours.trim() && norm(info.hours) !== norm(hours)) out.push({ id: 'listings:hours', field: 'hours', where: 'Listings', profile: hours, other: info.hours })
  const web = websiteStore.get()
  const sitePhone = web.status === 'verified' ? web.scan?.nap.phone : undefined
  if (sitePhone?.ok && sitePhone.value.trim() && a.phone.trim() && !samePhone(sitePhone.value, a.phone)) out.push({ id: 'website:phone', field: 'phone', where: 'Website', profile: a.phone, other: sitePhone.value })
  return out
}

export const napLabel = (c: NapConflict): string => `${c.where === 'Listings' ? 'listing' : 'website'} ${FIELD_LABEL[c.field].toLowerCase()}`

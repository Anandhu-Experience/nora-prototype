import type { Address, Agent, BusinessHours, LockField, RankFormat } from './types'

/* ---------------- addresses and amenities ---------------- */

export const AMENITIES: { id: string; label: string }[] = [
  { id: 'parking', label: 'Free parking' },
  { id: 'step-free', label: 'Step-free access' },
  { id: 'wifi', label: 'Free Wi-Fi' },
  { id: 'private-room', label: 'Private meeting room' },
  { id: 'evenings', label: 'Evening appointments' },
  { id: 'virtual', label: 'Video meetings' },
  { id: 'transit', label: 'Near public transport' },
  { id: 'home-visits', label: 'Home visits' },
]
export const amenityLabel = (id: string): string => AMENITIES.find((a) => a.id === id)?.label ?? id

/** The agent's addresses; the first is the primary one. Profiles saved before addresses existed get one derived from `location`. */
export function agentAddresses(a: Agent): Address[] {
  if (a.addresses?.length) return a.addresses
  const region = a.location.includes(',') ? a.location.split(',').slice(1).join(',').trim() : ''
  return [{ id: 'addr-primary', label: 'Main office', street: '', city: a.city, region, postal: '', amenities: [] }]
}

export const formatAddress = (x: Address): string => [x.street, x.city, [x.region, x.postal].filter(Boolean).join(' ')].map((p) => p.trim()).filter(Boolean).join(', ')

const CITY_GEO: Record<string, [number, number]> = {
  birmingham: [52.4862, -1.8904], solihull: [52.4118, -1.7776], london: [51.5072, -0.1276], manchester: [53.4808, -2.2426],
  leeds: [53.8008, -1.5491], coventry: [52.4068, -1.5197], bristol: [51.4545, -2.5879], liverpool: [53.4084, -2.9916],
}
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }

/** A stable, made-up position near the city centre: enough to place a pin on the demo map without a geocoder. */
export function geoFor(x: Address): { lat: number; lng: number; x: number; y: number } {
  const [lat0, lng0] = CITY_GEO[x.city.trim().toLowerCase()] ?? [51 + (hash(x.city) % 400) / 100, -3 + (hash(x.city + 'x') % 300) / 100]
  const h = hash(`${x.street}|${x.postal}|${x.city}`)
  const dx = ((h % 1000) / 1000 - 0.5) * 0.04, dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.03
  return { lat: +(lat0 + dy).toFixed(4), lng: +(lng0 + dx).toFixed(4), x: 0.2 + ((h % 1000) / 1000) * 0.6, y: 0.25 + (((h >> 10) % 1000) / 1000) * 0.5 }
}

export const mapsUrl = (x: Address): string => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(x))}`

/* ---------------- business hours ---------------- */

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = DAY_NAMES.map((d) => d.slice(0, 3))
export const TIME_ZONES = ['Europe/London', 'Europe/Dublin', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Kolkata', 'Australia/Sydney']

export const defaultHours = (): BusinessHours => ({
  timeZone: 'Europe/London',
  days: [
    ...Array.from({ length: 5 }, () => ({ open: true, from: '09:00', to: '17:30' })),
    { open: true, from: '10:00', to: '14:00' },
    { open: false, from: '10:00', to: '14:00' },
  ],
})
export const agentHours = (a: Agent): BusinessHours => a.hours ?? defaultHours()

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const mins = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

/** Errors by day index. An open day needs valid times with the closing time after the opening time. */
export function validateHours(h: BusinessHours): Record<number, string> {
  const out: Record<number, string> = {}
  h.days.forEach((d, i) => {
    if (!d.open) return
    if (!TIME_RE.test(d.from) || !TIME_RE.test(d.to)) out[i] = 'Enter times as HH:MM.'
    else if (mins(d.to) <= mins(d.from)) out[i] = 'Closing time must be after opening time.'
  })
  return out
}

export const fmtTime = (t: string): string => {
  const [hh, mm] = [Number(t.slice(0, 2)), t.slice(3)]
  return `${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'am' : 'pm'}`
}

/** "Mon to Fri 9:00 am to 5:30 pm; Sat 10:00 am to 2:00 pm". Consecutive days with the same hours are grouped. */
export function hoursSummary(h: BusinessHours): string {
  const groups: { from: number; to: number; d: { from: string; to: string } }[] = []
  h.days.forEach((d, i) => {
    if (!d.open) return
    const last = groups.at(-1)
    if (last && last.to === i - 1 && last.d.from === d.from && last.d.to === d.to) last.to = i
    else groups.push({ from: i, to: i, d })
  })
  if (!groups.length) return 'By appointment'
  return groups.map((g) => `${g.from === g.to ? DAY_SHORT[g.from] : `${DAY_SHORT[g.from]} to ${DAY_SHORT[g.to]}`} ${fmtTime(g.d.from)} to ${fmtTime(g.d.to)}`).join('; ')
}

/** Index (Monday = 0) and minutes since midnight in the given zone. */
export function localParts(timeZone: string, now: Date): { day: number; minutes: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { day: Math.max(0, DAY_SHORT.indexOf(get('weekday').slice(0, 3))), minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export function isOpenNow(h: BusinessHours, now: Date = new Date()): boolean {
  const { day, minutes } = localParts(h.timeZone, now)
  const d = h.days[day]
  return !!d && d.open && minutes >= mins(d.from) && minutes < mins(d.to)
}

/* ---------------- manager locks ---------------- */

export const LOCK_FIELDS: LockField[] = ['name', 'title', 'nmls', 'company', 'about', 'specialties', 'phone', 'email', 'location', 'hours']
export const LOCK_LABEL: Record<LockField, string> = {
  name: 'Name', title: 'Title', nmls: 'NMLS #', company: 'Company', about: 'About', specialties: 'Specialties', phone: 'Phone', email: 'Email', location: 'Location and addresses', hours: 'Business hours',
}
/** Which Agent properties each lock protects. */
export const LOCK_KEYS: Record<LockField, (keyof Agent)[]> = {
  name: ['name'], title: ['title'], nmls: ['nmls'], company: ['company'], about: ['about'], specialties: ['specialties'], phone: ['phone'], email: ['email'],
  location: ['city', 'location', 'serviceAreas', 'addresses'], hours: ['hours'],
}

export const lockedFields = (a: Pick<Agent, 'lockedFields'>): LockField[] => a.lockedFields ?? []
export const isLocked = (a: Pick<Agent, 'lockedFields'>, f: LockField): boolean => lockedFields(a).includes(f)

/** An agent's edit with every locked field put back to what it was. A manager's edit passes through unchanged. */
export function applyLocks(prev: Agent, next: Agent, manager: boolean): Agent {
  if (manager) return next
  const out: Agent = { ...next, lockedFields: prev.lockedFields }
  for (const f of lockedFields(prev)) for (const k of LOCK_KEYS[f]) (out as unknown as Record<string, unknown>)[k] = prev[k]
  return out
}

/* ---------------- schema.org output ---------------- */

const DAY_URL = DAY_NAMES

export interface SchemaCheck { id: string; label: string; ok: boolean; hint: string }

/** What search engines and AI assistants look for. Each missing item says how to fix it. */
export function schemaChecklist(a: Agent): SchemaCheck[] {
  const addr = agentAddresses(a)[0]!
  const h = agentHours(a)
  const links = [a.social.linkedin, a.social.twitter, a.social.facebook, a.social.website].filter(Boolean)
  return [
    { id: 'name', label: 'Name and job title', ok: !!a.name.trim() && !!a.title.trim(), hint: 'Add your name and title in Basic Info.' },
    { id: 'contact', label: 'Phone and email', ok: !!a.phone.trim() && !!a.email.trim(), hint: 'Add both in Social Links.' },
    { id: 'address', label: 'Street address', ok: !!addr.street.trim() && !!addr.postal.trim(), hint: 'Add a street and postcode to your main address in Location.' },
    { id: 'hours', label: 'Opening hours', ok: h.days.some((d) => d.open), hint: 'Open at least one day in Hours.' },
    { id: 'image', label: 'Profile photo', ok: !!a.photoUrl.trim(), hint: 'Upload a photo in Photos.' },
    { id: 'rating', label: 'Reviews and rating', ok: a.reviews.length > 0, hint: 'Ask clients for reviews.' },
    { id: 'sameAs', label: 'Links to your other profiles', ok: links.length >= 2, hint: 'Add two or more links in Social Links.' },
    { id: 'area', label: 'Service area', ok: a.serviceAreas.length > 0, hint: 'Add the cities you serve in Location.' },
    { id: 'knows', label: 'Specialties', ok: a.specialties.length >= 3, hint: 'List at least three specialties.' },
  ]
}

export const schemaScore = (a: Agent): number => {
  const c = schemaChecklist(a)
  return Math.round((c.filter((x) => x.ok).length / c.length) * 100)
}

/** JSON-LD for the public profile and the rank page, built from the same data as everything else. */
export function buildSchema(a: Agent, origin = ''): Record<string, unknown> {
  const url = `${origin}/profile/${a.id}`
  const addr = agentAddresses(a)[0]!
  const h = agentHours(a)
  const postal = { '@type': 'PostalAddress', streetAddress: addr.street || undefined, addressLocality: addr.city, addressRegion: addr.region || undefined, postalCode: addr.postal || undefined }
  const ratings = a.reviews.length ? { '@type': 'AggregateRating', ratingValue: +(a.reviews.reduce((n, r) => n + r.rating, 0) / a.reviews.length).toFixed(2), reviewCount: a.reviews.length, bestRating: 5, worstRating: 1 } : undefined
  const sameAs = [a.social.linkedin, a.social.twitter, a.social.facebook, a.social.website].filter(Boolean)
  // groups days that share the same hours into one specification
  const specs: { dayOfWeek: string[]; opens: string; closes: string }[] = []
  h.days.forEach((d, i) => {
    if (!d.open) return
    const s = specs.find((x) => x.opens === d.from && x.closes === d.to)
    if (s) s.dayOfWeek.push(DAY_URL[i]!)
    else specs.push({ dayOfWeek: [DAY_URL[i]!], opens: d.from, closes: d.to })
  })
  const photo = a.photoUrl.startsWith('http') ? a.photoUrl : undefined
  const g = geoFor(addr)
  return JSON.parse(JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person', '@id': `${url}#person`, name: a.name, jobTitle: a.title, url, image: photo, telephone: a.phone || undefined, email: a.email || undefined,
        description: a.about || undefined, sameAs: sameAs.length ? sameAs : undefined, knowsAbout: a.specialties,
        worksFor: { '@type': 'Organization', name: a.company }, award: a.awards.map((x) => `${x.title} (${x.year})`), address: postal, aggregateRating: ratings,
        review: a.reviews.slice(0, 3).map((r) => ({ '@type': 'Review', author: { '@type': 'Person', name: r.author }, reviewRating: { '@type': 'Rating', ratingValue: r.rating }, reviewBody: r.text, datePublished: r.date.slice(0, 10) })),
      },
      {
        '@type': ['FinancialService', 'LocalBusiness'], '@id': `${url}#business`, name: `${a.name} | ${a.company}`, url, telephone: a.phone || undefined, address: postal,
        geo: { '@type': 'GeoCoordinates', latitude: g.lat, longitude: g.lng }, openingHoursSpecification: specs.map((s) => ({ '@type': 'OpeningHoursSpecification', ...s })),
        areaServed: a.serviceAreas.map((c) => ({ '@type': 'City', name: c })), amenityFeature: addr.amenities.map((id) => ({ '@type': 'LocationFeatureSpecification', name: amenityLabel(id), value: true })),
        aggregateRating: ratings, employee: { '@id': `${url}#person` },
      },
    ],
  }))
}

/* ---------------- rank page formats ---------------- */

export const RANK_FORMATS: { id: RankFormat; label: string; blurb: string }[] = [
  { id: 'card', label: 'Profile card', blurb: 'Photo, rating and contact. The default for sharing a link.' },
  { id: 'banner', label: 'Banner', blurb: 'A wide strip for email signatures and websites.' },
  { id: 'reviews', label: 'Review-led', blurb: 'Leads with what clients say. Best for building trust.' },
]
export const rankFormatOf = (a: Agent): RankFormat => a.rankFormat ?? 'card'
export const rankUrl = (a: Agent, origin = ''): string => `${origin}/rank/${a.id}`

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** A self-contained snippet (inline styles, no scripts) to paste into a website or an email signature. */
export function embedCode(a: Agent, format: RankFormat, origin = ''): string {
  const r = a.reviews.length ? (a.reviews.reduce((n, x) => n + x.rating, 0) / a.reviews.length).toFixed(1) : null
  const link = rankUrl(a, origin)
  const rating = r ? `${r} ★ from ${a.reviews.length} review${a.reviews.length === 1 ? '' : 's'}` : 'New on Experience.com'
  const base = 'font-family:Arial,sans-serif;text-decoration:none;color:#14213d;'
  if (format === 'banner') return `<a href="${esc(link)}" style="${base}display:inline-block;padding:10px 16px;border:1px solid #dfe4ee;border-radius:10px;background:#fff">${esc(a.name)} · ${esc(a.title)} · <strong>${esc(rating)}</strong> · Experience.com</a>`
  if (format === 'reviews') {
    const top = [...a.reviews].sort((x, y) => y.rating - x.rating || y.date.localeCompare(x.date))[0]
    return `<a href="${esc(link)}" style="${base}display:block;max-width:360px;padding:14px 16px;border:1px solid #dfe4ee;border-radius:12px;background:#fff"><strong>${esc(rating)}</strong><br><em>${esc(top ? `“${top.text.slice(0, 140)}”` : 'Read my reviews')}</em><br><small>${esc(a.name)} · Experience.com</small></a>`
  }
  return `<a href="${esc(link)}" style="${base}display:block;max-width:300px;padding:14px 16px;border:1px solid #dfe4ee;border-radius:12px;background:#fff"><strong>${esc(a.name)}</strong><br>${esc(a.title)}, ${esc(a.company)}<br><small>${esc(rating)} · NMLS ${esc(a.nmls)}</small></a>`
}

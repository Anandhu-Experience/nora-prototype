import { agentAddresses, formatAddress, geoFor, isLocked, lockedFields, LOCK_LABEL } from './details.ts'
import type { Agent } from './types.ts'

/**
 * The expertise graph: everything known about a professional, grouped into eight rings around the person, each leaf a node with its
 * source, the schema.org property it maps to, and how trustworthy it is. Built from the same data as the profile, so it never drifts.
 */
export type RingId = 'identity' | 'credentials' | 'products' | 'social' | 'reviews' | 'content' | 'place' | 'hierarchy'
export const RINGS: { id: RingId; label: string; color: string }[] = [
  { id: 'identity', label: 'Identity', color: '#5b9dff' },
  { id: 'credentials', label: 'Credentials & Licenses', color: '#a98bff' },
  { id: 'products', label: 'Products & Services', color: '#34d399' },
  { id: 'social', label: 'Social & sameAs', color: '#22c7e8' },
  { id: 'reviews', label: 'Reviews', color: '#d9a441' },
  { id: 'content', label: 'Content', color: '#d36a92' },
  { id: 'place', label: 'Place & Geo', color: '#4aa3ff' },
  { id: 'hierarchy', label: 'Hierarchy', color: '#f472d0' },
]

export type NodeState = 'self-reported' | 'verified' | 'published' | 'client-written' | 'scanned' | 'sample' | 'managed'
export interface GNode {
  id: string
  ring: RingId
  label: string
  value: string
  /** `record` comes from the profile record; `live` comes from a connected module (connections, listings, reviews, content, partners). */
  origin: 'record' | 'live'
  source: string
  /** The schema.org property this maps to. */
  schema: string
  state: NodeState
}

export const STATE_LABEL: Record<NodeState, string> = {
  'self-reported': 'Self-reported', verified: 'Verified: account connected', published: 'Published to a directory', 'client-written': 'Written by clients',
  scanned: 'Checked on the live site', sample: 'Sample data', managed: 'Set by your manager',
}

/** What the graph needs besides the profile, read from the app's module stores by the page. */
export interface GraphContext {
  connected: { id: string; name: string; handle: string; oauth: boolean }[]
  publishedListings: { id: string; name: string }[]
  articles: { id: string; title: string }[]
  answeredFaqs: number
  partners: { id: string; name: string }[]
  website: { url: string; scanned: boolean; live: boolean } | null
}
export const EMPTY_CONTEXT: GraphContext = { connected: [], publishedListings: [], articles: [], answeredFaqs: 0, partners: [], website: null }

const clip = (s: string, n = 34): string => (s.length <= n ? s : `${s.slice(0, n - 1).trim()}…`)

export function buildNodes(a: Agent, ctx: GraphContext = EMPTY_CONTEXT): GNode[] {
  const out: GNode[] = []
  const add = (n: Omit<GNode, 'origin' | 'state'> & { origin?: GNode['origin']; state?: NodeState }) => out.push({ origin: 'record', state: 'self-reported', ...n })
  const first = a.name.replace(/^agent\s+/i, '')

  // identity
  if (a.name.trim()) add({ id: 'id-name', ring: 'identity', label: a.name, value: a.name, source: 'Profile record', schema: 'Person › name' })
  if (a.title.trim()) add({ id: 'id-title', ring: 'identity', label: a.title, value: a.title, source: 'Profile record', schema: 'Person › jobTitle' })
  if (a.photoUrl.trim()) add({ id: 'id-photo', ring: 'identity', label: 'Profile photo', value: 'Photo uploaded', source: 'Profile record', schema: 'Person › image' })
  if (a.about.trim()) add({ id: 'id-bio', ring: 'identity', label: 'Biography', value: a.about, source: 'Profile record', schema: 'Person › description' })
  if (a.phone.trim()) add({ id: 'id-phone', ring: 'identity', label: a.phone, value: a.phone, source: 'Profile record', schema: 'Person › telephone' })
  if (a.email.trim()) add({ id: 'id-email', ring: 'identity', label: a.email, value: a.email, source: 'Profile record', schema: 'Person › email' })

  // credentials
  if (a.nmls.trim()) add({ id: 'cr-nmls', ring: 'credentials', label: `NMLS ${a.nmls}`, value: `NMLS #${a.nmls}`, source: 'Profile record', schema: 'Person › hasCredential (NMLS)', state: isLocked(a, 'nmls') ? 'managed' : 'self-reported' })
  for (const w of a.awards) add({ id: `cr-award-${w.id}`, ring: 'credentials', label: clip(`${w.title} (${w.year})`), value: `${w.title}, ${w.issuer}, ${w.year}`, source: 'Profile record', schema: 'Person › award' })

  // products and services
  for (const s of a.services) add({ id: `pr-svc-${s.id}`, ring: 'products', label: s.name, value: s.blurb || s.name, source: 'Profile record', schema: 'Person › makesOffer › Service' })
  for (const [i, t] of a.specialties.entries()) add({ id: `pr-spec-${i}`, ring: 'products', label: t, value: `Specialty: ${t}`, source: 'Profile record', schema: 'Person › knowsAbout' })

  // social and sameAs
  const links: [string, string, string][] = [['LinkedIn', a.social.linkedin, 'so-linkedin'], ['X', a.social.twitter, 'so-x'], ['Facebook page', a.social.facebook, 'so-fb'], ['Website', a.social.website, 'so-web']]
  for (const [name, url, id] of links) if (url.trim()) add({ id, ring: 'social', label: name === 'Website' ? clip(url.replace(/^https?:\/\//, ''), 26) : name, value: url, source: 'Profile record', schema: 'Person › sameAs' })
  for (const c of ctx.connected) add({ id: `so-conn-${c.id}`, ring: 'social', label: c.name, value: c.handle ? `${c.name}: ${c.handle}` : `${c.name} connected`, origin: 'live', source: 'Connections', schema: 'Person › sameAs', state: c.oauth ? 'verified' : 'self-reported' })

  // reviews, by source
  const bySource = new Map<string, number>()
  for (const r of a.reviews) bySource.set(r.source ?? 'Experience.com', (bySource.get(r.source ?? 'Experience.com') ?? 0) + 1)
  if (a.reviews.length) {
    const avg = a.reviews.reduce((n, r) => n + r.rating, 0) / a.reviews.length
    add({ id: 're-rating', ring: 'reviews', label: `${avg.toFixed(2)} average`, value: `${avg.toFixed(2)} from ${a.reviews.length} reviews`, origin: 'live', source: 'Reviews', schema: 'aggregateRating › ratingValue', state: 'client-written' })
    for (const [src, n] of bySource) add({ id: `re-src-${src}`, ring: 'reviews', label: `${src} (${n})`, value: `${n} review${n === 1 ? '' : 's'} from ${src}`, origin: 'live', source: 'Reviews', schema: 'Person › review', state: 'client-written' })
  }

  // content
  for (const art of ctx.articles) add({ id: `co-art-${art.id}`, ring: 'content', label: clip(art.title), value: art.title, origin: 'live', source: 'AI Visibility', schema: 'Article › headline', state: 'published' })
  if (ctx.answeredFaqs > 0) add({ id: 'co-faq', ring: 'content', label: `${ctx.answeredFaqs} FAQ answer${ctx.answeredFaqs === 1 ? '' : 's'}`, value: `${ctx.answeredFaqs} answered question${ctx.answeredFaqs === 1 ? '' : 's'}`, origin: 'live', source: 'AI Visibility', schema: 'FAQPage › mainEntity', state: 'published' })

  // place and geo
  for (const [i, ad] of agentAddresses(a).entries()) {
    const text = formatAddress(ad) || a.location
    add({ id: `pl-addr-${ad.id}`, ring: 'place', label: clip(text, 30), value: `${ad.label}: ${text}`, source: 'Profile record', schema: 'LocalBusiness › address (PostalAddress)', state: isLocked(a, 'location') ? 'managed' : 'self-reported' })
    if (i === 0) { const g = geoFor(ad); add({ id: 'pl-geo', ring: 'place', label: `${g.lat}, ${g.lng}`, value: `Latitude ${g.lat}, longitude ${g.lng} (demo position)`, source: 'Derived from the address', schema: 'LocalBusiness › geo (GeoCoordinates)', state: 'sample' }) }
  }
  for (const c of a.serviceAreas) add({ id: `pl-area-${c}`, ring: 'place', label: `${c} (service area)`, value: `Serves ${c}`, source: 'Profile record', schema: 'LocalBusiness › areaServed' })
  for (const l of ctx.publishedListings) add({ id: `pl-list-${l.id}`, ring: 'place', label: l.name, value: `Listing published on ${l.name}`, origin: 'live', source: 'Listings', schema: 'LocalBusiness › sameAs', state: 'published' })
  if (ctx.website) add({ id: 'pl-site', ring: 'place', label: clip(ctx.website.url.replace(/^https?:\/\//, ''), 30), value: ctx.website.url, origin: 'live', source: 'Web Analytics', schema: 'Person › url', state: ctx.website.live ? 'scanned' : 'sample' })

  // hierarchy
  if (a.company.trim()) add({ id: 'hi-company', ring: 'hierarchy', label: a.company, value: `${first} works for ${a.company}`, source: 'Profile record', schema: 'Person › worksFor (Organization)', state: isLocked(a, 'company') ? 'managed' : 'self-reported' })
  for (const p of ctx.partners) add({ id: `hi-partner-${p.id}`, ring: 'hierarchy', label: p.name, value: `Promoted partner: ${p.name}`, origin: 'live', source: 'Network', schema: 'Person › knows', state: 'self-reported' })
  const locks = lockedFields(a)
  if (locks.length) add({ id: 'hi-locks', ring: 'hierarchy', label: `${locks.length} locked field${locks.length === 1 ? '' : 's'}`, value: `Locked by your manager: ${locks.map((l) => LOCK_LABEL[l]).join(', ')}`, source: 'Manager controls', schema: 'Organization › governance (custom)', state: 'managed' })
  return out
}

export interface RingSummary { id: RingId; label: string; color: string; count: number }
export interface Graph { nodes: GNode[]; rings: RingSummary[]; live: number; record: number; populated: number; total: number }

export function buildGraph(a: Agent, ctx: GraphContext = EMPTY_CONTEXT): Graph {
  const nodes = buildNodes(a, ctx)
  const rings = RINGS.map((r) => ({ ...r, count: nodes.filter((n) => n.ring === r.id).length }))
  return { nodes, rings, live: nodes.filter((n) => n.origin === 'live').length, record: nodes.filter((n) => n.origin === 'record').length, populated: rings.filter((r) => r.count > 0).length, total: RINGS.length }
}

/* ---------------- layout ---------------- */

export interface Placed { x: number; y: number; angle: number; r: number }
export interface Layout { hubs: Record<RingId, Placed>; nodes: Record<string, Placed> }
const rad = (deg: number) => (deg * Math.PI) / 180
const at = (angleDeg: number, r: number): Placed => ({ x: Math.cos(rad(angleDeg)) * r, y: Math.sin(rad(angleDeg)) * r, angle: angleDeg, r })

/** Rings spread evenly round the person starting at the top; each ring's nodes fan out in an arc beyond its hub (two rows when crowded). */
export function layoutGraph(g: Graph, hubR = 190, leafR = 340): Layout {
  const hubs = {} as Record<RingId, Placed>
  const nodes: Record<string, Placed> = {}
  RINGS.forEach((ring, i) => {
    const angle = -90 + (360 / RINGS.length) * i
    hubs[ring.id] = at(angle, hubR)
    const mine = g.nodes.filter((n) => n.ring === ring.id)
    const span = Math.min(40, Math.max(0, mine.length - 1) * 7.5)
    mine.forEach((n, k) => {
      const t = mine.length === 1 ? 0 : k / (mine.length - 1) - 0.5
      nodes[n.id] = at(angle + t * span, leafR + (mine.length > 6 && k % 2 === 1 ? 62 : 0))
    })
  })
  return { hubs, nodes }
}

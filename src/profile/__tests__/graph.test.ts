import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_CONTEXT, RINGS, buildGraph, buildNodes, layoutGraph, type GraphContext } from '../graphModel'
import { actions, getState } from '../store'

beforeEach(() => actions.reset())
const arj = () => getState().agents.arjunan!

const CTX: GraphContext = {
  connected: [{ id: 'facebook', name: 'Facebook', handle: 'facebook.com/agentarjunan', oauth: true }, { id: 'yelp', name: 'Yelp', handle: '', oauth: false }],
  publishedListings: [{ id: 'g', name: 'Google Business Profile' }],
  articles: [{ id: 'a1', title: 'First-time buyer checklist' }],
  answeredFaqs: 2,
  partners: [{ id: 'p1', name: 'Sofia Marin' }],
  website: { url: 'https://app.example.test/profile/arjunan', scanned: true, live: true },
}
const ring = (g: ReturnType<typeof buildGraph>, id: string) => g.rings.find((r) => r.id === id)!.count

describe('the expertise graph model', () => {
  it('groups the profile record into the eight rings', () => {
    const g = buildGraph(arj())
    expect(g.rings.map((r) => r.id)).toEqual(RINGS.map((r) => r.id))
    expect(ring(g, 'identity')).toBe(6) // name, title, photo, bio, phone, email
    expect(ring(g, 'credentials')).toBe(4) // NMLS + 3 awards
    expect(ring(g, 'products')).toBe(6) // 3 services + 3 specialties
    expect(ring(g, 'reviews')).toBe(4) // average + 3 sources
    expect(ring(g, 'content')).toBe(0)
    expect(g.populated).toBe(g.rings.filter((r) => r.count > 0).length)
    expect(g.live + g.record).toBe(g.nodes.length)
  })

  it('adds live nodes from the connected modules and counts them as live', () => {
    const base = buildGraph(arj(), EMPTY_CONTEXT)
    const g = buildGraph(arj(), CTX)
    expect(g.nodes.length).toBeGreaterThan(base.nodes.length)
    expect(ring(g, 'content')).toBe(2) // one article, one FAQ node
    expect(g.nodes.find((n) => n.id === 'so-conn-facebook')).toMatchObject({ origin: 'live', state: 'verified', source: 'Connections' })
    expect(g.nodes.find((n) => n.id === 'so-conn-yelp')!.state).toBe('self-reported')
    expect(g.nodes.find((n) => n.id === 'pl-list-g')).toMatchObject({ origin: 'live', state: 'published' })
    expect(g.nodes.find((n) => n.id === 'pl-site')!.state).toBe('scanned')
    expect(g.nodes.some((n) => n.id === 'hi-partner-p1')).toBe(true)
    expect(g.live).toBeGreaterThan(base.live)
  })

  it('leaves a ring empty (not captured) when there is nothing for it, and omits blank fields', () => {
    const bare = { ...arj(), about: '', phone: '', awards: [], services: [], specialties: [], reviews: [], social: { linkedin: '', twitter: '', facebook: '', website: '' } }
    const g = buildGraph(bare)
    expect(ring(g, 'reviews')).toBe(0)
    expect(ring(g, 'products')).toBe(0)
    expect(g.nodes.some((n) => n.id === 'id-bio' || n.id === 'id-phone')).toBe(false)
    expect(g.populated).toBeLessThan(8)
  })

  it('marks manager-locked fields as managed and adds a governance node', () => {
    const nodes = buildNodes(arj())
    expect(nodes.find((n) => n.id === 'cr-nmls')!.state).toBe('managed')
    expect(nodes.find((n) => n.id === 'hi-company')!.state).toBe('managed')
    expect(nodes.find((n) => n.id === 'hi-locks')!.value).toMatch(/NMLS/)
  })

  it('gives every node a schema.org mapping, a source and a unique id', () => {
    const nodes = buildNodes(arj(), CTX)
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length)
    for (const n of nodes) { expect(n.schema.length, n.id).toBeGreaterThan(3); expect(n.source.length, n.id).toBeGreaterThan(2) }
    expect(nodes.find((n) => n.id === 'id-name')!.schema).toBe('Person › name')
  })

  it('reflects edits to the profile', () => {
    actions.patchAgent('arjunan', { specialties: ['A', 'B', 'C', 'D', 'E'] })
    expect(ring(buildGraph(arj()), 'products')).toBe(8)
  })
})

describe('the layout', () => {
  const g = buildGraph(arj(), CTX)
  const l = layoutGraph(g)
  it('puts the first ring at the top and spreads the eight evenly', () => {
    expect(l.hubs.identity.y).toBeLessThan(0)
    expect(Math.abs(l.hubs.identity.x)).toBeLessThan(1)
    const angles = RINGS.map((r) => (((l.hubs[r.id].angle + 90) % 360) + 360) % 360)
    expect(angles).toEqual([0, 45, 90, 135, 180, 225, 270, 315])
  })
  it('places every node beyond its hub and no two nodes on top of each other', () => {
    for (const n of g.nodes) expect(l.nodes[n.id]!.r, n.id).toBeGreaterThan(l.hubs[n.ring].r)
    const pts = g.nodes.map((n) => l.nodes[n.id]!)
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i]!.x - pts[j]!.x, pts[i]!.y - pts[j]!.y), `${g.nodes[i]!.id} vs ${g.nodes[j]!.id}`).toBeGreaterThan(12)
  })
})

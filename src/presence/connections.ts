import type { AiAnswer } from '../profile/assistant'
import { createStore, nowIso, wait } from './persist'

export type ConnectionId = 'google' | 'facebook' | 'linkedin' | 'x' | 'instagram' | 'youtube' | 'yelp' | 'zillow' | 'realtor' | 'lendingtree' | 'tripadvisor'
export type ConnectionGroup = 'core' | 'social' | 'mortgage'

export interface ConnectionMeta {
  id: ConnectionId
  name: string
  group: ConnectionGroup
  letter: string
  /** Points toward the Search Rank Score (the table sums to 100). */
  points: number
  value: string
  /** oauth = authorise with the network; link = paste a profile URL. */
  kind: 'oauth' | 'link'
  /** Hosts a profile URL must belong to (link networks). */
  hosts: string[]
  permissions: string[]
  placeholder: string
  /** Account handle shown once an OAuth connection is live. */
  handle: string
  /** Can be synced on demand. */
  syncs?: boolean
}

export const CONNECTIONS: ConnectionMeta[] = [
  { id: 'google', name: 'Google Business Profile', group: 'core', letter: 'G', points: 30, value: 'Publishes your listing to Google Maps and Search and unlocks Insights.', kind: 'oauth', hosts: ['google.com'], permissions: ['View and manage your business listings', 'Read listing views, searches and customer actions', 'Read and reply to Google reviews'], placeholder: '', handle: 'Agent Arjunan, Birmingham', syncs: true },
  { id: 'facebook', name: 'Facebook', group: 'core', letter: 'f', points: 15, value: 'Syncs your page reviews and posts to your profile.', kind: 'oauth', hosts: ['facebook.com'], permissions: ['Read your Page details and recommendations', 'Publish posts to your Page', 'Read Page insights'], placeholder: '', handle: 'facebook.com/agentarjunan', syncs: true },
  { id: 'linkedin', name: 'LinkedIn', group: 'core', letter: 'in', points: 10, value: 'Adds professional credibility and endorsements.', kind: 'oauth', hosts: ['linkedin.com'], permissions: ['Read your basic profile', 'Read your work history and recommendations'], placeholder: '', handle: 'linkedin.com/in/agentarjunan' },
  { id: 'x', name: 'X', group: 'core', letter: 'X', points: 8, value: 'Shares your updates and reviews with followers.', kind: 'oauth', hosts: ['x.com', 'twitter.com'], permissions: ['Read your profile and followers', 'Post updates on your behalf'], placeholder: '', handle: '@agentarjunan' },
  { id: 'instagram', name: 'Instagram', group: 'social', letter: 'ig', points: 8, value: 'Shows your latest photos and local presence.', kind: 'oauth', hosts: ['instagram.com'], permissions: ['Read your profile and media', 'Read basic insights'], placeholder: '', handle: '@agentarjunan' },
  { id: 'youtube', name: 'YouTube', group: 'social', letter: '▶', points: 7, value: 'Embeds your videos and client stories on your profile.', kind: 'link', hosts: ['youtube.com', 'youtu.be'], permissions: [], placeholder: 'https://www.youtube.com/@yourchannel', handle: '' },
  { id: 'yelp', name: 'Yelp', group: 'social', letter: 'y', points: 6, value: 'Links your Yelp reviews and strengthens local trust.', kind: 'link', hosts: ['yelp.com'], permissions: [], placeholder: 'https://www.yelp.com/biz/your-business', handle: '' },
  { id: 'zillow', name: 'Zillow', group: 'mortgage', letter: 'Z', points: 6, value: 'Brings in Zillow lender reviews, a high-intent source.', kind: 'oauth', hosts: ['zillow.com'], permissions: ['Read your Lender profile', 'Read your Zillow reviews'], placeholder: '', handle: 'zillow.com/lender-profile/arjunan' },
  { id: 'realtor', name: 'Realtor', group: 'mortgage', letter: 'R', points: 4, value: 'Connects you with agents and buyers who search realtor.com.', kind: 'link', hosts: ['realtor.com'], permissions: [], placeholder: 'https://www.realtor.com/mortgage/your-profile', handle: '' },
  { id: 'lendingtree', name: 'Lending Tree', group: 'mortgage', letter: 'LT', points: 3, value: 'Adds your Lending Tree rating and reviews.', kind: 'link', hosts: ['lendingtree.com'], permissions: [], placeholder: 'https://www.lendingtree.com/lender/your-profile', handle: '' },
  { id: 'tripadvisor', name: 'TripAdvisor', group: 'mortgage', letter: 'ta', points: 3, value: 'Local relocation clients often check TripAdvisor first.', kind: 'link', hosts: ['tripadvisor.com', 'tripadvisor.co.uk'], permissions: [], placeholder: 'https://www.tripadvisor.com/your-business', handle: '' },
]

export const connectionMeta = (id: ConnectionId): ConnectionMeta => CONNECTIONS.find((c) => c.id === id)!
export const GROUPS: { id: ConnectionGroup; label: string; blurb: string }[] = [
  { id: 'core', label: 'Core connections', blurb: 'The accounts that move your score the most.' },
  { id: 'social', label: 'Social', blurb: 'Keep your social presence in sync.' },
  { id: 'mortgage', label: 'Mortgage connections', blurb: 'Industry networks where borrowers look for lenders.' },
]

export interface Connection { connected: boolean; handle: string; url: string; connectedAt: string; lastSynced: string }
export interface ConnectionsState { conns: Record<ConnectionId, Connection> }

const off: Connection = { connected: false, handle: '', url: '', connectedAt: '', lastSynced: '' }

export const connectionsStore = createStore<ConnectionsState>('nora-presence-connections-v2', () => {
  const conns = Object.fromEntries(CONNECTIONS.map((c) => [c.id, { ...off }])) as Record<ConnectionId, Connection>
  conns.facebook = { connected: true, handle: 'facebook.com/agentarjunan', url: '', connectedAt: '2026-03-14T10:00:00.000Z', lastSynced: '2026-10-01T08:00:00.000Z' }
  conns.linkedin = { connected: true, handle: 'linkedin.com/in/agentarjunan', url: '', connectedAt: '2026-02-02T09:30:00.000Z', lastSynced: '' }
  return { conns }
})

export const isConnected = (s: ConnectionsState, id: ConnectionId): boolean => !!s.conns[id]?.connected

/** 0..100: the sum of the points of every connected network (the table sums to 100). */
export const connectionsPoints = (s: ConnectionsState): number =>
  Math.min(100, CONNECTIONS.reduce((n, c) => n + (isConnected(s, c.id) ? c.points : 0), 0))

export const maxConnectionPoints = CONNECTIONS.reduce((n, c) => n + c.points, 0)

/** Validates a pasted profile URL: must parse and the host must belong to the network. Returns an error or null. */
export function validateProfileUrl(id: ConnectionId, raw: string): string | null {
  const m = connectionMeta(id)
  const v = raw.trim()
  if (!v) return `Paste your ${m.name} profile link.`
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`) } catch { return 'That does not look like a valid link.' }
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (!m.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return `That link is not on ${m.hosts[0]}.`
  if (u.pathname.replace(/\/+$/, '') === '') return 'Link to your profile page, not the home page.'
  return null
}

const lastSegment = (url: string): string => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')

/** Authorise (OAuth networks) or save the profile link (link networks). Resolves after the mock latency. */
export async function connect(id: ConnectionId, url = ''): Promise<void> {
  const m = connectionMeta(id)
  await wait()
  const at = nowIso()
  connectionsStore.set((s) => ({ conns: { ...s.conns, [id]: { connected: true, handle: m.kind === 'link' ? lastSegment(url) : m.handle, url: m.kind === 'link' ? url.trim() : '', connectedAt: at, lastSynced: m.syncs ? at : '' } } }))
}

export function disconnect(id: ConnectionId): void {
  connectionsStore.set((s) => ({ conns: { ...s.conns, [id]: { ...off } } }))
}

export async function syncNow(id: ConnectionId): Promise<void> {
  if (!isConnected(connectionsStore.get(), id)) return
  await wait()
  connectionsStore.set((s) => ({ conns: { ...s.conns, [id]: { ...s.conns[id], lastSynced: nowIso() } } }))
}

export const missingConnections = (s: ConnectionsState): ConnectionMeta[] =>
  CONNECTIONS.filter((c) => !isConnected(s, c.id)).sort((a, b) => b.points - a.points)

export function connectionsAnswer(): AiAnswer {
  const s = connectionsStore.get()
  const pts = connectionsPoints(s)
  const on = CONNECTIONS.filter((c) => isConnected(s, c.id))
  const next = missingConnections(s).slice(0, 3)
  return {
    intro: `You have ${on.length} of ${CONNECTIONS.length} accounts connected, earning ${pts} of 100 connection points.${isConnected(s, 'google') ? '' : ' Google is not connected yet, and it is the most valuable one.'}`,
    items: [
      { title: `Connected: ${on.map((c) => c.name).join(', ') || 'none'}`, detail: 'Live accounts feed your profile and your Search Rank Score.' },
      ...next.map((c) => ({ title: `${c.name}: +${c.points} pts`, detail: c.value })),
    ],
    links: [{ label: 'Open Connections', to: '/connections' }, { label: 'Open Listings', to: '/listings' }],
  }
}

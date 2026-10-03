import type { AiAnswer } from '../profile/assistant'
import { getState } from '../profile/store'
import type { Agent, Thread } from '../profile/types'
import { createStore } from './persist'

export const MAX_PROMOTED = 8
export const STALE_DAYS = 7

export interface PartnerEntry { id: string; name: string; title: string; city: string; agentId?: string }
export type RequestStatus = 'pending' | 'accepted' | 'declined'
export interface PromoRequest { id: string; name: string; title: string; city: string; at: string; status: RequestStatus }
export type ReferralKind = 'received' | 'requested' | 'given'
export type ReferralStatus = 'open' | 'converted' | 'archived'
export interface ReferralRow {
  id: string
  kind: ReferralKind
  name: string
  email: string
  source: string
  /** ISO date the referral was made. */
  at: string
  referredBy: string
  lastFollowUp: string | null
  attempts: number
  status: ReferralStatus
  /** Set when the other side is a professional in the app (so a real message can be sent). */
  agentId?: string
}
export interface ReferralOverride { attempts?: number; lastFollowUp?: string | null; status?: ReferralStatus }

export interface NetworkState {
  promoCode: string
  promoted: PartnerEntry[]
  potential: PartnerEntry[]
  requests: PromoRequest[]
  referrals: ReferralRow[]
  /** Edits to seeded or thread-derived referral rows, keyed by row id. */
  overrides: Record<string, ReferralOverride>
  starred: string[]
  archived: string[]
}

const row = (id: string, kind: ReferralKind, name: string, email: string, source: string, at: string, referredBy: string, lastFollowUp: string | null, attempts: number, agentId?: string): ReferralRow =>
  ({ id, kind, name, email, source, at, referredBy, lastFollowUp, attempts, status: 'open', agentId })

const seed = (): NetworkState => ({
  promoCode: 'ARJ-NAF-10OFF',
  promoted: [
    { id: 'priya-nair', agentId: 'priya-nair', name: 'Priya Nair', title: 'Mortgage Broker', city: 'Manchester' },
    { id: 'marcus-lee', agentId: 'marcus-lee', name: 'Marcus Lee', title: 'Home Loan Specialist', city: 'Birmingham' },
  ],
  potential: [{ id: 'daniel-okafor', agentId: 'daniel-okafor', name: 'Daniel Okafor', title: 'Loan Officer', city: 'Leeds' }],
  requests: [
    { id: 'pr-1', name: 'Hannah Whitfield', title: 'Estate Agent, Whitfield & Co', city: 'Birmingham', at: '2026-09-28T10:20:00Z', status: 'pending' },
    { id: 'pr-2', name: 'Tomasz Kowalski', title: 'Conveyancing Solicitor', city: 'Solihull', at: '2026-09-21T15:05:00Z', status: 'pending' },
    { id: 'pr-3', name: 'Grace Adeyemi', title: 'Financial Adviser', city: 'Coventry', at: '2026-09-09T09:40:00Z', status: 'declined' },
  ],
  referrals: [
    row('rc-1', 'received', 'Karthik Raman', 'karthik.raman@gmail.com', 'direct_referral', '2026-09-12T09:00:00Z', 'Itachi Uchiha', null, 0),
    row('rc-2', 'received', 'Abigail Charles', 'abigail.charles@outlook.com', 'direct_referral', '2026-09-05T14:30:00Z', 'Hannah Whitfield', null, 0),
    row('rc-3', 'received', 'Liam O’Connor', 'liam.oconnor@yahoo.co.uk', 'partner_page', '2026-09-18T11:15:00Z', 'Priya Nair', null, 0),
    row('rc-4', 'received', 'Meera Patel', 'meera.patel@gmail.com', 'promo_code', '2026-09-22T16:45:00Z', 'Marcus Lee', '2026-09-30T10:00:00Z', 1),
    row('rc-5', 'received', 'Oliver Grant', 'o.grant@grantbuild.co.uk', 'direct_referral', '2026-09-26T08:20:00Z', 'Tomasz Kowalski', '2026-10-01T09:30:00Z', 2),
    row('rc-6', 'received', 'Sana Iqbal', 'sana.iqbal@gmail.com', 'profile_page', '2026-08-29T13:00:00Z', 'Direct', '2026-09-29T12:00:00Z', 1),
    row('rq-1', 'requested', 'Nadia Hussain', 'nadia.hussain@gmail.com', 'direct_referral', '2026-09-14T10:00:00Z', 'You', '2026-09-20T10:00:00Z', 1),
    row('rq-2', 'requested', 'Callum Reid', 'callum.reid@proton.me', 'direct_referral', '2026-09-24T12:10:00Z', 'You', null, 0),
    row('rg-1', 'given', 'Beth Morgan', 'beth.morgan@gmail.com', 'direct_referral', '2026-09-02T09:15:00Z', 'You', '2026-09-10T09:00:00Z', 1),
    row('rg-2', 'given', 'Ravi Menon', 'ravi.menon@outlook.com', 'direct_referral', '2026-08-20T17:00:00Z', 'You', null, 0),
  ],
  overrides: {},
  starred: ['t-sofia'],
  archived: [],
})

export const networkStore = createStore<NetworkState>('nora-presence-network-v1', seed)

/** Contract: this module's contribution to the Search Rank Score, 0 to 100. */
export const networkPoints = (s: NetworkState): number => Math.min(100, s.promoted.length * 12 + (s.potential.length ? 4 : 0))

/** Partners pinned to the public pro page (the lead wires ProfilePage with this). */
export const promotedPartners = (): PartnerEntry[] => networkStore.get().promoted

// ---- partners ----

export const partnerOf = (a: Pick<Agent, 'id' | 'name' | 'title' | 'city'>): PartnerEntry => ({ id: a.id, agentId: a.id, name: a.name, title: a.title, city: a.city })
export const isPromoted = (s: NetworkState, id: string): boolean => s.promoted.some((p) => p.id === id)
export const isFull = (s: NetworkState): boolean => s.promoted.length >= MAX_PROMOTED

export type PromoteResult = 'ok' | 'full' | 'already'

export function promote(p: PartnerEntry): PromoteResult {
  const s = networkStore.get()
  if (isPromoted(s, p.id)) return 'already'
  if (isFull(s)) return 'full'
  networkStore.set({ ...s, promoted: [...s.promoted, p], potential: s.potential.filter((x) => x.id !== p.id) })
  return 'ok'
}
export const removePromoted = (id: string): void => networkStore.set((s) => ({ ...s, promoted: s.promoted.filter((p) => p.id !== id) }))
export function savePotential(p: PartnerEntry): boolean {
  const s = networkStore.get()
  if (isPromoted(s, p.id) || s.potential.some((x) => x.id === p.id)) return false
  networkStore.set({ ...s, potential: [...s.potential, p] })
  return true
}
export const removePotential = (id: string): void => networkStore.set((s) => ({ ...s, potential: s.potential.filter((p) => p.id !== id) }))

/** Accept promotes the requester when there is room; otherwise nothing changes and 'full' is returned. */
export function respondToRequest(id: string, accept: boolean): 'accepted' | 'declined' | 'full' | 'missing' {
  const s = networkStore.get()
  const r = s.requests.find((x) => x.id === id)
  if (!r) return 'missing'
  if (accept) {
    if (!isPromoted(s, r.id) && isFull(s)) return 'full'
    networkStore.set({
      ...s,
      requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'accepted' } : x)),
      promoted: isPromoted(s, r.id) ? s.promoted : [...s.promoted, { id: r.id, name: r.name, title: r.title, city: r.city }],
    })
    return 'accepted'
  }
  networkStore.set({ ...s, requests: s.requests.map((x) => (x.id === id ? { ...x, status: 'declined' } : x)) })
  return 'declined'
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function regeneratePromoCode(rand: () => number = Math.random): string {
  const part = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]).join('')
  const promoCode = `ARJ-${part}-10OFF`
  networkStore.set((s) => ({ ...s, promoCode }))
  return promoCode
}

// ---- referrals ----

const dayMs = 86_400_000
const firstOf = (t: Thread) => t.messages[0]
/** Referral rows derived from the real conversations created through the referral flow. */
export function threadReferrals(threads: Thread[], agents: Record<string, Agent>): ReferralRow[] {
  return threads.flatMap((t): ReferralRow[] => {
    if (!t.withAgentId || !t.messages.some((m) => m.from === 'me')) return []
    const a = agents[t.withAgentId]
    const first = firstOf(t)!
    const mine = t.messages.filter((m) => m.from === 'me')
    return [{
      id: `thread-${t.id}`,
      kind: first.from === 'me' ? 'requested' : 'given',
      name: t.withName, email: a?.email ?? '', source: 'referral_flow',
      at: first.at, referredBy: 'You',
      lastFollowUp: mine.length > 1 ? mine.at(-1)!.at : null,
      attempts: Math.max(0, mine.length - 1), status: 'open', agentId: t.withAgentId,
    }]
  })
}

/** All referral rows (seeded plus derived from threads), with follow-up edits applied. */
export function referralRows(s: NetworkState, threads: Thread[], agents: Record<string, Agent>): ReferralRow[] {
  const derived = threadReferrals(threads, agents).filter((d) => !s.referrals.some((r) => r.agentId && r.agentId === d.agentId && r.kind === d.kind))
  return [...s.referrals, ...derived].map((r) => ({ ...r, ...s.overrides[r.id] }))
}

export const referralCounts = (rows: ReferralRow[]): Record<ReferralKind, number> => {
  const c: Record<ReferralKind, number> = { received: 0, requested: 0, given: 0 }
  rows.forEach((r) => { if (r.status !== 'archived') c[r.kind]++ })
  return c
}

/** Received referrals still open that nobody followed up in STALE_DAYS days. */
export const staleReceived = (rows: ReferralRow[], now: number = Date.now()): ReferralRow[] =>
  rows.filter((r) => r.kind === 'received' && r.status === 'open' && now - Date.parse(r.lastFollowUp ?? r.at) > STALE_DAYS * dayMs)

/** `attempts` is the row's current count (rows derived from threads are not in the slice). */
export const followUp = (id: string, attempts: number, at: string = new Date().toISOString()): void =>
  networkStore.set((s) => ({ ...s, overrides: { ...s.overrides, [id]: { ...s.overrides[id], attempts: attempts + 1, lastFollowUp: at } } }))
export const setReferralStatus = (ids: string[], status: ReferralStatus): void =>
  networkStore.set((s) => ({ ...s, overrides: { ...s.overrides, ...Object.fromEntries(ids.map((id) => [id, { ...s.overrides[id], status }])) } }))

export type RefSort = 'name' | 'at' | 'lastFollowUp' | 'attempts'
export function sortRows(rows: ReferralRow[], key: RefSort, dir: 1 | -1): ReferralRow[] {
  const v = (r: ReferralRow): string | number => key === 'name' ? r.name.toLowerCase() : key === 'at' ? r.at : key === 'lastFollowUp' ? r.lastFollowUp ?? '' : r.attempts
  return [...rows].sort((a, b) => (v(a) < v(b) ? -1 : v(a) > v(b) ? 1 : 0) * dir)
}

// ---- messages ----

const toggle = (list: string[], id: string): string[] => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
export const toggleStar = (id: string): void => networkStore.set((s) => ({ ...s, starred: toggle(s.starred, id) }))
export const toggleArchive = (id: string): void => networkStore.set((s) => ({ ...s, archived: toggle(s.archived, id) }))

export type Folder = 'inbox' | 'starred' | 'archived'
/** Threads in a folder, optionally narrowed by a search over name, email and phone. */
export function folderThreads(s: NetworkState, threads: Thread[], agents: Record<string, Agent>, folder: Folder, q = ''): Thread[] {
  const t = q.trim().toLowerCase()
  return threads.filter((th) => {
    const arch = s.archived.includes(th.id)
    if (folder === 'archived' ? !arch : arch) return false
    if (folder === 'starred' && !s.starred.includes(th.id)) return false
    if (!t) return true
    const a = th.withAgentId ? agents[th.withAgentId] : undefined
    return [th.withName, a?.email ?? '', a?.phone ?? ''].some((x) => x.toLowerCase().includes(t))
  })
}

// ---- NORA ----

export function networkAnswer(): AiAnswer {
  const s = networkStore.get()
  const st = getState()
  const rows = referralRows(s, st.threads, st.agents)
  const c = referralCounts(rows)
  const pending = s.requests.filter((r) => r.status === 'pending').length
  const unread = st.threads.filter((t) => t.unread && !s.archived.includes(t.id)).length
  const stale = staleReceived(rows).length
  return {
    intro: `You have promoted ${s.promoted.length} of ${MAX_PROMOTED} partners and ${pending} promotion request${pending === 1 ? ' is' : 's are'} waiting.`,
    items: [
      { title: 'Promoted partners', detail: s.promoted.length ? `${s.promoted.map((p) => p.name).join(', ')} appear on your public profile.` : 'None yet. Promote up to 8 trusted partners to show them on your profile.' },
      { title: 'Promotion requests', detail: pending ? `${pending} pending request${pending === 1 ? '' : 's'} from other professionals.` : 'No pending requests.' },
      { title: 'Referrals', detail: `${c.received} received, ${c.requested} requested, ${c.given} given${stale ? `; ${stale} received referral${stale === 1 ? '' : 's'} not followed up in ${STALE_DAYS} days` : ''}.` },
      { title: 'Promo code', detail: `Your partner promo code is ${s.promoCode}.` },
      { title: 'Messages', detail: unread ? `${unread} unread conversation${unread === 1 ? '' : 's'}.` : 'You are all caught up.' },
    ],
    links: [
      { label: 'Open Partners', to: '/network?tab=partners' },
      { label: 'Open Referrals', to: '/network?tab=referrals' },
      { label: 'Open Messages', to: '/messages' },
    ],
  }
}

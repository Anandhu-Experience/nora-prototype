import { useEffect, useState } from 'react'
import { agentCompleteness, agentGaps, recommendedActions } from '../profile/selectors'
import type { Agent } from '../profile/types'
import { CONNECTIONS, connectionsPoints, connectionsStore, isConnected, missingConnections } from './connections'
import { FIELD_LABEL, dataIssues, listingsStore, listingsSummary, proposeFix, type InfoField } from './listings'
import { napConflicts, napLabel } from './nap'
import { networkStore } from './network'
import { createStore, nowIso, subscribeAllPresence } from './persist'
import { authorityScore, publishedCount, voceStore, voceSuggestions } from './voce'
import { simulate, type SimChange } from './srs'
import { websiteIssues, websiteStore, WEBSITE_MAX, websitePoints } from './website'

/**
 * NORA OS: one place for everything NORA is watching. Issues are derived from the live data of every module (so they
 * disappear the moment the user fixes them, wherever they fix them); trackers are the numbers behind them.
 * Nothing here writes to a module.
 */
export type OsModule = 'Profile' | 'Connections' | 'Listings' | 'Web Analytics' | 'Reviews' | 'AI Visibility' | 'Network'
export const OS_MODULES: OsModule[] = ['Profile', 'Connections', 'Listings', 'Web Analytics', 'Reviews', 'AI Visibility', 'Network']
export type Severity = 'high' | 'medium' | 'low'

/** The five V3 capability areas every issue belongs to. */
export type CapabilityId = 'identity' | 'local' | 'reputation' | 'discoverability' | 'content'
export const CAPABILITY_OF: Record<OsModule, CapabilityId> = { Profile: 'identity', Connections: 'local', Listings: 'local', 'Web Analytics': 'discoverability', Reviews: 'reputation', 'AI Visibility': 'content', Network: 'content' }

export interface OsIssue {
  /** Stable across renders, so the same issue is recognised when it is seen again or resolves. */
  id: string
  module: OsModule
  title: string
  detail: string
  /** The capability area this belongs to. */
  capability: CapabilityId
  /** Points it would earn, or a short note. */
  impact?: string
  /** Search Rank Score points the fix is worth, priced with the same maths as the live score. */
  points?: number
  /** Rank effect of the fix, when it moves the professional up. */
  rank?: { from: number; to: number; of: number }
  severity: Severity
  /** Where the user goes to fix it. */
  to: string
  cta: string
  /** When set, "Fix with NORA" runs this NORA domain instead of just navigating. */
  nora?: 'profile' | 'connections' | 'reviews'
}

const unreplied = (a: Agent) => a.reviews.filter((r) => !r.reply?.trim())

type RawIssue = Omit<OsIssue, 'capability'>

/** Everything that needs attention right now, most important first. */
export function collectIssues(a: Agent): OsIssue[] {
  const out: RawIssue[] = []

  const conns = connectionsStore.get()
  for (const m of missingConnections(conns)) {
    out.push({
      id: `conn:${m.id}`, module: 'Connections', title: m.id === 'google' ? 'Connect Google to unlock Insights' : `Connect ${m.name}`,
      detail: m.value, impact: `+${m.points} pts`, severity: m.id === 'google' ? 'high' : m.points >= 8 ? 'medium' : 'low',
      to: '/connections', cta: m.id === 'google' ? 'Fix with NORA' : m.kind === 'link' ? 'Add link' : 'Connect', nora: m.id === 'google' ? 'connections' : undefined,
    })
  }

  // high only when the gap is one the completeness figure counts; the rest strengthen the profile without moving it
  const counted = new Set(agentGaps(a))
  const COUNTED: Record<string, string> = { photo: 'photoUrl', specialties: 'specialties', bio: 'bio' }
  for (const r of recommendedActions(a)) {
    out.push({
      id: `profile:${r.id}`, module: 'Profile', title: r.title, detail: r.description,
      severity: COUNTED[r.id] && counted.has(COUNTED[r.id]!) ? 'high' : 'medium',
      to: '/profile', cta: r.id === 'specialties' ? 'Fix with NORA' : r.cta, nora: r.id === 'specialties' ? 'profile' : undefined,
    })
  }

  const listings = listingsStore.get()
  for (const i of dataIssues(listings.info)) out.push({ id: `listing:${i.id}`, module: 'Listings', title: `Fix listing data: ${FIELD_LABEL[i.id].toLowerCase()}`, detail: i.message, impact: `+${i.points} pts`, severity: 'high', to: '/listings', cta: 'Open Listings' })
  for (const site of listings.sites.filter((x) => x.status === 'failed')) out.push({ id: `listing-site:${site.id}`, module: 'Listings', title: `${site.name} did not publish`, detail: site.note || 'The directory rejected the listing. Check the business details and try again.', severity: 'medium', to: '/listings', cta: 'Open Listings' })

  const web = websiteStore.get()
  if (web.status !== 'verified') {
    out.push({ id: 'web:verify', module: 'Web Analytics', title: 'Verify your website', detail: 'Until the site is verified and scanned it earns no Web Analytics points.', impact: `up to +${WEBSITE_MAX} pts`, severity: 'high', to: '/analytics', cta: 'Open Web Analytics' })
  } else if (web.scan) {
    for (const i of websiteIssues(web).slice(0, 5)) out.push({ id: `web:${i.id}`, module: 'Web Analytics', title: i.label, detail: i.fix, impact: `+${i.gain} pts`, severity: i.gain >= 40 ? 'high' : 'medium', to: '/analytics', cta: 'Open Web Analytics' })
  }

  for (const r of unreplied(a)) out.push({ id: `review:${r.id}`, module: 'Reviews', title: `Reply to ${r.author}’s ${r.rating}-star review`, detail: r.text.length > 110 ? `${r.text.slice(0, 107)}…` : r.text, severity: r.rating >= 4 ? 'low' : 'medium', to: '/profile?tab=reviews', cta: 'Fix with NORA', nora: 'reviews' })

  for (const s of voceSuggestions(voceStore.get(), a.specialties[0] ?? 'mortgages')) out.push({ id: `ai:${s.id}`, module: 'AI Visibility', title: s.title, detail: s.detail, impact: s.impact, severity: 'low', to: '/ai-visibility', cta: s.cta })

  for (const q of networkStore.get().requests.filter((x) => x.status === 'pending')) out.push({ id: `net:${q.id}`, module: 'Network', title: `${q.name} wants to be a partner`, detail: `${q.title}, ${q.city}. Accept or decline the request.`, severity: 'low', to: '/network', cta: 'Open Network' })

  for (const c of napConflicts(a)) {
    out.push({
      id: `nap:${c.id}`, module: c.where === 'Listings' ? 'Listings' : 'Web Analytics', title: `Your ${napLabel(c)} does not match your profile`,
      detail: `Profile: ${c.profile}. ${c.where}: ${c.other}. Mismatched details hurt local search.`, impact: 'Keeps your details consistent', severity: 'high',
      to: c.fixField ? `/listings?fix=${c.fixField}` : c.where === 'Listings' ? '/listings' : '/analytics', cta: 'Review Issue',
    })
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  return out.map((i) => price(a, { ...i, capability: CAPABILITY_OF[i.module] })).sort((x, y) => rank[x.severity] - rank[y.severity] || Number(y.id.startsWith('nap:')) - Number(x.id.startsWith('nap:')) || (y.points ?? 0) - (x.points ?? 0))
}

/** What the issue's fix changes, in the terms the score reads, or null when it does not move the score. */
function changeFor(id: string, a: Agent): SimChange | null {
  if (id.startsWith('conn:')) return { connect: [id.slice(5) as never] }
  if (id.startsWith('review:')) return { reply: [id.slice(7)] }
  if (id === 'profile:specialties') return { profile: { specialties: Array.from({ length: 5 }, (_, i) => a.specialties[i] ?? `specialty ${i}`) } }
  if (id === 'profile:bio') return { profile: { about: a.about.trim() ? a.about : 'bio' } }
  if (id === 'profile:photo') return { profile: { photoUrl: a.photoUrl || 'photo' } }
  if (id.startsWith('listing:')) { const f = id.slice(8) as InfoField; return { listingInfo: { [f]: proposeFix(f).value } } }
  return null
}

/** Add the score the fix is worth, priced with the live score's own maths (never a separate estimate). */
function price(a: Agent, issue: OsIssue): OsIssue {
  const change = changeFor(issue.id, a)
  if (!change) return issue
  const sim = simulate(a, change)
  const moved = sim.rankAfter < sim.rankBefore ? { from: sim.rankBefore, to: sim.rankAfter, of: sim.of } : undefined
  return { ...issue, points: sim.delta, rank: moved, impact: sim.delta > 0 ? `+${sim.delta} pt${sim.delta === 1 ? '' : 's'}` : issue.impact }
}

/** The NORA skill that resolves an issue, when there is one (the rest are fixed by hand on their page). */
export function skillForIssue(id: string): string | null {
  if (id === 'conn:google') return 'connection-setup'
  if (id === 'profile:specialties' || id === 'profile:bio') return 'profile-completion'
  if (id.startsWith('review:')) return 'review-reply'
  return null
}

/* ---------------- trackers ---------------- */

export interface Tracker {
  id: string
  label: string
  value: string
  detail: string
  /** 0 to 100. */
  pct: number
  to: string
}

/** The numbers NORA tracks, one per module. */
export function collectTrackers(a: Agent): Tracker[] {
  const conns = connectionsStore.get()
  const on = CONNECTIONS.filter((c) => isConnected(conns, c.id)).length
  const l = listingsSummary(listingsStore.get())
  const web = websiteStore.get()
  const wp = websitePoints(web)
  const voce = voceStore.get()
  const replied = a.reviews.length - unreplied(a).length
  const net = networkStore.get()
  const pct = (n: number, max: number) => (max ? Math.round((n / max) * 100) : 0)
  return [
    { id: 'profile', label: 'Profile completeness', value: `${agentCompleteness(a)}%`, detail: `${recommendedActions(a).length} suggestion${recommendedActions(a).length === 1 ? '' : 's'} left`, pct: agentCompleteness(a), to: '/profile' },
    { id: 'connections', label: 'Connections', value: `${on} of ${CONNECTIONS.length}`, detail: `${connectionsPoints(conns)} of 100 points`, pct: connectionsPoints(conns), to: '/connections' },
    { id: 'listings', label: 'Listings published', value: `${l.published} of ${l.total}`, detail: l.issues ? `${l.issues} data issue${l.issues === 1 ? '' : 's'}` : 'No data issues', pct: pct(l.published, l.total), to: '/listings' },
    { id: 'website', label: 'Website score', value: `${wp} of ${WEBSITE_MAX}`, detail: web.status === 'verified' ? 'Verified and scanned' : 'Not verified yet', pct: pct(wp, WEBSITE_MAX), to: '/analytics' },
    { id: 'reviews', label: 'Review replies', value: `${replied} of ${a.reviews.length}`, detail: a.reviews.length === replied ? 'Every review has a reply' : `${a.reviews.length - replied} waiting for a reply`, pct: pct(replied, a.reviews.length), to: '/profile?tab=reviews' },
    { id: 'ai', label: 'AI authority', value: `${authorityScore(voce)} of 100`, detail: `${publishedCount(voce)} published article${publishedCount(voce) === 1 ? '' : 's'}`, pct: authorityScore(voce), to: '/ai-visibility' },
    { id: 'network', label: 'Promoted partners', value: `${net.promoted.length} of 8`, detail: `${net.requests.filter((x) => x.status === 'pending').length} request(s) waiting`, pct: pct(net.promoted.length, 8), to: '/network' },
  ]
}

/* ---------------- issue history ---------------- */

export interface Seen { title: string; module: OsModule; firstSeen: string; resolvedAt?: string }
export interface OsState { seen: Record<string, Seen> }

export const noraOsStore = createStore<OsState>('nora-presence-os-v1', () => ({ seen: {} }))

/** Pure: what the history looks like after seeing `current`. Returns the same object when nothing changed. */
export function reconcile(state: OsState, current: OsIssue[], now: string = nowIso()): OsState {
  const ids = new Set(current.map((i) => i.id))
  const seen = { ...state.seen }
  let changed = false
  for (const i of current) {
    const prev = seen[i.id]
    if (!prev || prev.resolvedAt) { seen[i.id] = { title: i.title, module: i.module, firstSeen: now }; changed = true } // new, or came back after being resolved
  }
  for (const [id, s] of Object.entries(seen)) {
    if (!ids.has(id) && !s.resolvedAt) { seen[id] = { ...s, resolvedAt: now }; changed = true }
  }
  return changed ? { seen } : state
}

/** Record the current issues, noting what resolved since last time. */
export const syncIssueHistory = (current: OsIssue[]): void => {
  const next = reconcile(noraOsStore.get(), current)
  if (next !== noraOsStore.get()) noraOsStore.set(next)
}

export const resolvedIssues = (s: OsState): (Seen & { id: string })[] =>
  Object.entries(s.seen).filter(([, v]) => v.resolvedAt).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.resolvedAt!.localeCompare(a.resolvedAt!))

/** Re-render the caller whenever any module store changes (issues and trackers are derived, so they are recomputed on render). */
export function useOsRefresh(): void {
  const [, bump] = useState(0)
  useEffect(() => subscribeAllPresence(() => bump((n) => n + 1)), [])
}

import { missingProfileFields, profileCompleteness } from '../mock/rules'
import type { Agent, Review, StoreState } from './types'

export const COVERS: Record<string, { label: string; css: string }> = {
  sunset: { label: 'Sunset', css: 'linear-gradient(135deg,#1e2a4a 0%,#5b3b7a 40%,#e0705a 75%,#f3b46b 100%)' },
  ocean: { label: 'Ocean', css: 'linear-gradient(135deg,#0b3b66 0%,#1479b8 55%,#6cc7e6 100%)' },
  forest: { label: 'Forest', css: 'linear-gradient(135deg,#0f3d2e 0%,#2f7d4f 55%,#a6d49a 100%)' },
  dusk: { label: 'Dusk', css: 'linear-gradient(135deg,#2b1055 0%,#7597de 100%)' },
  slate: { label: 'Slate', css: 'linear-gradient(135deg,#1f2937 0%,#475569 60%,#94a3b8 100%)' },
}
export const PRESET_COVERS = Object.keys(COVERS)

export function coverStyle(cover: string): { backgroundImage: string; backgroundSize?: string; backgroundPosition?: string } {
  if (cover.startsWith('data:')) return { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return { backgroundImage: (COVERS[cover] ?? COVERS.sunset).css }
}

export interface RatingStats {
  count: number
  avg: number
  /** Index 0 = 5 stars ... index 4 = 1 star. */
  dist: { stars: number; count: number; pct: number }[]
}

export function ratingStats(reviews: Review[]): RatingStats {
  const count = reviews.length
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0
  const dist = [5, 4, 3, 2, 1].map((stars) => {
    const c = reviews.filter((r) => r.rating === stars).length
    return { stars, count: c, pct: count ? Math.round((c / count) * 100) : 0 }
  })
  return { count, avg, dist }
}

export const fmtRating = (n: number) => (n ? n.toFixed(2) : '–')

export function isTopRated(a: Agent): boolean {
  const s = ratingStats(a.reviews)
  return s.count >= 3 && s.avg >= 4.5
}

export const satisfaction = (a: Agent): number => Math.round((ratingStats(a.reviews).avg / 5) * 100)

export const initials = (name: string): string =>
  name.replace(/^agent\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export interface Insight {
  id: string
  icon: 'star' | 'chart' | 'pin' | 'clock' | 'award'
  text: string
  /** Question the assistant answers when this insight is clicked. */
  prompt: string
}

export function insightsFor(a: Agent): Insight[] {
  const s = ratingStats(a.reviews)
  const out: Insight[] = []
  if (s.count) out.push({ id: 'rating', icon: 'star', text: `Highly rated by clients (${s.avg.toFixed(2)} average)`, prompt: 'Summarize this agent’s reviews' })
  if (a.specialties.length) {
    out.push({ id: 'spec', icon: 'chart', text: `Specializes in ${a.specialties.slice(0, 2).map((x) => x.toLowerCase()).join(' and ')}`, prompt: 'What services do they offer?' })
  }
  out.push({ id: 'local', icon: 'pin', text: `Strong local presence in ${a.location}`, prompt: 'What are their key strengths?' })
  out.push({ id: 'resp', icon: 'clock', text: `Typically responds within ${a.responseTime}`, prompt: 'What are their key strengths?' })
  if (a.awards.length) out.push({ id: 'awards', icon: 'award', text: `${a.awards.length} industry award${a.awards.length === 1 ? '' : 's'}`, prompt: 'Show recent activity and achievements' })
  return out
}

/** Other agents ranked by how comparable they are to `a`. */
export function similarAgents(state: StoreState, a: Agent): Agent[] {
  const score = (o: Agent) =>
    (o.city === a.city ? 2 : 0) +
    o.specialties.filter((s) => a.specialties.includes(s)).length +
    (o.title === a.title ? 1 : 0)
  return state.order
    .map((id) => state.agents[id]!)
    .filter((o) => o.id !== a.id)
    .sort((x, y) => score(y) - score(x) || ratingStats(y.reviews).avg - ratingStats(x.reviews).avg)
}

export const cities = (state: StoreState): string[] =>
  [...new Set(state.order.map((id) => state.agents[id]!.city))].sort()

export const allServices = (state: StoreState): string[] =>
  [...new Set(state.order.flatMap((id) => state.agents[id]!.services.map((s) => s.name)))].sort()

export function vcard(a: Agent): string {
  return [
    'BEGIN:VCARD', 'VERSION:3.0', `FN:${a.name}`, `TITLE:${a.title}`, `ORG:${a.company}`,
    a.phone && `TEL;TYPE=WORK:${a.phone}`, a.email && `EMAIL:${a.email}`, a.social.website && `URL:${a.social.website}`,
    `ADR;TYPE=WORK:;;${a.location};;;;`, `NOTE:NMLS #${a.nmls}`, 'END:VCARD',
  ].filter(Boolean).join('\r\n')
}

const asRuleProfile = (a: Agent) => ({
  name: a.name, photoUrl: a.photoUrl, headline: a.title, phone: a.phone, location: a.location, bio: a.about, specialties: a.specialties,
})
/** Same data-quality rules NORA uses, applied to any agent. */
export const agentCompleteness = (a: Agent): number => profileCompleteness(asRuleProfile(a))
export const agentGaps = (a: Agent): string[] => missingProfileFields(asRuleProfile(a))

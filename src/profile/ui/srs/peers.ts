import { DRIVER_MAX, type DriverId } from '../../../presence/srs'

const ORDER: DriverId[] = ['reviews', 'website', 'profile', 'listings', 'connections']
const LABEL: Record<DriverId, string> = { profile: 'Profile', website: 'Web Analytics', reviews: 'Reviews', listings: 'Listings', connections: 'Connections' }
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** A deterministic split of a peer's score across the drivers (sums to the score, never above a driver's maximum). */
export function peerBreakdown(id: string, score: number): Record<DriverId, number> {
  const weights = ORDER.map((d) => DRIVER_MAX[d] * (0.4 + (hash(`${id}:${d}`) % 55) / 100))
  const wsum = weights.reduce((a, b) => a + b, 0)
  const out = {} as Record<DriverId, number>
  ORDER.forEach((d, i) => { out[d] = Math.min(DRIVER_MAX[d], Math.floor((weights[i]! / wsum) * score)) })
  let left = score - ORDER.reduce((n, d) => n + out[d], 0)
  for (let pass = 0; left > 0 && pass < 1000; pass++) {
    const d = ORDER[pass % ORDER.length]!
    if (out[d] < DRIVER_MAX[d]) { out[d]++; left-- }
  }
  return out
}

/** Why a peer is ahead: the drivers where they have more points than the viewer, biggest gap first. */
export function whyAhead(peer: { id: string; score: number }, mine: Record<DriverId, number>): { driver: DriverId; label: string; diff: number }[] {
  const theirs = peerBreakdown(peer.id, peer.score)
  return ORDER.map((d) => ({ driver: d, label: LABEL[d], diff: theirs[d] - mine[d] })).filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff)
}

/** Twelve weekly scores that end at the current total (deterministic mock). */
export function scoreHistory(total: number, weeks = 12): number[] {
  const start = Math.round(total * 0.62)
  return Array.from({ length: weeks }, (_, i) => {
    if (i === weeks - 1) return total
    const t = i / (weeks - 1)
    const wobble = ((hash(`w${i}`) % 7) - 3) * (total / 200)
    return Math.max(0, Math.round(start + (total - start) * t + wobble))
  })
}

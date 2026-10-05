import type { Graph } from '../../mock/graph'

export interface GraphChange {
  path: string
  before: string
  after: string
}

const show = (v: unknown) => (Array.isArray(v) ? `[${v.join(', ')}]` : String(v))

/** The graph fields a write can move, as readable before/after pairs. */
export function graphChanges(before: Graph, after: Graph): GraphChange[] {
  const pairs: [string, unknown, unknown][] = [
    ['profile.missing', before.profile.missing, after.profile.missing],
    ['profile.completeness', before.profile.completeness, after.profile.completeness],
    ['listings.incomplete', before.listings.incomplete, after.listings.incomplete],
    ['accounts.google', before.accounts.google, after.accounts.google],
    ['accounts.points', before.accounts.points, after.accounts.points],
  ]
  return pairs
    .filter(([, b, a]) => show(b) !== show(a))
    .map(([path, b, a]) => ({ path, before: show(b), after: show(a) }))
}

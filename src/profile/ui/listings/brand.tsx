import { connectionMeta, type ConnectionId } from '../../../presence/connections'

const TONE: Record<ConnectionId, string> = {
  google: 'bg-blue-50 text-blue-600', facebook: 'bg-indigo-50 text-indigo-600', linkedin: 'bg-sky-50 text-sky-700', x: 'bg-slate-100 text-slate-900',
  instagram: 'bg-pink-50 text-pink-600', youtube: 'bg-rose-50 text-rose-600', yelp: 'bg-red-50 text-red-600', zillow: 'bg-blue-50 text-blue-700',
  realtor: 'bg-rose-50 text-rose-700', lendingtree: 'bg-emerald-50 text-emerald-700', tripadvisor: 'bg-emerald-50 text-emerald-600',
}

/** Brand letter badge (lucide has no brand icons). */
export function BrandBadge({ id, size = 'md' }: { id: ConnectionId; size?: 'md' | 'lg' }) {
  return <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl font-bold ${size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-10 w-10 text-base'} ${TONE[id]}`}>{connectionMeta(id).letter}</span>
}

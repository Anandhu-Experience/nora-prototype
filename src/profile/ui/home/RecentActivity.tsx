import { History } from 'lucide-react'
import { Link } from 'react-router-dom'
import { timeAgo } from '../../selectors'
import type { Agent } from '../../types'

/** What changed lately on the profile, including what NORA did (the store records both). */
export function RecentActivity({ agent }: { agent: Agent }) {
  const items = [...agent.activity].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card" aria-label="Recent activity">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold text-slate-900"><History size={18} className="text-slate-500" /> Recent activity</h2>
        <Link to={`/profile/${agent.id}?tab=activity`} className="text-sm font-medium text-blue-600 hover:underline">See all</Link>
      </div>
      {items.length === 0 ? <p className="mt-3 text-sm text-slate-500">Nothing yet. Changes you and NORA make appear here.</p> : (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {items.map((i) => <li key={i.id} className="flex items-baseline justify-between gap-3 py-2"><span className="text-slate-700">{i.text}</span><span className="shrink-0 text-xs text-slate-400">{timeAgo(i.at)}</span></li>)}
        </ul>
      )}
    </section>
  )
}

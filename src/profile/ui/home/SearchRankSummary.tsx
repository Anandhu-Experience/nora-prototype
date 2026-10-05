import { Link } from 'react-router-dom'
import { bandOf, leaderboard, useSrs } from '../../../presence/srs'
import type { Agent } from '../../types'
import { Ring } from '../kit'

/** The one place the overview shows the Search Rank Score: the value, its band, the rank and the gap to the next rank. */
export function SearchRankSummary({ agent }: { agent: Agent }) {
  const srs = useSrs(agent)
  const board = leaderboard(agent, srs)
  const me = board.find((r) => r.me)!
  const above = board[me.rank - 2]
  const band = bandOf(srs.total)
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card" aria-label="Search Rank Score">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Search Rank Score</div>
      <div className="mt-3 flex items-center gap-4">
        <Ring value={srs.total} max={srs.max} size={104} label={`${srs.total} of ${srs.max}`}>
          <span className="text-2xl font-bold text-slate-900">{srs.total}</span><span className="text-[11px] text-slate-500">of {srs.max}</span>
        </Ring>
        <div className="min-w-0 text-sm">
          <div className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{band.label}</div>
          <p className="mt-2 text-slate-700">Rank <b className="text-slate-900">#{me.rank}</b> of {board.length} near you</p>
          <p className="text-slate-500">{above ? `${above.score - srs.total} points to #${me.rank - 1}` : 'You lead your area'}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4" aria-label="Score by driver">
        {srs.drivers.map((d) => {
          const pct = Math.round((d.points / d.max) * 100)
          return (
            <li key={d.id}>
              <Link to={d.to} className="group block" data-driver={d.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 group-hover:text-blue-600">{d.label}</span>
                  <span className="tabular-nums text-slate-500">{d.points}<span className="text-slate-400"> / {d.max}</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <Link to="/search-rank" className="mt-auto pt-4 text-sm font-semibold text-blue-600 hover:underline">Why is my score this value? →</Link>
    </section>
  )
}

import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { OsIssue } from '../../../presence/noraOs'
import { Pill } from '../kit'
import { BTN_PRIMARY } from '../Modal'

const impactOf = (i: OsIssue): string | null =>
  i.points && i.points > 0
    ? `${i.impact ?? `+${i.points} pts`} to your Search Rank Score${i.rank ? `, rank #${i.rank.from} → #${i.rank.to} of ${i.rank.of}` : ''}`
    : (i.impact ?? null)

/**
 * Current state, problem, recommended action, expected impact: the top open issue, then the next two. Reads the same
 * issue list as NORA OS and the floating NORA button, so the three always agree.
 */
export function NextBestAction({ issues, onRun }: { issues: OsIssue[]; onRun: (i: OsIssue) => void }) {
  const [top, ...rest] = issues
  if (!top) {
    return (
      <section className="flex flex-col justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-card" aria-label="Next best action">
        <div className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 size={18} /> You are all set</div>
        <p className="mt-1 text-sm text-emerald-800">Nothing needs your attention. NORA will list anything new here.</p>
      </section>
    )
  }
  const impact = impactOf(top)
  return (
    <section className="flex flex-col rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-white p-5 shadow-card" aria-label="Next best action" data-next-action={top.id}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-purple-700"><Sparkles size={14} /> Next best action</div>
        <Pill tone={top.severity === 'high' ? 'red' : top.severity === 'medium' ? 'amber' : 'slate'}>{top.module}</Pill>
      </div>
      <h2 className="mt-2 text-xl font-bold leading-snug text-slate-900">{top.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{top.detail}</p>
      {impact && <p className="mt-2 text-sm font-medium text-emerald-700">Expected impact: {impact}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className={BTN_PRIMARY} onClick={() => onRun(top)}>{top.cta} <ArrowRight size={14} /></button>
        <Link to="/nora-os" className="text-sm font-medium text-slate-600 hover:text-blue-600 hover:underline">View all {issues.length} issue{issues.length === 1 ? '' : 's'}</Link>
      </div>
      {rest.length > 0 && (
        <div className="mt-4 flex flex-1 flex-col border-t border-slate-100 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Up next</div>
          <ul className="mt-1 flex-1 divide-y divide-slate-100 text-sm">
            {rest.slice(0, 4).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Pill tone={i.severity === 'high' ? 'red' : i.severity === 'medium' ? 'amber' : 'slate'}>{i.module}</Pill>
                  <span className="min-w-0 truncate text-slate-700">{i.title}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {i.points && i.points > 0 ? <span className="text-xs font-medium text-emerald-700">+{i.points} pts</span> : null}
                  <button onClick={() => onRun(i)} className="text-xs font-semibold text-blue-600 hover:underline">{i.cta}</button>
                </span>
              </li>
            ))}
          </ul>
          {issues.length > 5 && <p className="pt-2 text-xs text-slate-500">and {issues.length - 5} more in NORA OS</p>}
        </div>
      )}
    </section>
  )
}

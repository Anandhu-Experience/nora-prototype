import { Building2, ChevronRight, FileText, MapPin, Star, TrendingUp, User, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CapabilityHealth } from '../../../presence/capabilities'
import type { CapabilityId, OsIssue } from '../../../presence/noraOs'
import { Pill, type PillTone } from '../kit'

const ICON: Record<CapabilityId, LucideIcon> = { identity: User, local: MapPin, reputation: Star, discoverability: TrendingUp, content: FileText }
const STATUS: Record<CapabilityHealth['status'], { label: string; tone: PillTone; bar: string }> = {
  healthy: { label: 'Healthy', tone: 'green', bar: 'bg-emerald-500' },
  attention: { label: 'Needs attention', tone: 'amber', bar: 'bg-amber-500' },
  critical: { label: 'Action needed', tone: 'red', bar: 'bg-rose-500' },
}

/** One row per V3 capability: its health from existing figures, and the single most useful next step. */
export function CapabilityHealthSection({ health, onRun }: { health: CapabilityHealth[]; onRun: (i: OsIssue) => void }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card" aria-label="Capability health">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <Building2 size={18} className="text-slate-500" />
        <h2 className="text-[17px] font-semibold text-slate-900">Your presence, by capability</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {health.map((h) => {
          const Icon = ICON[h.id]
          const st = STATUS[h.status]
          return (
            <li key={h.id} data-capability={h.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-center">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={h.to} className="font-semibold text-slate-900 hover:underline">{h.label}</Link>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <div className="text-sm text-slate-700">{h.headline}</div>
                  <div className="text-xs text-slate-500">{h.detail}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={h.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${h.label} ${h.pct}%`}>
                    <div className={`h-full rounded-full ${h.pct >= 100 ? 'bg-emerald-500' : st.bar}`} style={{ width: `${h.pct}%` }} />
                  </div>
                </div>
              </div>
              {h.top ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-900">{h.top.title}</div>
                    <div className="truncate text-xs text-slate-500">{h.top.impact ?? h.top.detail}{h.issues.length > 1 ? ` · ${h.issues.length - 1} more` : ''}</div>
                  </div>
                  <button onClick={() => onRun(h.top!)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-blue-600 bg-white px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50">{h.top.cta} <ChevronRight size={13} /></button>
                </div>
              ) : <div className="text-sm text-emerald-700 md:text-right">Nothing to fix here.</div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

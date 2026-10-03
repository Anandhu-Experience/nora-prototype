import { ArrowDownRight, ArrowUpRight, CheckCircle2, Circle, Lock, Minus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectionsStore, isConnected } from '../../../presence/connections'
import { RANGES, SRS_UNLOCK, TODAY, insightsStore, rangeError, setCustomRange, setRange, unlock, type Delta, type RangeId } from '../../../presence/insights'
import { useSrs } from '../../../presence/srs'
import { useStore } from '../../store'
import { BTN_PRIMARY, BTN_OUTLINE, INPUT } from '../Modal'
import { Field } from '../bits'
import { ScrollFade } from '../ScrollFade'

/** Pro + Google + SRS, live: re-renders when the connection, the profile or any score driver changes. */
export function useUnlock() {
  const state = useStore()
  const me = state.agents[state.viewerId]!
  const srs = useSrs(me)
  const google = isConnected(connectionsStore.use(), 'google')
  const u = unlock(me.pro, google, srs.total)
  return { ...u, google, srsTotal: srs.total, googleOk: google && srs.total >= SRS_UNLOCK, me }
}

/** The plan's "Unlock the Insights Dashboard in 3 steps" panel. */
export function UnlockPanel({ compact = false }: { compact?: boolean }) {
  const nav = useNavigate()
  const { steps, gap, srsTotal } = useUnlock()
  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Lock size={16} className="text-blue-600" /> Unlock the Insights Dashboard in 3 steps</div>
      {!compact && <p className="mt-1 text-xs text-slate-500">Google views, impressions and actions come from your Google Business Profile.</p>}
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
            {s.done ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" aria-label="Done" /> : <Circle size={18} className="shrink-0 text-slate-300" aria-label="To do" />}
            <div className="min-w-0 flex-1 text-sm text-slate-800">
              <span className="font-medium">{i + 1}. {s.id === 'srs' ? (s.done ? `Search Rank Score is ${srsTotal} (400 needed)` : `Your Search Rank Score is ${srsTotal}. Reach ${SRS_UNLOCK} to unlock (${gap} to go)`) : s.label}</span>
              {s.done && s.id !== 'srs' && <span className="ml-2 text-xs text-emerald-600">Done</span>}
            </div>
            {!s.done && s.id === 'google' && <button onClick={() => nav('/connections')} className={BTN_PRIMARY}>Connect</button>}
            {!s.done && s.id === 'srs' && <button onClick={() => nav('/search-rank')} className={BTN_OUTLINE}>Improve SRS</button>}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Google-sourced content: shown for real when unlocked, otherwise a blurred, non-interactive preview under the 3-step panel. */
export function GoogleLock({ children }: { children: ReactNode }) {
  const { googleOk } = useUnlock()
  if (googleOk) return <>{children}</>
  return (
    <div className="space-y-4">
      <UnlockPanel />
      <div aria-hidden className="pointer-events-none select-none opacity-60 blur-[3px]">{children}</div>
    </div>
  )
}

/** Global date filter. The range lives in insightsStore, so it survives tab changes and navigation. */
export function DateRangeBar() {
  const s = insightsStore.use()
  const [start, setStart] = useState(s.customStart)
  const [end, setEnd] = useState(s.customEnd)
  const [showCustom, setShowCustom] = useState(s.range === 'custom')
  const err = showCustom ? rangeError(start, end) : null
  const pick = (id: RangeId) => {
    if (id === 'custom') { setShowCustom(true); return }
    setShowCustom(false)
    setRange(id)
  }
  return (
    <div className="flex flex-wrap items-end justify-end gap-x-4 gap-y-3">
      <ScrollFade axis="x" tone="page" className="max-w-full" innerClassName="flex gap-1 rounded-xl border border-slate-200 bg-white p-1" innerProps={{ role: 'group', 'aria-label': 'Date range' }}>
        {RANGES.map((r) => {
          const on = (r.id === 'custom' ? showCustom || s.range === 'custom' : s.range === r.id && !showCustom)
          return <button key={r.id} onClick={() => pick(r.id)} aria-pressed={on} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${on ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{r.label}</button>
        })}
      </ScrollFade>
      {showCustom && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-36"><Field label="Start date"><input type="date" max={TODAY} value={start} onChange={(e) => setStart(e.target.value)} className={INPUT} /></Field></div>
          <div className="w-36"><Field label="End date"><input type="date" max={TODAY} value={end} onChange={(e) => setEnd(e.target.value)} className={INPUT} /></Field></div>
          <button disabled={!!err} onClick={() => setCustomRange(start, end)} className={BTN_PRIMARY}>Apply</button>
          {err && <p role="alert" className="basis-full text-right text-xs text-rose-600">{err}</p>}
        </div>
      )}
    </div>
  )
}

/** Small sub-tab pills inside a tab. */
export function SubTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <ScrollFade axis="x" innerClassName="flex gap-1" innerProps={{ role: 'tablist' }}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${value === t.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>{t.label}</button>
      ))}
    </ScrollFade>
  )
}

export function DeltaBadge({ d }: { d: Delta }) {
  const Icon = d.dir === 'up' ? ArrowUpRight : d.dir === 'down' ? ArrowDownRight : Minus
  const tone = d.dir === 'up' ? 'text-emerald-600 bg-emerald-50' : d.dir === 'down' ? 'text-rose-600 bg-rose-50' : 'text-slate-500 bg-slate-100'
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}><Icon size={13} />{d.pct > 0 ? '+' : ''}{d.pct}%</span>
}

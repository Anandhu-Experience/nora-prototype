import { BarChart3, Eye, Gauge, History, Search, Send, Sparkles, Star, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { series, windowFor } from '../../../presence/insights'
import { ANALYTICS } from '../../seed'
import { agentCompleteness, agentGaps, fmtDate, fmtRating, insightsFor, ratingStats } from '../../selectors'
import { useNoraFix } from '../../NoraContext'
import { useStore } from '../../store'
import { Stars } from '../bits'
import { INSIGHT_ICON } from '../insightIcons'
import { Card, KpiCell, KpiGrid } from '../PageBits'
import { ScrollFade } from '../ScrollFade'

/** Semicircle gauge with tick marks, filled to `pct`. */
function Gauge_({ pct }: { pct: number }) {
  const ticks = 40
  return (
    <svg viewBox="0 0 200 110" className="mx-auto w-full max-w-[260px]" role="img" aria-label={`${pct}% complete`}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const a = Math.PI * (1 - i / ticks)
        const on = (i / ticks) * 100 <= pct
        const [x1, y1, x2, y2] = [100 + 78 * Math.cos(a), 100 - 78 * Math.sin(a), 100 + 94 * Math.cos(a), 100 - 94 * Math.sin(a)]
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={3} strokeLinecap="round" className={on ? (pct >= 100 ? 'stroke-emerald-500' : 'stroke-blue-500') : 'stroke-slate-200'} />
      })}
      <text x="100" y="92" textAnchor="middle" className="fill-slate-900 text-[28px] font-bold">{pct}%</text>
    </svg>
  )
}

export function ProfileTab() {
  const state = useStore()
  const fix = useNoraFix()
  const me = state.agents[state.viewerId]!
  const s = ratingStats(me.reviews)
  const pct = agentCompleteness(me)
  const gaps = agentGaps(me)
  const [hover, setHover] = useState<number | null>(null)
  // the same traffic series the Traffic and Google tabs read, so the overview, this tab and Insights always agree
  const ser = series('views', windowFor('7d'))
  const views = ser.values
  const max = Math.max(...views)
  const total = views.reduce((a, b) => a + b, 0)
  const sentNow = state.threads.reduce((n, t) => n + (t.withAgentId !== me.id ? t.messages.filter((m) => m.from === 'me').length : 0), 0)
  const recent = [...me.activity].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="space-y-5">
      {/* Phones: one swipeable row with edge fades. From sm up it is the usual grid and nothing scrolls. */}
      <ScrollFade axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1" innerClassName="sm:min-w-0">
      <KpiGrid slider>
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Eye} label="Profile views" value={total} sub="Last 7 days" />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Search} label="Search appearances" value={ANALYTICS.profileSearchAppearances} sub="Last 30 days" />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={UserPlus} label="Referrals received" value={ANALYTICS.referralsReceived} sub="All time" />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Send} label="Referrals sent" value={ANALYTICS.referralsSentBefore + sentNow} sub="Includes this session" />
      </KpiGrid>
      </ScrollFade>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card icon={BarChart3} title="Profile views">
          {/* Phones: bars keep a minimum width, so the chart becomes a swipeable row with edge fades.
              From sm up the bars share the width and nothing scrolls. The top padding leaves room for the tooltip. */}
          <ScrollFade
            axis="x" tone="white" className="pt-12"
            innerClassName="flex h-48 items-end gap-3 sm:w-full sm:min-w-0"
            innerProps={{ role: 'img', 'aria-label': 'Bar chart of profile views over the last 7 days' }}
          >
            {views.map((v, i) => (
              <div
                key={i} className="relative flex h-full min-w-[48px] flex-1 flex-col items-center justify-end gap-1.5"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}
              >
                {hover === i && (
                  <div className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-400">{ser.labels[i]}</div>{v} views
                  </div>
                )}
                <div className={`w-full rounded-t-lg ${hover === i ? 'bg-blue-600' : v === max ? 'bg-blue-500' : 'bg-sky-200'}`} style={{ height: `${(v / max) * 100}%` }} />
                <span className="text-xs text-slate-500">{ser.labels[i]}</span>
              </div>
            ))}
          </ScrollFade>
        </Card>

        <Card icon={Gauge} title="Profile completeness">
          <Gauge_ pct={pct} />
          <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Main gaps</div>
          <p className="mt-1 text-sm text-slate-700">{gaps.length ? gaps.map((g) => (g === 'photoUrl' ? 'photo' : g)).join(' · ') : 'None. Your profile is complete.'}</p>
          {gaps.length > 0 && <button onClick={() => fix('profile')} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:underline"><Sparkles size={14} /> Fix with NORA →</button>}
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Card icon={Star} title="Rating breakdown" right={<span className="flex items-center gap-2 text-sm font-semibold text-slate-900">{fmtRating(s.avg)} <Stars rating={s.avg} size={13} /></span>}>
          <div className="space-y-2.5">
            {s.dist.map((d) => (
              <div key={d.stars} className="flex items-center gap-2.5 text-xs text-slate-500">
                <span className="w-6">{d.stars}★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${d.pct}%` }} /></span>
                <span className="w-16 text-right">{d.count} ({d.pct}%)</span>
              </div>
            ))}
          </div>
        </Card>

        <Card icon={History} title="Recent activity">
          {/* the full history, scrollable, with edge fades */}
          <ScrollFade maxHeight={232}>
            <ul className="space-y-3 py-1">
              {recent.map((a) => <li key={a.id} className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-800">{a.text}</span><span className="shrink-0 text-xs text-slate-400">{fmtDate(a.at)}</span></li>)}
            </ul>
          </ScrollFade>
        </Card>
      </div>

      <section className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 shadow-card">
        <h2 className="flex items-center gap-2.5 border-b border-purple-100 pb-3 text-[17px] font-semibold text-slate-900"><Sparkles size={19} className="text-purple-500" /> NORA insights</h2>
        <ScrollFade maxHeight={120} tone="purple" wrapperClassName="mt-3">
          <ul className="grid gap-x-8 gap-y-2 py-0.5 sm:grid-cols-2">
            {insightsFor(me).map((i) => <li key={i.id} className="flex items-center gap-2.5 text-sm text-slate-700"><span className="text-blue-600">{INSIGHT_ICON[i.icon]}</span>{i.text}</li>)}
          </ul>
        </ScrollFade>
        <Link to={`/profile/${me.id}`} className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">Open my profile →</Link>
      </section>
    </div>
  )
}

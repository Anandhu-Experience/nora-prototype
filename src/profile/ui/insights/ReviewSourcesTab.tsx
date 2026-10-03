import { ExternalLink, MessageSquarePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { insightsStore, requestSeries, requestStatus, reviewSeries, stateWindow, winLabel, type RequestStatus } from '../../../presence/insights'
import { reviewSources } from '../../selectors'
import { useStore } from '../../store'
import { Card, EmptyState } from '../PageBits'
import { Legend, LineChart, Pill, type PillTone } from '../kit'
import { ScrollFade } from '../ScrollFade'
import { BTN_PRIMARY } from '../Modal'
import { SubTabs } from './shared'

const SRC_COLOR = { 'Experience.com': '#2563eb', Google: '#f59e0b', Facebook: '#6366f1' } as const
const SRC_BADGE = { 'Experience.com': 'bg-blue-50 text-blue-600', Google: 'bg-amber-50 text-amber-600', Facebook: 'bg-indigo-50 text-indigo-600' } as const
const SRC_LETTER = { 'Experience.com': 'E', Google: 'G', Facebook: 'f' } as const
const TONE: Record<RequestStatus, PillTone> = { Sent: 'slate', Opened: 'amber', Reviewed: 'green' }

export function ReviewSourcesTab({ onSend }: { onSend: () => void }) {
  const state = useStore()
  const me = state.agents[state.viewerId]!
  const s = insightsStore.use()
  const [sub, setSub] = useState<'sources' | 'requests'>('sources')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [now, setNow] = useState(Date.now())
  const w = stateWindow(s)
  const live = s.requests.some((r) => requestStatus(r, now) !== 'Reviewed' && requestStatus(r, now) !== (r.outcome === 'opened' ? 'Opened' : 'Reviewed'))
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [live])
  const toggle = (id: string) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const rv = reviewSeries(w)
  const all = [
    { id: 'experience', name: 'Experience.com', color: SRC_COLOR['Experience.com'], values: rv.experience },
    { id: 'google', name: 'Google', color: SRC_COLOR.Google, values: rv.google },
    { id: 'facebook', name: 'Facebook', color: SRC_COLOR.Facebook, values: rv.facebook },
  ]
  const rq = requestSeries(s.requests, w, now)
  const sent = s.requests.length

  return (
    <div className="space-y-5">
      <ScrollFade axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1" innerClassName="flex gap-4 sm:grid sm:min-w-0 sm:grid-cols-3">
        {reviewSources(me).map((x) => (
          <div key={x.source} className="flex w-[220px] shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:w-auto">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${SRC_BADGE[x.source]}`}>{SRC_LETTER[x.source]}</span>
            <div><div className="text-sm font-semibold text-slate-900">{x.source}</div><div className="text-xs text-slate-500">{x.count} review{x.count === 1 ? '' : 's'}{x.count ? ` · ${x.avg.toFixed(1)} average` : ''}</div></div>
          </div>
        ))}
      </ScrollFade>
      <Link to="/profile?tab=reviews" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"><ExternalLink size={14} /> Read and reply to these reviews on your profile</Link>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SubTabs tabs={[{ id: 'sources', label: 'Review Sources' }, { id: 'requests', label: `Review Requests (${sent})` }]} value={sub} onChange={setSub} />
          <button onClick={onSend} className={BTN_PRIMARY}><MessageSquarePlus size={15} /> Send a review request</button>
        </div>
        {sub === 'sources' ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">New reviews per period by source · {winLabel(w)}. Demo data.</p>
            <LineChart labels={rv.labels} series={all.filter((x) => !hidden.has(x.id))} yTicks={4} label="New reviews by source" />
            <Legend items={all} hidden={hidden} onToggle={toggle} />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <LineChart labels={rq.labels} series={[{ id: 'sent', name: 'Sent', color: '#6366f1', values: rq.sent }, { id: 'reviewed', name: 'Reviewed', color: '#059669', values: rq.reviewed }]} yTicks={2} label="Review requests sent and reviewed" />
            {s.requests.length === 0 ? <EmptyState>No review requests yet. Ask a happy client for a review.</EmptyState> : (
              <ScrollFade axis="x">
                <table className="w-full min-w-max text-left text-sm">
                  <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="py-2 pr-6 font-medium">Client</th><th className="pr-6 font-medium">Channel</th><th className="pr-6 font-medium">Sent</th><th className="font-medium">Status</th></tr></thead>
                  <tbody>
                    {s.requests.map((r) => { const st = requestStatus(r, now); return (
                      <tr key={r.id} className="border-b border-slate-100 last:border-0"><td className="py-2.5 pr-6"><div className="font-medium text-slate-900">{r.name}</div><div className="text-xs text-slate-500">{r.contact}</div></td><td className="pr-6 text-slate-600">{r.channel}</td><td className="pr-6 text-slate-600">{r.sentAt.slice(0, 10)}</td><td><Pill tone={TONE[st]}>{st}</Pill></td></tr>
                    ) })}
                  </tbody>
                </table>
              </ScrollFade>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

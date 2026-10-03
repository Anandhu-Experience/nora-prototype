import { useState } from 'react'
import { delta, insightsStore, previousWindow, series, stateWindow, winLabel, type Metric } from '../../../presence/insights'
import { Card } from '../PageBits'
import { LineChart } from '../kit'
import { DeltaBadge, GoogleLock, SubTabs, UnlockPanel, useUnlock } from './shared'

type Sub = 'views' | 'impressions' | 'actions'
const META: Record<Sub, { label: string; metric: Metric; color: string; hint: string; google: boolean }> = {
  views: { label: 'Page Views', metric: 'views', color: '#2563eb', hint: 'Visits to your Experience.com profile.', google: false },
  impressions: { label: 'Impressions', metric: 'impressions', color: '#8b5cf6', hint: 'Times your Google Business Profile appeared in Search and Maps.', google: true },
  actions: { label: 'Google Actions', metric: 'actions', color: '#059669', hint: 'Calls, direction requests and website clicks from Google.', google: true },
}

function Panel({ sub }: { sub: Sub }) {
  const s = insightsStore.use()
  const w = stateWindow(s)
  const m = META[sub]
  const ser = series(m.metric, w)
  const d = delta(m.metric, w)
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div><div className="text-3xl font-bold text-slate-900">{ser.total.toLocaleString()}</div><div className="text-xs text-slate-500">{m.label} · {winLabel(w)}</div></div>
        <DeltaBadge d={d} />
        <span className="pb-1 text-xs text-slate-500">vs {d.previous.toLocaleString()} in the previous period ({winLabel(previousWindow(w))})</span>
      </div>
      <div className="mt-4"><LineChart labels={ser.labels} series={[{ id: sub, name: m.label, color: m.color, values: ser.values }]} label={`${m.label} over ${winLabel(w)}`} /></div>
    </div>
  )
}

export function TrafficTab() {
  const [sub, setSub] = useState<Sub>('views')
  const { googleOk } = useUnlock()
  const m = META[sub]
  return (
    <Card>
      <SubTabs tabs={(Object.keys(META) as Sub[]).map((id) => ({ id, label: META[id].label }))} value={sub} onChange={setSub} />
      <p className="mb-4 mt-3 text-xs text-slate-500">{m.hint}{m.google ? '' : ' Always available.'}</p>
      {!m.google && !googleOk && <div className="mb-5"><UnlockPanel compact /></div>}
      {m.google ? <GoogleLock><Panel sub={sub} /></GoogleLock> : <Panel sub={sub} />}
      <p className="mt-4 text-xs text-slate-400">Demo data: the same range always gives the same numbers.</p>
    </Card>
  )
}

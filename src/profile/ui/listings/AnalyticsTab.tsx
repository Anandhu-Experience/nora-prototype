import { Download, Eye, Loader2, Lock, MapPin, Navigation, Phone, CalendarCheck, MousePointerClick, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { connectionsStore, isConnected } from '../../../presence/connections'
import { generateReport, listingsAnalytics, listingsStore, setRange, type Range } from '../../../presence/listings'
import { Legend, LineChart } from '../kit'
import { BTN_PRIMARY } from '../Modal'
import { Card, EmptyState, KpiCell, KpiGrid } from '../PageBits'
import { ScrollFade } from '../ScrollFade'
import { useToast } from '../Toast'

const RANGES: Range[] = ['7D', '1M', '6M', '1Y']
const n = (v: number) => v.toLocaleString('en-GB')

export function AnalyticsTab() {
  const s = listingsStore.use()
  const connected = isConnected(connectionsStore.use(), 'google')
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const d = listingsAnalytics(s.range)

  if (!connected) {
    return (
      <EmptyState>
        <Lock size={26} className="mx-auto mb-3 text-slate-400" />
        <p className="font-medium text-slate-800">Listing analytics are locked</p>
        <p className="mx-auto mt-1 max-w-md">Connect your Google Business Profile to see how many people find and contact you from Google Maps and Search.</p>
        <Link to="/connections" className={BTN_PRIMARY + ' mt-4'}>Connect Google</Link>
      </EmptyState>
    )
  }

  const report = async () => {
    setBusy(true)
    const { csv, filename } = await generateReport(s.range)
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    setBusy(false)
    toast(`Report downloaded (${filename})`)
  }
  const series = [
    { id: 'maps', name: 'Google Maps views', color: '#2563eb', values: d.maps },
    { id: 'search', name: 'Search views', color: '#9333ea', values: d.search },
  ].filter((x) => !hidden.has(x.id))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Date range" className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
          {RANGES.map((r) => <button key={r} aria-pressed={s.range === r} onClick={() => setRange(r)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${s.range === r ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{r}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/insights" className="text-sm font-medium text-blue-600 hover:underline">See all traffic in Insights</Link>
          <button className={BTN_PRIMARY} onClick={report} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Generate report</button>
        </div>
      </div>
      <ScrollFade axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1" innerClassName="sm:min-w-0">
        <KpiGrid slider cols="md:grid-cols-3">
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Eye} label="Total views" value={n(d.views)} sub={`Last ${s.range}`} />
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={MapPin} label="Google Maps views" value={n(d.mapsTotal)} />
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Search} label="Search views" value={n(d.searchTotal)} />
        </KpiGrid>
      </ScrollFade>
      <Card icon={Eye} title="Impressions over time">
        <LineChart labels={d.labels} series={series} label="Listing impressions: Google Maps and Search views" />
        <div className="mt-3"><Legend items={[{ id: 'maps', name: 'Google Maps views', color: '#2563eb' }, { id: 'search', name: 'Search views', color: '#9333ea' }]} hidden={hidden} onToggle={(id) => setHidden((h) => { const x = new Set(h); x.has(id) ? x.delete(id) : x.add(id); return x })} /></div>
      </Card>
      <ScrollFade axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1" innerClassName="sm:min-w-0">
        <KpiGrid slider cols="md:grid-cols-4">
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Phone} label="Calls" value={n(d.actions.calls)} />
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Navigation} label="Directions" value={n(d.actions.directions)} />
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={MousePointerClick} label="Website clicks" value={n(d.actions.website)} />
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={CalendarCheck} label="Bookings" value={n(d.actions.bookings)} />
        </KpiGrid>
      </ScrollFade>
      {s.reports.length > 0 && <p className="text-xs text-slate-500">Last report: {s.reports[0]!.range} range, {new Date(s.reports[0]!.at).toLocaleString('en-GB')}</p>}
    </div>
  )
}

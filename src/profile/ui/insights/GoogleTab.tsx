import { Compass, FileBarChart, Globe, Loader2, Map as MapIcon, Phone, Search } from 'lucide-react'
import { useState } from 'react'
import { delta, generateReport, insightsStore, series, stateWindow, totalOf, winLabel } from '../../../presence/insights'
import { KpiCell, KpiGrid, Card } from '../PageBits'
import { LineChart, ScoreBar } from '../kit'
import { BTN_PRIMARY } from '../Modal'
import { useToast } from '../Toast'
import { DeltaBadge, GoogleLock } from './shared'

function Content() {
  const s = insightsStore.use()
  const w = stateWindow(s)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const maps = totalOf('maps', w), search = totalOf('search', w)
  const imp = maps + search
  const calls = totalOf('calls', w), dirs = totalOf('directions', w), clicks = totalOf('clicks', w)
  const ser = series('views', w)
  const generate = async () => {
    setBusy(true)
    await generateReport({ type: 'traffic', format: 'PDF', campaign: 'Google Business Profile', start: w.start, end: w.end })
    setBusy(false)
    toast('Google report generated. Find it in Reports.')
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Google Business Profile · {winLabel(w)}. Demo data.</p>
        <button onClick={generate} disabled={busy} className={BTN_PRIMARY}>{busy ? <Loader2 size={15} className="animate-spin" /> : <FileBarChart size={15} />} Generate Report</button>
      </div>
      <KpiGrid cols="md:grid-cols-4">
        <KpiCell icon={Globe} label="Total views" value={<span className="inline-flex items-center gap-2">{ser.total.toLocaleString()} <DeltaBadge d={delta('views', w)} /></span>} sub="vs previous period" />
        <KpiCell icon={Search} label="Impressions" value={imp.toLocaleString()} sub={<DeltaBadge d={delta('impressions', w)} />} />
        <KpiCell icon={Phone} label="Calls" value={calls} sub="From Google" />
        <KpiCell icon={Compass} label="Directions" value={dirs} sub="Requests" />
      </KpiGrid>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Card icon={MapIcon} title="Impressions: Maps vs Search">
          <div className="space-y-4">
            <ScoreBar label="Google Maps" points={maps} max={imp || 1} tone="bg-emerald-500" right={`${maps.toLocaleString()} (${imp ? Math.round((maps / imp) * 100) : 0}%)`} />
            <ScoreBar label="Google Search" points={search} max={imp || 1} tone="bg-blue-500" right={`${search.toLocaleString()} (${imp ? Math.round((search / imp) * 100) : 0}%)`} />
          </div>
        </Card>
        <Card icon={Phone} title="Customer actions">
          <div className="space-y-4">
            <ScoreBar label="Calls" points={calls} max={calls + dirs + clicks || 1} tone="bg-purple-500" right={String(calls)} />
            <ScoreBar label="Directions" points={dirs} max={calls + dirs + clicks || 1} tone="bg-amber-500" right={String(dirs)} />
            <ScoreBar label="Website clicks" points={clicks} max={calls + dirs + clicks || 1} tone="bg-sky-500" right={String(clicks)} />
          </div>
        </Card>
      </div>
      <Card title="Views over time"><LineChart labels={ser.labels} series={[{ id: 'v', name: 'Views', color: '#2563eb', values: ser.values }]} label="Google views over time" /></Card>
    </div>
  )
}

export const GoogleTab = () => <GoogleLock><Content /></GoogleLock>

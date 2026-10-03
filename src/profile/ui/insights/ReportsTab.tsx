import { Download, FileText, Loader2, Info } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CAMPAIGNS, RANGES, REPORT_TYPES, generateReport, insightsStore, reportName, stateWindow, windowFor, type Campaign, type RangeId, type ReportFormat, type ReportType } from '../../../presence/insights'
import { reviewSources } from '../../selectors'
import { useStore } from '../../store'
import { Field } from '../bits'
import { Card, EmptyState } from '../PageBits'
import { Pill } from '../kit'
import { BTN_GHOST, BTN_PRIMARY, INPUT } from '../Modal'
import { ScrollFade } from '../ScrollFade'
import { useToast } from '../Toast'
import { downloadReport } from './download'

const FORMAT_HINT: Record<ReportFormat, string> = {
  PDF: 'Opens a print-ready page: choose "Save as PDF" in the print dialog.',
  CSV: 'A real .csv file you can open in any spreadsheet.',
  XLSX: 'A tab-separated .xls file (not a true .xlsx); Excel and Numbers open it directly.',
}

export function ReportsTab() {
  const s = insightsStore.use()
  const state = useStore()
  const toast = useToast()
  const counts = reviewSources(state.agents[state.viewerId]!).map((x) => ({ source: x.source, count: x.count, avg: x.avg }))
  const [type, setType] = useState<ReportType>('traffic')
  const [format, setFormat] = useState<ReportFormat>('CSV')
  const [campaign, setCampaign] = useState<Campaign>('All')
  const [period, setPeriod] = useState<RangeId | 'filter'>('filter')
  const [busy, setBusy] = useState(false)

  const w = period === 'filter' ? stateWindow(s) : windowFor(period)
  const dl = (e: Parameters<typeof downloadReport>[0]) => { if (!downloadReport(e, counts)) toast('Your browser blocked the print window. Allow pop-ups and try again.', 'error') }
  const exportNow = async () => {
    setBusy(true)
    const e = await generateReport({ type, format, campaign, start: w.start, end: w.end })
    setBusy(false)
    dl(e)
    toast(`${reportName(type)} exported as ${format}`)
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card icon={FileText} title="Report builder">
        <div className="space-y-3.5">
          <Field label="Report type"><select value={type} onChange={(e) => setType(e.target.value as ReportType)} className={INPUT}>{REPORT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
          <Field label="Format"><select value={format} onChange={(e) => setFormat(e.target.value as ReportFormat)} className={INPUT}><option>PDF</option><option>CSV</option><option>XLSX</option></select></Field>
          <p className="-mt-1.5 flex items-start gap-1.5 text-xs text-slate-500"><Info size={13} className="mt-0.5 shrink-0" />{FORMAT_HINT[format]}</p>
          <Field label="Campaign"><select value={campaign} onChange={(e) => setCampaign(e.target.value as Campaign)} className={INPUT}>{CAMPAIGNS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Period" hint={`${w.start} to ${w.end}`}>
            <select value={period} onChange={(e) => setPeriod(e.target.value as RangeId | 'filter')} className={INPUT}>
              <option value="filter">Same as the page filter</option>
              {RANGES.filter((r) => r.id !== 'custom').map((r) => <option key={r.id} value={r.id}>{r.long[0]!.toUpperCase() + r.long.slice(1)}</option>)}
            </select>
          </Field>
          <button onClick={exportNow} disabled={busy} className={`${BTN_PRIMARY} w-full`}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export</button>
          {type === 'listings' || type === 'full' ? <p className="text-xs text-slate-500">Listing performance by site. Manage your listings on <Link to="/listings" className="font-medium text-blue-600 hover:underline">Listings</Link>.</p> : <p className="text-xs text-slate-500">Need listing-level numbers? Pick "Listing performance" or open <Link to="/listings" className="font-medium text-blue-600 hover:underline">Listings</Link>.</p>}
        </div>
      </Card>
      <Card title="Reports activity">
        {s.reports.length === 0 ? <EmptyState>No reports yet. Export one to see it here.</EmptyState> : (
          <ScrollFade maxHeight={420}>
            <ul className="divide-y divide-slate-100">
              {s.reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{reportName(r.type)}</div>
                    <div className="text-xs text-slate-500">{r.at.slice(0, 16).replace('T', ' ')} · {r.format} · {r.campaign} · {r.start} to {r.end}</div>
                  </div>
                  <Pill tone={r.status === 'Ready' ? 'green' : 'red'}>{r.status}</Pill>
                  <button onClick={() => dl(r)} className={BTN_GHOST}><Download size={14} /> Download again</button>
                </li>
              ))}
            </ul>
          </ScrollFade>
        )}
      </Card>
    </div>
  )
}

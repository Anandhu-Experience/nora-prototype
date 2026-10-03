import { Building2, CheckCircle2, Clock, ExternalLink, Globe2, Loader2, Lock, RotateCw, Send } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LOCK_MESSAGE, inProcessCount, listingsStore, listingsSummary, publishAllReady, publishBlocker, publishSite, refreshSite, type Site, type SiteStatus } from '../../../presence/listings'
import { KpiCell, KpiGrid } from '../PageBits'
import { Pill, type PillTone } from '../kit'
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, INPUT } from '../Modal'
import { ScrollFade } from '../ScrollFade'
import { useToast } from '../Toast'

const STATUS: Record<SiteStatus, { label: string; tone: PillTone }> = {
  ready: { label: 'Ready to publish', tone: 'blue' }, initiated: { label: 'Initiated', tone: 'amber' }, in_process: { label: 'In process', tone: 'amber' },
  published: { label: 'Published', tone: 'green' }, failed: { label: 'Failed', tone: 'red' },
}

export function PublishTab() {
  const s = listingsStore.use()
  const toast = useToast()
  const [filter, setFilter] = useState<'all' | SiteStatus>('all')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState(false)
  const sm = listingsSummary(s)
  const rows = s.sites.filter((x) => filter === 'all' || x.status === filter)

  const mark = (id: string, on: boolean) => setBusy((b) => { const n = new Set(b); on ? n.add(id) : n.delete(id); return n })
  const run = async (x: Site, retry = false) => {
    mark(x.id, true)
    const r = await publishSite(x.id)
    mark(x.id, false)
    if (r === 'published') toast(`${x.name} published`)
    else if (r === 'failed') toast(`${x.name} failed: needs phone verification. Retry once verified.`, 'error')
    else toast(retry ? 'Cannot retry right now' : 'Cannot publish right now', 'error')
  }
  const check = async (x: Site) => { mark(x.id, true); await refreshSite(x.id); mark(x.id, false); toast(`${x.name} is now published`) }
  const all = async () => {
    setBulk(true)
    const r = await publishAllReady()
    setBulk(false)
    toast(`${r.published} published${r.failed ? `, ${r.failed} need attention` : ''}${r.skipped ? `, ${r.skipped} skipped` : ''}`, r.failed ? 'error' : 'success')
  }

  const action = (x: Site) => {
    if (busy.has(x.id)) return <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" /> {STATUS[x.status].label}...</span>
    const b = publishBlocker(x.id)
    if (x.status === 'published') return <a href={x.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">View <ExternalLink size={13} /></a>
    if (x.status === 'initiated' || x.status === 'in_process') return <button className={BTN_GHOST + ' !px-3 !py-1.5'} onClick={() => check(x)}>Check status</button>
    if (b === 'google') return <Link to="/connections" className="text-sm font-medium text-blue-600 hover:underline">Connect Google first</Link>
    return <button className={(x.status === 'failed' ? BTN_OUTLINE : BTN_PRIMARY) + ' !px-3 !py-1.5'} disabled={b === 'locked'} title={b === 'locked' ? LOCK_MESSAGE : undefined} onClick={() => run(x, x.status === 'failed')}>{x.status === 'failed' ? <><RotateCw size={13} /> Retry</> : 'Publish'}</button>
  }

  return (
    <div className="space-y-5">
      <ScrollFade axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1" innerClassName="sm:min-w-0">
        <KpiGrid slider>
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Globe2} label="Total sites" value={sm.total} />
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={CheckCircle2} label="Published" value={sm.published} />
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Send} label="Ready to publish" value={sm.ready} />
          <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Clock} label="In process" value={inProcessCount(s)} />
        </KpiGrid>
      </ScrollFade>
      {s.locked && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><Lock size={18} className="mt-0.5 shrink-0" />{LOCK_MESSAGE}</div>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="flex items-center gap-2.5 text-[17px] font-semibold text-slate-900"><Building2 size={20} className="text-slate-500" /> Listed sites</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Filter by status" className={INPUT + ' !w-auto'} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All statuses</option>{(Object.keys(STATUS) as SiteStatus[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
            </select>
            <button className={BTN_PRIMARY} disabled={s.locked || bulk || sm.ready === 0} title={s.locked ? LOCK_MESSAGE : undefined} onClick={all}>{bulk ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publish to all ready</button>
          </div>
        </div>
        {rows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No sites with this status.</p> : (
          <ScrollFade axis="x" innerClassName="min-w-max">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs uppercase text-slate-500"><th className="py-2 pr-6 font-medium">Site</th><th className="py-2 pr-6 font-medium">Status</th><th className="py-2 pr-6 font-medium">Details</th><th className="py-2 text-right font-medium">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td className="py-3 pr-6 font-medium text-slate-900">{x.name}</td>
                    <td className="py-3 pr-6"><Pill tone={STATUS[x.status].tone}>{STATUS[x.status].label}</Pill></td>
                    <td className="py-3 pr-6 text-xs text-slate-500">{x.status === 'published' ? `Published ${new Date(x.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : x.note || (publishBlocker(x.id) === 'google' ? 'Requires your Google connection' : '')}</td>
                    <td className="py-3 text-right">{action(x)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollFade>
        )}
      </section>
    </div>
  )
}

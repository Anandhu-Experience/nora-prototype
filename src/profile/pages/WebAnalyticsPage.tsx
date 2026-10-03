import { Activity, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { buildReportHtml, PARAM_LABEL, websiteAnswer, websiteIssues, websiteParameters, websitePoints, websiteStore, websiteActions, WEBSITE_MAX, type ParamId } from '../../presence/website'
import { wait } from '../../presence/persist'
import { useStore } from '../store'
import { AiInsightBar, Ring, ScoreBar, type Suggestion } from '../ui/kit'
import { BTN_GHOST } from '../ui/Modal'
import { Card, EmptyState, PageHeader } from '../ui/PageBits'
import { useToast } from '../ui/Toast'
import { ParamCard } from '../ui/website/ParamCard'
import { VerifyHero } from '../ui/website/VerifyHero'

export default function WebAnalyticsPage() {
  const state = websiteStore.use()
  const store = useStore()
  const agent = store.agents[store.viewerId]!
  const toast = useToast()
  const [open, setOpen] = useState<Set<ParamId>>(new Set(['html']))
  const [exporting, setExporting] = useState(false)

  const score = websitePoints(state)
  const params = websiteParameters(state)
  const issues = websiteIssues(state)
  const verified = state.status === 'verified' && !!state.scan
  const pct = Math.round((score / WEBSITE_MAX) * 100)

  const reveal = (id: ParamId) => {
    setOpen((o) => new Set(o).add(id))
    setTimeout(() => document.getElementById(`param-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }
  const toggle = (id: ParamId) => setOpen((o) => { const n = new Set(o); if (!n.delete(id)) n.add(id); return n })

  const metaGain = issues.filter((i) => i.param === 'html').reduce((n, i) => n + i.gain, 0)
  const suggestions: Suggestion[] = verified
    ? issues.slice(0, 3).map((i) => ({
        id: i.id, title: i.id === 'tag-description' ? 'Add a meta description' : i.id === 'load' ? 'Speed up your site' : `Fix: ${i.label}`,
        detail: i.fix, impact: `+${i.gain} pts`,
        cta: i.id === 'tag-description' ? 'Draft with AI' : i.param === 'html' ? 'Add the tag' : 'Show me how',
        onRun: () => reveal(i.param),
      }))
    : [{ id: 'verify', title: 'Verify your website', detail: 'Verifying unlocks the audit and up to 250 points. If the tag is missing, NORA can add it for you.', cta: 'Enter your website', impact: `+${WEBSITE_MAX} pts max`, onRun: () => document.getElementById('site-url')?.focus() }]
  const summary = verified
    ? `Your website scores ${score}/${WEBSITE_MAX}.${metaGain ? ` Fixing the meta tags is worth +${metaGain} points.` : issues.length ? ` ${issues.length} thing${issues.length === 1 ? '' : 's'} left to fix.` : ' Everything checks out.'}`
    : 'Your website is not verified yet, so it earns 0 of 250 points.'

  const exportReport = async () => {
    setExporting(true)
    await wait()
    const html = buildReportHtml(websiteStore.get(), agent.name)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    a.download = `website-report-${agent.id}.html`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setExporting(false)
    toast('Report downloaded. Open it and use Print to save as PDF.')
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader
        icon={Activity} title="Web Analytics" subtitle="Audit your professional website: SEO, trust signals and specific issues to fix."
        right={<button onClick={() => void exportReport()} disabled={!verified || exporting} className={BTN_GHOST}>{exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export report</button>}
      />
      <AiInsightBar summary={summary} suggestions={suggestions} question="How is my website scoring?" answer={websiteAnswer()} />
      <VerifyHero state={state} score={score} agent={agent} />

      {state.scanning && !state.scan && (
        <Card><div className="flex items-center gap-3 text-sm text-slate-600" role="status"><Loader2 size={18} className="animate-spin text-blue-600" /> Scanning your site: checking NAP data, load time, HTML tags, reviews and security…</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" /></div></Card>
      )}

      {!verified && !state.scanning && <EmptyState>Verify your website to see your score and the issues to fix.</EmptyState>}

      {verified && (
        <div className={`space-y-5 transition-opacity ${state.scanning ? 'opacity-60' : ''}`} aria-busy={state.scanning}>
          <Card title="Overall completion">
            <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-5 md:flex-col">
                <Ring value={score} max={WEBSITE_MAX} size={132} tone={pct >= 80 ? 'stroke-emerald-500' : pct >= 50 ? 'stroke-blue-500' : 'stroke-amber-500'} label={`${pct}% complete`}>
                  <span className="text-2xl font-bold text-slate-900">{pct}%</span><span className="text-xs text-slate-500">complete</span>
                </Ring>
                <p className="max-w-[220px] text-center text-xs text-slate-500 sm:text-left md:text-center">Enhance your website&apos;s SEO ranking by updating the primary parameters.</p>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Primary parameters</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {params.map((p) => <ScoreBar key={p.id} label={PARAM_LABEL[p.id]} points={p.points} max={p.max} tone={p.points >= p.max ? 'bg-emerald-500' : 'bg-blue-500'} />)}
                </div>
              </div>
            </div>
          </Card>
          <div className="space-y-4">
            {params.map((p) => <ParamCard key={p.id} param={p} state={state} agent={agent} open={open.has(p.id)} onToggle={() => toggle(p.id)} onFix={(id) => void websiteActions.markFixed(id, agent)} />)}
          </div>
        </div>
      )}
    </div>
  )
}

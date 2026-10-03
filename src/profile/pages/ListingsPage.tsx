import { Building2, Info, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectionsStore, isConnected } from '../../presence/connections'
import { dataIssues, dismissQaNote, knownCities, listingsAnswer, listingsPoints, listingsStore, listingsSummary, proposeFix, type FixProposal } from '../../presence/listings'
import { AiInsightBar, Tabs, type Suggestion } from '../ui/kit'
import { PageHeader } from '../ui/PageBits'
import { AnalyticsTab } from '../ui/listings/AnalyticsTab'
import { BusinessInfoTab, EditInfoModal, FixModal } from '../ui/listings/BusinessInfoTab'
import { PublishTab } from '../ui/listings/PublishTab'

type Tab = 'info' | 'publish' | 'analytics'

export default function ListingsPage() {
  const s = listingsStore.use()
  const google = isConnected(connectionsStore.use(), 'google')
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('info')
  const [editing, setEditing] = useState(false)
  const [fix, setFix] = useState<FixProposal | null>(null)
  const sm = listingsSummary(s)
  const issues = dataIssues(s.info, knownCities())

  const suggestions: Suggestion[] = []
  if (issues.length) suggestions.push({ id: 'fix', title: issues[0]!.id === 'serviceArea' ? 'Fix the service area' : 'Fix your listing data', detail: issues[0]!.message, cta: 'Fix with AI', impact: `+${issues[0]!.points} pts`, onRun: () => setFix(proposeFix(issues[0]!.id, s.info)) })
  if (sm.ready > 0) suggestions.push({ id: 'ready', title: `${sm.ready} sites are ready to publish`, detail: s.locked ? 'Publishing is locked by your manager.' : 'Publish them in one go to get found on more directories.', cta: 'Open Publish', onRun: () => setTab('publish') })
  if (!google) suggestions.push({ id: 'google', title: 'Connect Google to publish to Google Business Profile', detail: 'Also unlocks listing analytics and Insights.', cta: 'Connect Google', impact: '+30 pts', onRun: () => nav('/connections') })

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={Building2} title="Listings" subtitle={`Keep your name, address and phone consistent and publish them everywhere. ${listingsPoints(s)} of 100 listing points.`} />
      <AiInsightBar
        summary={`${sm.published} of ${sm.total} sites published, ${sm.issues === 0 ? 'no data issues' : `${sm.issues} data issue${sm.issues > 1 ? 's' : ''} open`}.`}
        suggestions={suggestions} question="How are my listings doing?" answer={listingsAnswer()}
      />
      {!s.qaNoteDismissed && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p className="flex-1">The Q&amp;A tab has been retired. Google no longer supports questions and answers on business listings.</p>
          <button aria-label="Dismiss note" onClick={dismissQaNote} className="rounded p-0.5 hover:bg-sky-100"><X size={16} /></button>
        </div>
      )}
      <Tabs label="Listings sections" value={tab} onChange={setTab} tabs={[{ id: 'info', label: 'Business Info' }, { id: 'publish', label: 'Publish' }, { id: 'analytics', label: 'Analytics' }]} />
      {tab === 'info' && <BusinessInfoTab onEdit={() => setEditing(true)} />}
      {tab === 'publish' && <PublishTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {editing && <EditInfoModal onClose={() => setEditing(false)} />}
      {fix && <FixModal proposal={fix} onClose={() => setFix(null)} />}
    </div>
  )
}

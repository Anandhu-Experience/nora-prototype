import { BarChart3, Gauge } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { delta, insightFacts, insightsAnswer, insightsStore, requestsThisMonth, stateWindow } from '../../presence/insights'
import { GoogleTab } from '../ui/insights/GoogleTab'
import { ProfileTab } from '../ui/insights/ProfileTab'
import { ReportsTab } from '../ui/insights/ReportsTab'
import { RequestModal } from '../ui/insights/RequestModal'
import { ReviewSourcesTab } from '../ui/insights/ReviewSourcesTab'
import { DateRangeBar, useUnlock } from '../ui/insights/shared'
import { TrafficTab } from '../ui/insights/TrafficTab'
import { AiInsightBar, Tabs, type Suggestion } from '../ui/kit'
import { BTN_GHOST } from '../ui/Modal'
import { PageHeader } from '../ui/PageBits'

type Tab = 'profile' | 'traffic' | 'reviews' | 'google' | 'reports'

export default function InsightsPage() {
  const nav = useNavigate()
  const s = insightsStore.use()
  const u = useUnlock()
  const [tab, setTab] = useState<Tab>('profile')
  const [request, setRequest] = useState(false)
  const f = insightFacts(s, u.google, u.srsTotal)
  const w = stateWindow(s)
  const sign = (n: number) => `${n > 0 ? '+' : ''}${n}%`
  const sent = requestsThisMonth(s)

  const suggestions: Suggestion[] = []
  if (!u.google) suggestions.push({ id: 'google', title: 'Connect Google to unlock', detail: 'Google views, impressions and actions stay locked until your Google Business Profile is connected.', cta: 'Connect Google', onRun: () => nav('/connections') })
  else if (!u.googleOk) suggestions.push({ id: 'srs', title: `Reach ${400} on your Search Rank Score`, detail: `You are at ${u.srsTotal}, ${u.gap} points short of unlocking Google insights.`, cta: 'Improve SRS', onRun: () => nav('/search-rank') })
  if (sent === 0) suggestions.push({ id: 'req', title: "You've sent 0 review requests this month", detail: 'Reviews lift your Search Rank Score. NORA can draft the message for you.', cta: 'Send a request', onRun: () => { setTab('reviews'); setRequest(true) } })
  suggestions.push(f.imp.pct >= 0
    ? { id: 'trend', title: `Impressions ${f.imp.pct >= 0 ? 'up' : 'down'} ${Math.abs(f.imp.pct)}%`, detail: 'Turn the momentum into a shareable report for your records.', cta: 'Create a report', onRun: () => setTab('reports') }
    : { id: 'trend', title: `Impressions down ${Math.abs(f.imp.pct)}%`, detail: 'Fresh content and new reviews usually win this back. Check the trend first.', cta: 'See traffic', onRun: () => setTab('traffic') })

  const v = delta('views', w)
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={BarChart3} title="Insights" subtitle="How your profile and listings perform over time. Traffic figures are demo data; reviews and ratings are live." right={<button onClick={() => nav('/search-rank')} className={BTN_GHOST}><Gauge size={15} /> Search Rank Score</button>} />
      <AiInsightBar
        summary={`Page views are ${v.pct >= 0 ? 'up' : 'down'} ${Math.abs(v.pct)}% (${v.total.toLocaleString()}) and impressions ${sign(f.imp.pct)} versus the previous period.`}
        suggestions={suggestions} question="How is my traffic doing?" answer={insightsAnswer()}
      />
      <Tabs label="Insights sections" value={tab} onChange={setTab} tabs={[{ id: 'profile', label: 'Profile' }, { id: 'traffic', label: 'Traffic' }, { id: 'reviews', label: 'Review Sources' }, { id: 'google', label: 'Google Analytics' }, { id: 'reports', label: 'Reports' }]} />
      {tab !== 'profile' && <DateRangeBar />}
      {tab === 'profile' && <ProfileTab />}
      {tab === 'traffic' && <TrafficTab />}
      {tab === 'reviews' && <ReviewSourcesTab onSend={() => setRequest(true)} />}
      {tab === 'google' && <GoogleTab />}
      {tab === 'reports' && <ReportsTab />}
      {request && <RequestModal onClose={() => setRequest(false)} />}
    </div>
  )
}

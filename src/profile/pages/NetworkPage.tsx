import { Handshake, Network, Send, UserSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MAX_PROMOTED, STALE_DAYS, isFull, networkAnswer, networkStore, promote, partnerOf, referralRows, staleReceived,
  type ReferralKind, type ReferralRow,
} from '../../presence/network'
import { similarAgents } from '../selectors'
import { useStore } from '../store'
import { AiInsightBar, Tabs, type Suggestion } from '../ui/kit'
import { FollowUpModal } from '../ui/network/shared'
import { PartnersTab } from '../ui/network/PartnersTab'
import { ReferralsTab } from '../ui/network/ReferralsTab'
import { PageHeader } from '../ui/PageBits'
import { useToast } from '../ui/Toast'
import { DirectoryView } from './DirectoryPage'
import { LocationsView } from './LocationsPage'

type Tab = 'partners' | 'referrals' | 'find'
const TABS = new Set<string>(['partners', 'referrals', 'find'])
const KINDS = new Set<string>(['received', 'requested', 'given'])

export default function NetworkPage() {
  const state = useStore()
  const net = networkStore.use()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [follow, setFollow] = useState<ReferralRow | null>(null)
  const tab: Tab = TABS.has(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'partners'
  const kind: ReferralKind = KINDS.has(params.get('kind') ?? '') ? (params.get('kind') as ReferralKind) : 'received'
  const view = params.get('view') === 'city' ? 'city' : 'list'
  const me = state.agents[state.viewerId]!

  const patch = (changes: Record<string, string | null>) => setParams((p) => {
    const n = new URLSearchParams(p)
    Object.entries(changes).forEach(([k, v]) => (v === null ? n.delete(k) : n.set(k, v)))
    return n
  }, { replace: true })
  const goTab = (t: Tab) => setParams(t === 'partners' ? {} : { tab: t }, { replace: true })

  const rows = useMemo(() => referralRows(net, state.threads, state.agents), [net, state.threads, state.agents])
  const stale = staleReceived(rows)
  const pending = net.requests.filter((r) => r.status === 'pending').length
  const nextPartner = !isFull(net) ? similarAgents(state, me).find((a) => !net.promoted.some((p) => p.id === a.id)) : undefined
  const gapCity = me.serviceAreas.find((c) => !net.promoted.some((p) => p.city === c))

  const suggestions: Suggestion[] = []
  if (stale[0]) suggestions.push({ id: 'followup', title: `Follow up with ${stale[0].name}`, detail: `${stale.length} received referral${stale.length === 1 ? ' hasn’t' : 's haven’t'} been followed up in ${STALE_DAYS} days. NORA can draft the message for you to review.`, cta: 'Draft with AI', onRun: () => setFollow(stale[0]!) })
  if (nextPartner) suggestions.push({ id: 'promote', title: `Promote ${nextPartner.name}`, detail: `${nextPartner.title} in ${nextPartner.city}, a close match to your profile. ${net.promoted.length} of ${MAX_PROMOTED} partner slots used.`, cta: 'Promote', impact: '+12 pts', onRun: () => { if (promote(partnerOf(nextPartner)) === 'ok') toast(`${nextPartner.name} is now a promoted partner`) } })
  if (pending) suggestions.push({ id: 'requests', title: `Review ${pending} promotion request${pending === 1 ? '' : 's'}`, detail: 'Other professionals asked you to promote them. Accepting pins them to your page.', cta: 'Review', onRun: () => { goTab('partners'); document.getElementById('promotion-requests')?.scrollIntoView({ behavior: 'smooth' }) } })
  if (gapCity) suggestions.push({ id: 'city', title: `Find partners in ${gapCity}`, detail: `You have no promoted partners in ${gapCity}, one of your service areas.`, cta: 'Browse', onRun: () => setParams({ tab: 'find', city: gapCity }, { replace: true }) })

  const summary = `You’ve promoted ${net.promoted.length} of ${MAX_PROMOTED} partners${stale.length ? `, ${stale.length} received referral${stale.length === 1 ? '' : 's'} haven’t been followed up in ${STALE_DAYS} days` : ''}${pending ? ` and ${pending} promotion request${pending === 1 ? ' is' : 's are'} waiting` : ''}.`

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={Network} title="Network" subtitle="Build your referral network: promote partners, request referrals and find professionals." />
      <AiInsightBar summary={summary} suggestions={suggestions} question="How is my network doing?" answer={networkAnswer()} />
      <Tabs
        label="Network sections" value={tab} onChange={goTab}
        tabs={[
          { id: 'partners', label: 'Partners', icon: Handshake },
          { id: 'referrals', label: 'Referrals', icon: Send },
          { id: 'find', label: 'Find professionals', icon: UserSearch },
        ]}
      />
      {tab === 'partners' && <PartnersTab onFind={() => goTab('find')} />}
      {tab === 'referrals' && <ReferralsTab kind={kind} onKind={(k) => patch({ kind: k === 'received' ? null : k })} onFollowUp={setFollow} />}
      {tab === 'find' && (
        <div className="space-y-5">
          <div role="group" aria-label="Directory view" className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            {(['list', 'city'] as const).map((v) => (
              <button key={v} aria-pressed={view === v} onClick={() => patch({ view: v === 'list' ? null : v })} className={`rounded-md px-3.5 py-1.5 font-medium ${view === v ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{v === 'list' ? 'List' : 'By city'}</button>
            ))}
          </div>
          {view === 'list' ? <DirectoryView /> : <LocationsView cityHref={(c) => `/network?tab=find&city=${encodeURIComponent(c)}`} />}
        </div>
      )}
      {follow && <FollowUpModal row={follow} onClose={() => setFollow(null)} />}
    </div>
  )
}

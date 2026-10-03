import { Link2, Loader2, RefreshCw, Star } from 'lucide-react'
import { useState } from 'react'
import { CONNECTIONS, GROUPS, connectionMeta, connectionsAnswer, connectionsPoints, connectionsStore, disconnect, isConnected, maxConnectionPoints, missingConnections, syncNow, type ConnectionId } from '../../presence/connections'
import { AiInsightBar, Hero, HeroBar, Pill, type Suggestion } from '../ui/kit'
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, Modal } from '../ui/Modal'
import { PageHeader } from '../ui/PageBits'
import { useToast } from '../ui/Toast'
import { BrandBadge } from '../ui/listings/brand'
import { ConnectModal } from '../ui/listings/ConnectModal'

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Tile({ id, onConnect, onDisconnect }: { id: ConnectionId; onConnect: () => void; onDisconnect: () => void }) {
  const s = connectionsStore.use()
  const toast = useToast()
  const m = connectionMeta(id)
  const c = s.conns[id]
  const [syncing, setSyncing] = useState(false)
  const big = id === 'google'
  const sync = async () => { setSyncing(true); await syncNow(id); setSyncing(false); toast(`${m.name} synced`) }
  return (
    <div className={`flex flex-col rounded-2xl border bg-white p-5 shadow-card ${big ? 'border-blue-300 ring-1 ring-blue-100 sm:col-span-2' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <BrandBadge id={id} size={big ? 'lg' : 'md'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className={`font-semibold text-slate-900 ${big ? 'text-lg' : 'text-[15px]'}`}>{m.name}</h3>{big && <Pill tone="purple"><Star size={11} /> Most valuable</Pill>}</div>
          <p className="mt-0.5 text-sm text-slate-500">{m.value}</p>
        </div>
        {c.connected ? <Pill tone="green">Connected</Pill> : <Pill>Not connected</Pill>}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs"><Pill tone={c.connected ? 'green' : 'blue'}>{c.connected ? `+${m.points} pts earned` : `Earns +${m.points} pts`}</Pill></div>
      {c.connected && (
        <div className="mt-3 space-y-0.5 text-xs text-slate-500">
          <div>Account: <span className="font-medium text-slate-700">{c.handle}</span></div>
          <div>Connected {fmt(c.connectedAt)}</div>
          {m.syncs && <div>Last synced {c.lastSynced ? fmtTime(c.lastSynced) : 'never'}</div>}
        </div>
      )}
      <div className="mt-4 flex flex-1 flex-wrap items-end gap-2">
        {c.connected ? (
          <>
            {m.syncs && <button className={BTN_GHOST} onClick={sync} disabled={syncing}>{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync now</button>}
            <button className={BTN_GHOST} onClick={onDisconnect}>Disconnect</button>
          </>
        ) : <button className={big ? BTN_PRIMARY : BTN_OUTLINE} onClick={onConnect}>Connect</button>}
      </div>
    </div>
  )
}

export default function ConnectionsPage() {
  const s = connectionsStore.use()
  const toast = useToast()
  const [connecting, setConnecting] = useState<ConnectionId | null>(null)
  const [leaving, setLeaving] = useState<ConnectionId | null>(null)
  const pts = connectionsPoints(s)
  const missing = missingConnections(s)
  const suggestions: Suggestion[] = missing.slice(0, 3).map((m) => ({
    id: m.id, title: m.id === 'google' ? 'Connect Google to unlock Insights' : `Add ${m.name}`,
    detail: m.id === 'google' ? 'Google is the most valuable connection: it unlocks Insights, listing analytics and publishing to Google Business Profile.' : m.value,
    cta: m.kind === 'link' ? 'Add link' : 'Connect', impact: `+${m.points} pts`, onRun: () => setConnecting(m.id),
  }))
  const connected = CONNECTIONS.filter((c) => isConnected(s, c.id)).length

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={Link2} title="Connections" subtitle="Connect your accounts so reviews, profile and listings sync. Each connection raises credibility and earns ranking points." />
      <Hero title="Connect your social accounts" blurb="Connect Google, Facebook, LinkedIn and more. Every connected account boosts your credibility and adds points to your Search Rank Score." aside={<div className="text-right"><div className="text-4xl font-bold">{pts}</div><div className="text-sm text-white/70">of {maxConnectionPoints} points</div></div>}>
        <div className="mb-2 text-sm text-white/90"><span className="font-semibold">{pts} / {maxConnectionPoints}</span> points earned · {connected} of {CONNECTIONS.length} connected</div>
        <HeroBar pct={(pts / maxConnectionPoints) * 100} />
      </Hero>

      <AiInsightBar
        summary={missing.length ? `${connected} of ${CONNECTIONS.length} accounts connected, ${pts} of 100 points. ${missing[0]!.id === 'google' ? 'Google is the biggest win.' : `${missing[0]!.name} is the next best.`}` : 'Everything is connected. You have all 100 points.'}
        suggestions={suggestions} question="How are my connections doing?" answer={connectionsAnswer()}
      />

      {GROUPS.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <div className="mb-3"><h2 className="text-[17px] font-semibold text-slate-900">{g.label}</h2><p className="text-sm text-slate-500">{g.blurb}</p></div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTIONS.filter((c) => c.group === g.id).sort((a, b) => b.points - a.points).map((c) => <Tile key={c.id} id={c.id} onConnect={() => setConnecting(c.id)} onDisconnect={() => setLeaving(c.id)} />)}
          </div>
        </section>
      ))}

      {connecting && <ConnectModal id={connecting} onClose={() => setConnecting(null)} />}
      {leaving && (
        <Modal title={`Disconnect ${connectionMeta(leaving).name}?`} onClose={() => setLeaving(null)} footer={<><button className={BTN_GHOST} onClick={() => setLeaving(null)}>Keep connected</button><button className={BTN_PRIMARY} onClick={() => { disconnect(leaving); toast(`${connectionMeta(leaving).name} disconnected. -${connectionMeta(leaving).points} points`, 'info'); setLeaving(null) }}>Disconnect</button></>}>
          <p className="text-sm text-slate-700">You will lose {connectionMeta(leaving).points} points{leaving === 'google' ? ', and Insights, listing analytics and publishing to Google will be locked' : ''}. You can reconnect at any time.</p>
        </Modal>
      )}
    </div>
  )
}

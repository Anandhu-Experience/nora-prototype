import { Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { connect, connectionMeta, validateProfileUrl, type ConnectionId } from '../../../presence/connections'
import { Field } from '../bits'
import { BTN_GHOST, BTN_PRIMARY, INPUT, Modal } from '../Modal'
import { useToast } from '../Toast'
import { BrandBadge } from './brand'

/** Mock OAuth consent for OAuth networks; a profile-link form for link-only networks. */
export function ConnectModal({ id, onClose }: { id: ConnectionId; onClose: () => void }) {
  const m = connectionMeta(id)
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (m.kind === 'link') {
      const e = validateProfileUrl(id, url)
      if (e) { setErr(e); return }
    }
    setBusy(true)
    await connect(id, url)
    toast(`${m.name} connected. +${m.points} points`)
    onClose()
  }

  return (
    <Modal
      title={m.kind === 'oauth' ? `Authorize Experience.com` : `Add your ${m.name} profile`}
      onClose={() => !busy && onClose()}
      footer={busy ? <span className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> {m.kind === 'oauth' ? `Connecting to ${m.name}...` : 'Verifying link...'}</span> : (
        <><button className={BTN_GHOST} onClick={onClose}>Cancel</button><button className={BTN_PRIMARY} onClick={run}>{m.kind === 'oauth' ? 'Allow' : 'Save link'}</button></>
      )}
    >
      <div className="flex items-center gap-3"><BrandBadge id={id} /><div><div className="font-semibold text-slate-900">{m.name}</div><div className="text-xs text-slate-500">Earns +{m.points} points toward your Search Rank Score</div></div></div>
      {m.kind === 'oauth' ? (
        <div className="mt-4">
          <p className="text-sm text-slate-700">Authorize Experience.com to access your {m.name} account. It would be able to:</p>
          <ul className="mt-3 space-y-2">{m.permissions.map((p) => <li key={p} className="flex items-start gap-2 text-sm text-slate-700"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />{p}</li>)}</ul>
          <p className="mt-3 text-xs text-slate-500">You can disconnect at any time. This is a demo: no real account is touched.</p>
        </div>
      ) : (
        <div className="mt-4">
          <Field label={`${m.name} profile link`} error={err} hint={`Must be a link on ${m.hosts[0]}`}>
            <input className={INPUT} value={url} disabled={busy} placeholder={m.placeholder} onChange={(e) => { setUrl(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && run()} />
          </Field>
        </div>
      )}
    </Modal>
  )
}

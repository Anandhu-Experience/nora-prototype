import { Loader2, Send, Sparkles, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { requestTemplate, sendReviewRequest, validateRequest } from '../../../presence/insights'
import { wait } from '../../../presence/persist'
import { useStore } from '../../store'
import { Field } from '../bits'
import { BTN_GHOST, BTN_PRIMARY, INPUT, Modal } from '../Modal'
import { useToast } from '../Toast'

export function RequestModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const state = useStore()
  const me = state.agents[state.viewerId]!
  const first = me.name.replace(/^agent\s+/i, '').split(' ')[0] ?? ''
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'Email' | 'SMS'>('Email')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [prev, setPrev] = useState<string | null>(null)
  const [drafted, setDrafted] = useState(false)
  const [busy, setBusy] = useState<'draft' | 'send' | null>(null)
  const [tried, setTried] = useState(false)
  const errs = validateRequest(name, contact, channel)
  const msgErr = message.trim().length < 10 ? 'Write a short message (at least 10 characters).' : undefined

  const draft = async () => {
    setBusy('draft'); await wait(); setPrev(message); setMessage(requestTemplate(name, first)); setDrafted(true); setBusy(null)
  }
  const send = async () => {
    setTried(true)
    if (errs.name || errs.contact || msgErr) return
    setBusy('send'); await wait()
    sendReviewRequest({ name, contact, channel, message })
    toast(`Review request sent to ${name.trim()}`)
    onClose()
  }
  return (
    <Modal title="Send a review request" onClose={onClose} footer={<><button onClick={onClose} className={BTN_GHOST}>Cancel</button><button onClick={send} disabled={busy !== null} className={BTN_PRIMARY}>{busy === 'send' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send request</button></>}>
      <div className="space-y-3.5">
        <Field label="Client name" error={tried ? errs.name : undefined}><input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="Jane Smith" /></Field>
        <Field label="Send by">
          <select value={channel} onChange={(e) => setChannel(e.target.value as 'Email' | 'SMS')} className={INPUT}><option>Email</option><option>SMS</option></select>
        </Field>
        <Field label={channel === 'Email' ? 'Client email' : 'Client phone'} error={tried ? errs.contact : undefined}><input value={contact} onChange={(e) => setContact(e.target.value)} className={INPUT} inputMode={channel === 'Email' ? 'email' : 'tel'} placeholder={channel === 'Email' ? 'jane@example.com' : '+44 7700 900123'} /></Field>
        <Field label="Message" error={tried ? msgErr : undefined}><textarea value={message} onChange={(e) => { setMessage(e.target.value); setDrafted(false) }} rows={5} className={INPUT} placeholder="Ask your client for a short review." /></Field>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button onClick={draft} disabled={busy !== null} className="inline-flex items-center gap-1.5 font-medium text-purple-600 hover:underline disabled:opacity-50">{busy === 'draft' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Draft with AI</button>
          {prev !== null && <button onClick={() => { setMessage(prev); setPrev(null); setDrafted(false) }} className="inline-flex items-center gap-1 text-slate-500 hover:underline"><Undo2 size={13} /> Undo</button>}
          {drafted && <span className="text-xs text-slate-500">Template draft from your profile: edit it before sending.</span>}
        </div>
      </div>
    </Modal>
  )
}

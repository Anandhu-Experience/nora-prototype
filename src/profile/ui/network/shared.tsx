import { Mail, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { ReferralRow } from '../../../presence/network'
import { followUp } from '../../../presence/network'
import { draftMessage } from '../../assistant'
import { actions, useStore } from '../../store'
import type { Agent } from '../../types'
import { Pill } from '../kit'
import { BTN_GHOST, BTN_PRIMARY, INPUT, Modal } from '../Modal'
import { useToast } from '../Toast'

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function downloadFile(name: string, body: string, type = 'text/html'): void {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The professional behind a referral row, or a minimal stand-in so the deterministic drafter can address a lead. */
export const personFor = (row: Pick<ReferralRow, 'name' | 'agentId'>, agents: Record<string, Agent>): Agent =>
  (row.agentId ? agents[row.agentId] : undefined) ?? ({ id: row.name, name: row.name, specialties: [], yearsExperience: 0 } as unknown as Agent)

/** Follow-up message drafted for a referral. Editable; nothing is sent until the user clicks Send. */
export function FollowUpModal({ row, onClose }: { row: ReferralRow; onClose: () => void }) {
  const state = useStore()
  const toast = useToast()
  const person = personFor(row, state.agents)
  const [variant, setVariant] = useState(0)
  const [text, setText] = useState(() => draftMessage(person, { purpose: 'followup', tone: 'friendly' }))
  const [touched, setTouched] = useState(false)
  const redraft = () => {
    setText(draftMessage(person, { purpose: 'followup', tone: variant % 2 ? 'friendly' : 'professional', variant: variant + 1 }))
    setVariant((v) => v + 1)
    setTouched(false)
  }
  const send = () => {
    if (!text.trim()) return
    if (row.agentId) {
      actions.sendReferral(row.agentId, text.trim())
      toast(`Follow-up sent to ${row.name}`)
    } else {
      toast(`Follow-up email to ${row.email || row.name} sent (demo)`)
    }
    followUp(row.id, row.attempts)
    onClose()
  }
  return (
    <Modal
      title={<span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600"><Mail size={19} /></span><span>Follow up with {row.name}<span className="block text-sm font-normal text-slate-500">Attempt {row.attempts + 1}{row.email ? ` · ${row.email}` : ''}</span></span></span>}
      onClose={onClose}
      footer={<><button className={BTN_GHOST} onClick={onClose}>Cancel</button><button className={BTN_PRIMARY} onClick={send} disabled={!text.trim()}>Send follow-up</button></>}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <Pill tone="purple"><Sparkles size={11} /> {touched ? 'Edited draft' : 'Template draft, review before sending'}</Pill>
        <button className="inline-flex items-center gap-1 font-medium text-purple-600 hover:underline" onClick={redraft}><RefreshCw size={12} /> Redraft</button>
      </div>
      <textarea className={`${INPUT} h-44 resize-none`} value={text} onChange={(e) => { setText(e.target.value); setTouched(true) }} aria-label="Follow-up message" />
      <p className="mt-2 text-xs text-slate-500">Nothing is sent until you click Send.</p>
    </Modal>
  )
}

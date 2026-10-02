import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { actions } from '../store'
import type { Agent } from '../types'
import { BTN_GHOST, BTN_PRIMARY, INPUT, Modal } from './Modal'
import { useToast } from './Toast'

const MAX = 500
export const defaultReferral = (a: Agent) =>
  `Hi ${a.name.replace(/^agent\s+/i, '').split(' ')[0]},\n\nI would like to refer a client to you. Could you please connect with me to discuss further?\n\nThanks!`

export function ReferralModal({ agent, initialText, onClose }: { agent: Agent; initialText?: string; onClose: () => void }) {
  const toast = useToast()
  const [text, setText] = useState(initialText ?? defaultReferral(agent))
  const valid = text.trim().length > 0 && text.length <= MAX

  const send = () => {
    if (!valid) return
    actions.sendReferral(agent.id, text.trim())
    toast(`Referral request sent to ${agent.name}`)
    onClose()
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600"><UserPlus size={20} /></span>
          <span>
            Request a Referral
            <span className="block text-sm font-normal text-slate-500">Send a referral request to {agent.name}</span>
          </span>
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={send} disabled={!valid}>Send Request</button>
        </>
      }
    >
      <textarea className={`${INPUT} h-44 resize-none`} value={text} onChange={(e) => setText(e.target.value)} aria-label="Referral message" />
      <div className={`mt-1 text-right text-xs ${text.length > MAX ? 'text-rose-600' : 'text-slate-400'}`}>{text.length}/{MAX}</div>
    </Modal>
  )
}

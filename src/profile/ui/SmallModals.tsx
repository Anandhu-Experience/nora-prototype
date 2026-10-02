import { Star, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { actions } from '../store'
import { COVERS, PRESET_COVERS, coverStyle } from '../selectors'
import type { Agent, Service } from '../types'
import { Field, readImage } from './bits'
import { BTN_GHOST, BTN_PRIMARY, INPUT, Modal } from './Modal'
import { ServiceArt } from './ServiceArt'
import { useToast } from './Toast'

export function ReviewModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const toast = useToast()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [author, setAuthor] = useState('')
  const [text, setText] = useState('')
  const [tried, setTried] = useState(false)

  const errors = {
    rating: rating ? '' : 'Choose a star rating.',
    author: author.trim() ? '' : 'Enter your name.',
    text: text.trim().length >= 10 ? '' : 'Write at least 10 characters.',
  }
  const submit = () => {
    setTried(true)
    if (errors.rating || errors.author || errors.text) return
    actions.addReview(agent.id, { author: author.trim(), rating, text: text.trim() })
    toast('Thanks! Your review was posted.')
    onClose()
  }

  return (
    <Modal
      title={`Review ${agent.name}`}
      onClose={onClose}
      footer={
        <>
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={submit}>Post Review</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">Your rating</div>
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="p-0.5">
                <Star size={28} className={(hover || rating) >= n ? 'text-amber-400' : 'text-slate-300'} fill="currentColor" strokeWidth={0} />
              </button>
            ))}
          </div>
          {tried && errors.rating && <p className="mt-1 text-xs text-rose-600">{errors.rating}</p>}
        </div>
        <Field label="Your name" error={tried ? errors.author : ''}>
          <input className={INPUT} value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <Field label="Your review" error={tried ? errors.text : ''}>
          <textarea className={`${INPUT} h-28 resize-none`} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

const REASONS = ['Inaccurate information', 'Inappropriate content', 'Impersonation', 'Spam or scam', 'Other']

export function ReportModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const submit = () => {
    actions.report(agent.id, reason, details.trim())
    toast('Report submitted. Thank you.', 'info')
    onClose()
  }
  return (
    <Modal
      title={`Report ${agent.name}`}
      onClose={onClose}
      footer={
        <>
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={submit} disabled={!reason}>Submit Report</button>
        </>
      }
    >
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-slate-600">What’s the problem?</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {r}
          </label>
        ))}
      </fieldset>
      <textarea className={`${INPUT} mt-3 h-24 resize-none`} placeholder="Add details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
    </Modal>
  )
}

export function ServiceModal({ service, onRequest, onClose }: { service: Service; onRequest: () => void; onClose: () => void }) {
  return (
    <Modal
      title={service.name}
      onClose={onClose}
      footer={
        <>
          <button className={BTN_GHOST} onClick={onClose}>Close</button>
          <button className={BTN_PRIMARY} onClick={onRequest}>Request this service</button>
        </>
      }
    >
      <ServiceArt icon={service.icon} className="mb-4 h-32 rounded-xl" />
      <p className="text-sm font-medium text-slate-800">{service.blurb}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{service.description}</p>
    </Modal>
  )
}

export function CoverModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [pick, setPick] = useState(agent.cover)
  const [error, setError] = useState('')

  const upload = async (f?: File) => {
    if (!f) return
    try {
      setPick(await readImage(f, 3_000_000))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
  }
  const apply = () => {
    actions.setCover(agent.id, pick)
    toast('Cover updated')
    onClose()
  }

  return (
    <Modal
      title="Change cover"
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={apply} disabled={pick === agent.cover}>Apply</button>
        </>
      }
    >
      <div className="h-28 rounded-xl" style={coverStyle(pick)} />
      <div className="mt-4 grid grid-cols-5 gap-2">
        {PRESET_COVERS.map((id) => (
          <button key={id} onClick={() => setPick(id)} aria-label={COVERS[id]!.label} aria-pressed={pick === id} className={`h-14 rounded-lg ring-offset-2 ${pick === id ? 'ring-2 ring-blue-600' : ''}`} style={coverStyle(id)} title={COVERS[id]!.label} />
        ))}
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files?.[0])} />
      <button className={`${BTN_GHOST} mt-4`} onClick={() => file.current?.click()}><Upload size={14} /> Upload image</button>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </Modal>
  )
}

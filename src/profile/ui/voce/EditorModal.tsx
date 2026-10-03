import { CalendarClock, Loader2, Save, Send, Sparkles, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { authorityScore, BODY_MAX, DRAFT_COST, canDraft, creditsAvailable, publishArticle, saveArticle, scheduleArticle, scheduleError, spendDraftCredits, TITLE_MAX, validateArticle, voceStore, wordCount, type Article } from '../../../presence/voce'
import { draftArticle, templateArticle } from '../../aiDrafts'
import { useStore } from '../../store'
import { Field } from '../bits'
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, INPUT, Modal } from '../Modal'
import { useToast } from '../Toast'

export interface EditorSeed { article?: Article; topic?: string; autoWrite?: boolean; personalize?: boolean }

export function EditorModal({ seed, onClose }: { seed: EditorSeed; onClose: () => void }) {
  const toast = useToast()
  const state = useStore()
  const me = state.agents[state.viewerId]!
  const a = seed.article
  const [topic, setTopic] = useState(a?.topic ?? seed.topic ?? '')
  const [title, setTitle] = useState(a?.title ?? '')
  const [body, setBody] = useState(a?.body ?? '')
  const [origin, setOrigin] = useState<Article['origin']>(a?.origin ?? 'manual')
  const [label, setLabel] = useState<string | null>(null)
  const [prev, setPrev] = useState<{ title: string; body: string } | null>(null)
  const [busy, setBusy] = useState<'write' | 'save' | 'schedule' | 'publish' | null>(null)
  const [date, setDate] = useState('')
  const [showDate, setShowDate] = useState(false)
  const [tried, setTried] = useState(false)
  const started = useRef(false)
  const vs = voceStore.use()

  const write = async () => {
    const t = topic.trim()
    if (t.length < 4) { toast('Tell NORA what to write about first.', 'error'); return }
    if (!canDraft(voceStore.get())) { toast(`Not enough credits: a draft costs ${DRAFT_COST}. Upgrade your plan on the page.`, 'error'); return }
    setBusy('write')
    const spec = seed.personalize ? ` Focus on ${me.specialties.slice(0, 2).join(' and ')} for clients in ${me.location}.` : ''
    const res = await draftArticle(me, t + spec)
    spendDraftCredits()
    setPrev({ title, body })
    const plain = res.source === 'mock' ? templateArticle(me, t) : res
    setTitle(plain.title.slice(0, TITLE_MAX)); setBody(plain.body); setOrigin(res.source)
    setLabel(res.source === 'ai' ? `AI draft${res.model ? ` (${res.model})` : ''}` : `Template draft${res.note ? ` (${res.note})` : ''}`)
    setBusy(null)
  }
  useEffect(() => {
    if (seed.autoWrite && !started.current) { started.current = true; void write() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const errs = validateArticle(title, body, busy === 'publish' || tried)
  const persist = () => saveArticle({ id: a?.id, title, body, topic: topic.trim() || title, origin })
  const saveDraft = () => {
    const e = validateArticle(title, body, false)
    if (e.title || e.body) { setTried(true); return }
    persist(); toast('Draft saved'); onClose()
  }
  const doSchedule = async () => {
    const e = validateArticle(title, body, true), de = scheduleError(date)
    if (e.title || e.body || de) { setTried(true); return }
    setBusy('schedule')
    const id = persist(); scheduleArticle(id, date)
    toast(`Scheduled for ${date}`); onClose()
  }
  const publish = async () => {
    setTried(true)
    const e = validateArticle(title, body, true)
    if (e.title || e.body) return
    setBusy('publish')
    const id = persist(); await publishArticle(id)
    toast(`Published. Your AI Authority Score is now ${authorityScore(voceStore.get())}/100`); onClose()
  }
  const dateErr = tried && showDate ? scheduleError(date) : null

  return (
    <Modal width="max-w-2xl" title={a ? 'Edit article' : 'Write an article'} onClose={onClose}
      footer={<>
        <button onClick={saveDraft} disabled={busy !== null} className={BTN_GHOST}><Save size={15} /> Save draft</button>
        <button onClick={() => (showDate ? void doSchedule() : setShowDate(true))} disabled={busy !== null} className={BTN_OUTLINE}><CalendarClock size={15} /> Schedule</button>
        <button onClick={publish} disabled={busy !== null} className={BTN_PRIMARY}>{busy === 'publish' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publish</button>
      </>}>
      <div className="space-y-4">
        <Field label="Topic or question" hint={`NORA drafts from this. Each AI draft costs ${DRAFT_COST} credits (${creditsAvailable(vs)} left). Nothing is published until you click Publish.`}>
          <div className="flex gap-2">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} className={INPUT} placeholder="What is an FHA loan?" />
            <button onClick={write} disabled={busy !== null} className={`${BTN_OUTLINE} shrink-0`}>{busy === 'write' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Write with AI</button>
          </div>
        </Field>
        {(label || prev) && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {label && <span className="rounded-full bg-purple-50 px-2.5 py-0.5 font-medium text-purple-700">{label}</span>}
            {prev && <button onClick={() => { setTitle(prev.title); setBody(prev.body); setPrev(null); setLabel(null) }} className="inline-flex items-center gap-1 text-slate-600 hover:underline"><Undo2 size={13} /> Undo</button>}
            <span>Review and edit before you save or publish.</span>
          </div>
        )}
        <Field label="Title" error={errs.title}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} maxLength={TITLE_MAX + 20} />
          <span className={`mt-1 block text-right text-xs ${title.length > TITLE_MAX ? 'text-rose-600' : 'text-slate-400'}`}>{title.length} / {TITLE_MAX}</span>
        </Field>
        <Field label="Article" error={errs.body}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className={INPUT} />
          <span className={`mt-1 flex justify-between text-xs ${body.length > BODY_MAX ? 'text-rose-600' : 'text-slate-400'}`}><span>{wordCount(body)} words</span><span>{body.length} / {BODY_MAX}</span></span>
        </Field>
        {showDate && (
          <Field label="Publish on" error={dateErr ?? undefined} hint="Pick a future date. Press Schedule again to confirm.">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT} max-w-[200px]`} />
          </Field>
        )}
      </div>
    </Modal>
  )
}

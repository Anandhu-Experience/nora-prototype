import { ChevronRight, HelpCircle, Loader2, Pencil, Sparkles, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DRAFT_COST, FAQ_POINTS, GENERAL_FAQS, SUGGESTED_FAQS, canDraft, deleteFaq, saveFaq, spendDraftCredits, voceStore } from '../../../presence/voce'
import { draftFaqAnswer, templateFaq } from '../../aiDrafts'
import { useStore } from '../../store'
import { Field } from '../bits'
import { Card } from '../PageBits'
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, INPUT } from '../Modal'
import { useToast } from '../Toast'

export function FaqSection({ prefill }: { prefill: { question: string; n: number } | null }) {
  const s = voceStore.use()
  const toast = useToast()
  const state = useStore()
  const me = state.agents[state.viewerId]!
  const [open, setOpen] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [editing, setEditing] = useState<string | undefined>()
  const [prev, setPrev] = useState<string | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const form = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!prefill) return
    setQ(prefill.question); setA(''); setEditing(undefined); setLabel(null); setPrev(null)
    form.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [prefill])

  const draft = async () => {
    if (q.trim().length < 5) { setErr('Write the question first.'); return }
    if (!canDraft(voceStore.get())) { toast(`Not enough credits: a draft costs ${DRAFT_COST}.`, 'error'); return }
    setBusy(true)
    const d = await draftFaqAnswer(me, q)
    spendDraftCredits()
    setPrev(a); setA(d.source === 'mock' ? templateFaq(me, q) : d.text); setLabel(d.source === 'ai' ? `AI draft${d.model ? ` (${d.model})` : ''}` : `Template draft${d.note ? ` (${d.note})` : ''}`)
    setBusy(false)
  }
  const save = () => {
    const e = saveFaq(q, a, editing)
    setErr(e)
    if (e) return
    toast(editing ? 'Answer updated' : `Answer saved: +${FAQ_POINTS} authority points (up to the cap)`)
    setQ(''); setA(''); setEditing(undefined); setPrev(null); setLabel(null)
  }
  const chips = SUGGESTED_FAQS.filter((x) => !s.faqs.some((f) => f.question.toLowerCase() === x.toLowerCase()))

  return (
    <Card icon={HelpCircle} title="FAQs">
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {GENERAL_FAQS.map((f, i) => (
          <li key={f.q}>
            <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50">{f.q}<ChevronRight size={16} className={`shrink-0 text-slate-400 transition ${open === i ? 'rotate-90' : ''}`} /></button>
            {open === i && <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{f.a}</p>}
          </li>
        ))}
      </ul>

      <div ref={form} className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Your FAQs (answers clients ask)</h3>
        <p className="mt-0.5 text-xs text-slate-500">Each answered FAQ adds {FAQ_POINTS} authority points. NORA drafts, you edit and save.</p>
        {s.faqs.length > 0 && (
          <ul className="mt-3 space-y-2">
            {s.faqs.map((f) => (
              <li key={f.id} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-start justify-between gap-3"><span className="text-sm font-medium text-slate-900">{f.question}</span>
                  <span className="flex shrink-0 gap-1">
                    <button aria-label={`Edit ${f.question}`} onClick={() => { setQ(f.question); setA(f.answer); setEditing(f.id); setLabel(null); setPrev(null) }} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil size={14} /></button>
                    <button aria-label={`Delete ${f.question}`} onClick={() => { deleteFaq(f.id); toast('Answer removed') }} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{f.answer}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
          {chips.length > 0 && !editing && <div className="flex flex-wrap gap-2">{chips.map((c) => <button key={c} onClick={() => { setQ(c); setA(''); setLabel(null) }} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-purple-300 hover:text-purple-700">{c}</button>)}</div>}
          <Field label="Question"><input value={q} onChange={(e) => setQ(e.target.value)} className={INPUT} placeholder="How much can I borrow?" /></Field>
          <Field label="Your answer" error={err ?? undefined}><textarea value={a} onChange={(e) => { setA(e.target.value); setLabel(null) }} rows={4} className={INPUT} placeholder="Write the answer in your own words." /></Field>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={draft} disabled={busy} className={BTN_OUTLINE}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Draft answer with AI</button>
            {prev !== null && <button onClick={() => { setA(prev); setPrev(null); setLabel(null) }} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline"><Undo2 size={13} /> Undo</button>}
            {label && <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">{label}</span>}
            <span className="flex-1" />
            {editing && <button onClick={() => { setQ(''); setA(''); setEditing(undefined) }} className={BTN_GHOST}>Cancel</button>}
            <button onClick={save} className={BTN_PRIMARY}>{editing ? 'Save changes' : 'Save answer'}</button>
          </div>
          <p className="text-xs text-slate-400">AI drafts cost {DRAFT_COST} credits and are never saved until you click Save.</p>
        </div>
      </div>
    </Card>
  )
}

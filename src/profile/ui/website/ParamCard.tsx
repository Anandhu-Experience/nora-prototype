import { Check, ChevronDown, Code2, Copy, Gauge, Loader2, MapPin, RefreshCw, ShieldCheck, Sparkles, Star, Undo2, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { draftMeta, type TextDraft } from '../../aiDrafts'
import { loadBand, recommendedTag, websiteActions, type Item, type Parameter, type ParamId, type TagId, type WebsiteState } from '../../../presence/website'
import type { Agent } from '../../types'
import { Pill } from '../kit'
import { BTN_GHOST, BTN_PRIMARY, INPUT } from '../Modal'
import { useToast } from '../Toast'

const ICON: Record<ParamId, LucideIcon> = { nap: MapPin, load: Gauge, html: Code2, reviews: Star, security: ShieldCheck }
const BLURB: Record<ParamId, string> = {
  nap: 'Consistent name, address and phone number help search engines match your site to your business.',
  load: 'A slow site signals to search engines that visitors may not get what they expect, which can hurt your rankings.',
  html: 'Eight SEO meta tags tell search engines and social networks what your page is about.',
  reviews: 'Showing your reviews on the site builds trust and can earn star ratings in search results.',
  security: 'A valid SSL certificate and an HTTPS redirect keep visitors safe and are a ranking signal.',
}
export const PARAM_ICON = ICON

/** Three-band benchmark with the measured load time as a marker (scale 0 to 6 seconds). */
export function LoadBar({ seconds }: { seconds: number }) {
  const band = loadBand(seconds)
  const left = Math.min(98, (seconds / 6) * 100)
  return (
    <div className="pt-6">
      <div className="relative flex h-3 overflow-visible rounded-full">
        <div className="h-full rounded-l-full bg-emerald-200" style={{ width: '41.7%' }} />
        <div className="h-full bg-amber-200" style={{ width: '25%' }} />
        <div className="h-full rounded-r-full bg-rose-200" style={{ width: '33.3%' }} />
        <div className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: `${left}%` }} aria-label={`Measured load time ${seconds.toFixed(1)} seconds`}>
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${band === 'good' ? 'bg-emerald-600 text-white' : band === 'needs' ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white'}`}>{seconds.toFixed(1)}s</span>
          <span className="h-3 w-0.5 bg-slate-700" />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-500">
        <span>Good: 2.5 seconds or less</span><span>Needs improvement: 2.6 to 4.0 seconds</span><span>Poor: more than 4.0 seconds</span>
      </div>
    </div>
  )
}

/** Meta description: draft with AI, edit, Undo or Apply. Nothing changes until Apply. */
function MetaDraftBox({ agent, onApplied, points }: { agent: Agent; onApplied: () => void; points: number }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<TextDraft | null>(null)
  const [text, setText] = useState('')
  const run = async () => {
    setBusy(true)
    try { const d = await draftMeta(agent); setDraft(d); setText(d.text) } catch { toast('Could not draft right now. Try again.', 'error') } finally { setBusy(false) }
  }
  const apply = () => {
    websiteActions.applyTag('description', text)
    toast(`Meta description added, +${points} points`)
    onApplied()
  }
  if (!draft) {
    return <button onClick={() => void run()} disabled={busy} className={BTN_GHOST + ' !px-3 !py-1.5 !text-xs'}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-purple-500" />} {busy ? 'Drafting…' : 'Draft with AI'}</button>
  }
  return (
    <div className="space-y-2 rounded-xl border border-purple-100 bg-purple-50/50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Pill tone={draft.source === 'ai' ? 'purple' : 'slate'}>{draft.source === 'ai' ? `AI draft${draft.model ? ` (${draft.model})` : ''}` : `Template draft${draft.note ? ` (${draft.note.replace(/\.$/, '')})` : ''}`}</Pill>
        <span>Read and edit it. Nothing is added to your site until you apply it.</span>
      </div>
      <label className="sr-only" htmlFor="meta-draft">Meta description draft</label>
      <textarea id="meta-draft" className={`${INPUT} h-20 resize-none`} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs ${text.length > 160 ? 'text-rose-600' : 'text-slate-400'}`}>{text.length}/160</span>
        <span className="flex-1" />
        <button onClick={() => { setDraft(null); setText('') }} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"><Undo2 size={12} /> Undo</button>
        <button onClick={() => void run()} disabled={busy} className={BTN_GHOST + ' !px-3 !py-1.5 !text-xs'}>{busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Redraft</button>
        <button onClick={apply} disabled={!text.trim() || busy} className={BTN_PRIMARY + ' !px-3 !py-1.5 !text-xs'}><Check size={13} /> Apply</button>
      </div>
    </div>
  )
}

function RecommendedTagBox({ id, agent, points }: { id: TagId; agent: Agent; points: number }) {
  const toast = useToast()
  const rec = recommendedTag(id, agent)
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-500">Recommended tag (preview)</div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2 text-xs text-slate-700">{rec.html}</pre>
      <button onClick={() => { websiteActions.applyTag(id, rec.value); toast(`Tag added, +${points} points`) }} className={BTN_PRIMARY + ' !px-3 !py-1.5 !text-xs'}><Check size={13} /> Add recommended tag</button>
    </div>
  )
}

function ItemRow({ item, agent, busy, onFix }: { item: Item; agent: Agent; busy: boolean; onFix: (id: string) => void }) {
  const toast = useToast()
  const partial = item.points > 0 && item.points < item.max
  const tag = item.id.startsWith('tag-') ? (item.id.slice(4) as TagId) : null
  return (
    <li className="rounded-xl border border-slate-200 p-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.ok ? 'bg-emerald-50 text-emerald-600' : partial ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>{item.ok ? <Check size={14} /> : <X size={14} />}</span>
        <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{item.label}{item.value && <span className="ml-2 break-words font-normal text-slate-500">{item.value}</span>}</span>
        <Pill tone={item.ok ? 'green' : partial ? 'amber' : 'red'}>{item.ok ? 'Available' : partial ? 'Needs improvement' : 'Not available'}</Pill>
        <span className="w-14 text-right text-xs text-slate-400">{item.points}/{item.max}</span>
      </div>
      {!item.ok && (
        <div className="mt-2.5 space-y-2.5 pl-9">
          <p className="text-xs leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">How to fix: </span>{item.fix}</p>
          {tag === 'description' && <MetaDraftBox agent={agent} points={item.max} onApplied={() => {}} />}
          {tag && tag !== 'description' && <RecommendedTagBox id={tag} agent={agent} points={item.max} />}
          {!tag && (
            <button onClick={() => { onFix(item.id); toast('Thanks, re-scanning your site', 'info') }} disabled={busy} className={BTN_GHOST + ' !px-3 !py-1.5 !text-xs'}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Mark as fixed / Re-scan
            </button>
          )}
        </div>
      )}
    </li>
  )
}

export function ParamCard({ param, state, agent, open, onToggle, onFix }: { param: Parameter; state: WebsiteState; agent: Agent; open: boolean; onToggle: () => void; onFix: (id: string) => void }) {
  const Icon = ICON[param.id]
  const okCount = param.items.filter((i) => i.ok).length
  const full = param.points >= param.max
  const items = param.items
  return (
    <section id={`param-${param.id}`} className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 p-5 text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${full ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}><Icon size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-slate-900">{param.label}</span>
          <span className="block text-xs text-slate-500">{param.id === 'load' ? `Measured ${state.scan?.loadTime.toFixed(1)}s` : `${okCount} of ${items.length} available`}</span>
        </span>
        <Pill tone={full ? 'green' : param.points > 0 ? 'amber' : 'red'}>{param.points}/{param.max} pts</Pill>
        <ChevronDown size={18} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-5">
          <p className="text-sm text-slate-500">{BLURB[param.id]}</p>
          {param.id === 'load' && state.scan && <LoadBar seconds={state.scan.loadTime} />}
          <ul className="space-y-2.5">
            {items.map((i) => <ItemRow key={i.id} item={i} agent={agent} busy={state.scanning} onFix={onFix} />)}
          </ul>
        </div>
      )}
    </section>
  )
}

export function CopyBox({ text, label }: { text: string; label: string }) {
  const toast = useToast()
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast('Tag copied') } catch { toast('Select the tag and copy it manually', 'info') } }
  return (
    <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <code aria-label={label} className="min-w-0 flex-1 break-all text-xs text-slate-700">{text}</code>
      <button onClick={() => void copy()} aria-label="Copy verification tag" className="shrink-0 rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"><Copy size={14} /></button>
    </div>
  )
}

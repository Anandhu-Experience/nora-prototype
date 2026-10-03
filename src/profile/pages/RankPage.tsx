import { ArrowLeft, Check, Code2, Copy, FileJson, Link2, LayoutTemplate, Star, TriangleAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { RANK_FORMATS, agentAddresses, buildSchema, embedCode, rankFormatOf, rankUrl, schemaChecklist, schemaScore } from '../details'
import { fmtRating, ratingStats, sourceOf } from '../selectors'
import { actions, useStore } from '../store'
import type { Agent, RankFormat } from '../types'
import { Avatar, Stars } from '../ui/bits'
import { JsonLd } from '../ui/JsonLd'
import { Ring } from '../ui/kit'
import { BTN_GHOST, BTN_PRIMARY } from '../ui/Modal'
import { Card, PageHeader } from '../ui/PageBits'
import { ScrollFade } from '../ui/ScrollFade'
import { useToast } from '../ui/Toast'

const copyText = async (text: string): Promise<boolean> => {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

/** The three formats are all drawn from the same profile data. Nothing here is hand-built per person. */
export function RankFormatView({ agent, format }: { agent: Agent; format: RankFormat }) {
  const s = ratingStats(agent.reviews)
  const top = [...agent.reviews].sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date))[0]
  const city = agentAddresses(agent)[0]!.city
  if (format === 'banner') {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <Avatar agent={agent} size={56} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-slate-900">{agent.name}</div>
          <div className="truncate text-sm text-slate-500">{agent.title} · {agent.company} · {city}</div>
        </div>
        <div className="flex items-center gap-2 text-sm"><Stars rating={s.avg} size={14} /><b className="text-slate-900">{fmtRating(s.avg)}</b><span className="text-slate-500">({s.count})</span></div>
        <span className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white">View profile</span>
      </div>
    )
  }
  if (format === 'reviews') {
    return (
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center gap-2"><Star size={20} className="fill-amber-400 text-amber-400" /><span className="text-2xl font-bold text-slate-900">{fmtRating(s.avg)}</span><span className="text-sm text-slate-500">from {s.count} review{s.count === 1 ? '' : 's'}</span></div>
        {top ? <blockquote className="mt-3 text-sm italic leading-relaxed text-slate-700">“{top.text}”<footer className="mt-1 not-italic text-xs text-slate-500">{top.author} · {sourceOf(top)}</footer></blockquote> : <p className="mt-3 text-sm text-slate-500">No reviews yet.</p>}
        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3"><Avatar agent={agent} size={36} /><div className="min-w-0 text-sm"><div className="truncate font-semibold text-slate-900">{agent.name}</div><div className="truncate text-xs text-slate-500">{agent.title}</div></div></div>
      </div>
    )
  }
  return (
    <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-3">
        <Avatar agent={agent} size={64} />
        <div className="min-w-0"><div className="truncate text-lg font-semibold text-slate-900">{agent.name}</div><div className="truncate text-sm text-slate-500">{agent.title}</div><div className="truncate text-xs text-slate-400">{agent.company} · NMLS {agent.nmls}</div></div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm"><Stars rating={s.avg} size={14} /><b className="text-slate-900">{fmtRating(s.avg)}</b><span className="text-slate-500">· {s.count} review{s.count === 1 ? '' : 's'}</span></div>
      <div className="mt-3 flex flex-wrap gap-1.5">{agent.specialties.slice(0, 3).map((t) => <span key={t} className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{t}</span>)}</div>
    </div>
  )
}

export default function RankPage() {
  const { id } = useParams()
  const state = useStore()
  const toast = useToast()
  const agent = state.agents[id ?? ''] ?? state.agents[state.viewerId]!
  const isOwner = agent.id === state.viewerId
  const format = rankFormatOf(agent)
  const origin = window.location.origin

  const checks = schemaChecklist(agent)
  const score = schemaScore(agent)
  const json = JSON.stringify(buildSchema(agent, origin), null, 2)
  const embed = embedCode(agent, format, origin)
  const copy = async (text: string, what: string) => toast((await copyText(text)) ? `${what} copied` : `Could not copy. Select the text and copy it.`, 'info')

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <JsonLd agent={agent} />
      <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"><ArrowLeft size={15} /> Profile Overview</Link>
      <PageHeader icon={LayoutTemplate} title="Rank page and schema" subtitle="A shareable rank page for your profile, in three formats, with the structured data search engines and AI assistants read." />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card icon={LayoutTemplate} title="Format">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Rank page format">
            {RANK_FORMATS.map((f) => (
              <button key={f.id} role="radio" aria-checked={format === f.id} disabled={!isOwner} onClick={() => { actions.setRankFormat(agent.id, f.id); toast(`Format set to ${f.label}`) }}
                className={`rounded-xl border p-3 text-left disabled:cursor-default ${format === f.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <span className="flex items-center justify-between text-sm font-semibold text-slate-900">{f.label}{format === f.id && <Check size={15} className="text-blue-600" />}</span>
                <span className="mt-1 block text-xs text-slate-500">{f.blurb}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 sm:p-5" aria-label="Preview"><RankFormatView agent={agent} format={format} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={BTN_PRIMARY} onClick={() => void copy(rankUrl(agent, origin), 'Link')}><Link2 size={15} /> Copy link</button>
            <button className={BTN_GHOST} onClick={() => void copy(embed, 'Embed code')}><Code2 size={15} /> Copy embed code</button>
            <Link to={`/profile/${agent.id}`} className={BTN_GHOST}>View public profile</Link>
          </div>
          <label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-slate-600">Embed code (HTML, inline styles, no scripts)</span>
            <textarea readOnly rows={4} value={embed} onFocus={(e) => e.currentTarget.select()} className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-xs text-slate-700" />
          </label>
        </Card>

        <Card className="flex flex-col" icon={FileJson} title="Structured data" right={<span className="text-xs text-slate-500">schema.org</span>}>
          <div className="flex items-center gap-4">
            <Ring value={score} max={100} size={84} stroke={8} tone={score === 100 ? 'stroke-emerald-500' : 'stroke-blue-500'} label={`Schema ${score}% complete`}><span className="text-lg font-bold text-slate-900">{score}%</span></Ring>
            <p className="text-sm text-slate-600">{score === 100 ? 'Everything search engines and AI assistants look for is in place.' : 'Fill the gaps below so search engines and AI assistants can describe you accurately.'}</p>
          </div>
          <ul className="mt-4 space-y-1.5">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                {c.ok ? <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-500" />}
                <span className="min-w-0"><span className={c.ok ? 'text-slate-700' : 'font-medium text-slate-900'}>{c.label}</span>{!c.ok && <span className="block text-xs text-slate-500">{c.hint}{isOwner && <> <Link to="/profile?edit=1" className="font-medium text-blue-600 hover:underline">Edit profile</Link></>}</span>}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">Search engines and AI assistants use this to answer questions like “who is a good loan officer in {agentAddresses(agent)[0]!.city}?”. A higher score gives them more to quote.</p>
        </Card>
      </div>

      <Card icon={Code2} title="JSON-LD" right={<button className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline" onClick={() => void copy(json, 'JSON-LD')}><Copy size={14} /> Copy</button>}>
        <p className="mb-3 text-sm text-slate-500">This is added to your public profile and this page, built from the same data as everything else, so it never drifts from what clients see.</p>
        <ScrollFade maxHeight={320} className="rounded-xl bg-slate-900/95">
          <pre className="overflow-x-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-slate-100">{json}</pre>
        </ScrollFade>
      </Card>
    </div>
  )
}

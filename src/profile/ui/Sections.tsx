import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, FileText, Pencil, Star } from 'lucide-react'
import { useState } from 'react'
import { fmtDate, fmtRating, insightsFor, ratingStats } from '../selectors'
import { actions } from '../store'
import type { Agent, Review, Service } from '../types'
import { Stars } from './bits'
import { BTN_GHOST, BTN_PRIMARY, INPUT } from './Modal'
import { ServiceArt } from './ServiceArt'
import { INSIGHT_ICON } from './insightIcons'
import { ScrollFade } from './ScrollFade'
import { useToast } from './Toast'
import { useNoraChat } from '../NoraContext'

export const CARD = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-card'
const H2 = 'flex items-center gap-2.5 text-[17px] font-semibold text-slate-900'

const initialsOf = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
export const newestFirst = (rs: Review[]) => [...rs].sort((a, b) => b.date.localeCompare(a.date))

/* ---------- Overview cards ---------- */

export function AboutCard({ agent, isOwner, full }: { agent: Agent; isOwner: boolean; full?: boolean }) {
  const toast = useToast()
  const [expanded, setExpanded] = useState(!!full)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(agent.about)
  const long = agent.about.length > 140

  const save = () => {
    if (text.length > 600) return
    actions.setAbout(agent.id, text.trim())
    setEditing(false)
    toast('About updated')
  }

  return (
    <section className={`${CARD} flex flex-col`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className={H2}><FileText size={20} className="text-slate-500" /> About</h2>
        {isOwner && !editing && (
          <button onClick={() => { setText(agent.about); setEditing(true) }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"><Pencil size={14} /> Edit</button>
        )}
      </div>

      {editing ? (
        <div className="mt-3">
          <textarea className={`${INPUT} h-36 resize-none`} value={text} onChange={(e) => setText(e.target.value)} aria-label="About" />
          <div className={`mt-1 text-right text-xs ${text.length > 600 ? 'text-rose-600' : 'text-slate-400'}`}>{text.length}/600</div>
          <div className="mt-2 flex justify-end gap-2">
            <button className={BTN_GHOST} onClick={() => setEditing(false)}>Cancel</button>
            <button className={BTN_PRIMARY} onClick={save} disabled={text.length > 600}>Save</button>
          </div>
        </div>
      ) : (
        <>
          <p className={`mt-3 text-sm leading-relaxed text-slate-600 ${expanded ? '' : 'line-clamp-2'}`}>{agent.about || 'No bio yet.'}</p>
          {long && !full && (
            <button onClick={() => setExpanded((e) => !e)} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
              {expanded ? 'Show less' : 'Read more'} <ChevronDown size={14} className={expanded ? 'rotate-180' : ''} />
            </button>
          )}
        </>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {[agent.title, ...agent.specialties].map((t) => <span key={t} className="rounded-md bg-blue-50 px-3 py-1.5 text-sm text-blue-700">{t}</span>)}
      </div>
    </section>
  )
}

export function ServicesCard({ agent, onViewAll, onOpen }: { agent: Agent; onViewAll: () => void; onOpen: (s: Service) => void }) {
  return (
    <section className={`${CARD} flex flex-col`}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className={H2}><FileText size={20} className="text-slate-500" /> Services</h2>
        <button onClick={onViewAll} className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">View all <ArrowRight size={14} /></button>
      </div>
      {agent.services.length === 0 ? <p className="mt-3 text-sm text-slate-500">No services listed.</p> : (
        <div className="mt-3 grid flex-1 grid-cols-3 gap-3">
          {agent.services.slice(0, 3).map((s) => (
            <button key={s.id} onClick={() => onOpen(s)} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 text-left hover:shadow-md">
              <ServiceArt icon={s.icon} className="min-h-16 flex-1" />
              <span className="flex items-center justify-between px-2.5 py-2 text-xs font-medium text-slate-800">{s.name} <ChevronRight size={13} className="text-slate-400" /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function ReviewsCard({ agent, onViewAll, onStars }: { agent: Agent; onViewAll: () => void; onStars: (n: number) => void }) {
  const s = ratingStats(agent.reviews)
  const list = newestFirst(agent.reviews)
  const [i, setI] = useState(0)
  const r = list[i % Math.max(list.length, 1)]

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className={H2}><Star size={20} className="text-amber-400" fill="currentColor" /> Reviews &amp; Ratings</h2>
        <button onClick={onViewAll} className="text-sm font-medium text-blue-600 hover:underline">View all reviews →</button>
      </div>
      {s.count === 0 ? <p className="mt-3 text-sm text-slate-500">No reviews yet.</p> : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[130px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="text-3xl font-bold text-slate-900">{fmtRating(s.avg)}</div>
            <Stars rating={s.avg} size={16} />
            <div className="mt-1 text-xs text-slate-500">{s.count} review{s.count === 1 ? '' : 's'}</div>
          </div>
          <div className="space-y-1.5">
            {s.dist.map((d) => (
              <button key={d.stars} onClick={() => onStars(d.stars)} disabled={!d.count} aria-label={`${d.stars} stars: ${d.count} review${d.count === 1 ? '' : 's'}`} className="flex w-full items-center gap-2 text-xs text-slate-500 enabled:hover:text-blue-600">
                <span className="w-6">{d.stars} <Star size={10} className="inline text-amber-400" fill="currentColor" strokeWidth={0} /></span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${d.pct}%` }} /></span>
                <span className="w-8 text-right">{d.pct}%</span>
              </button>
            ))}
          </div>
          {r && (
            <div className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{initialsOf(r.author)}</span>
                <Stars rating={r.rating} />
                <span className="text-xs text-slate-400">{fmtDate(r.date)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <button aria-label="Previous review" disabled={list.length < 2} onClick={() => setI((i - 1 + list.length) % list.length)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
                  <button aria-label="Next review" disabled={list.length < 2} onClick={() => setI((i + 1) % list.length)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16} /></button>
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{r.text}</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function AiInsightsCard({ agent }: { agent: Agent }) {
  const chat = useNoraChat()
  return (
    <section className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className={H2}><span className="text-purple-500">✦</span> NORA Insights</h2>
        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-violet-700">BETA</span>
      </div>
      {/* capped so a long list scrolls inside the card, with edge fades */}
      <ScrollFade maxHeight={152} tone="purple" wrapperClassName="mt-3">
        <ul className="space-y-1">
          {insightsFor(agent).map((i) => (
            <li key={i.id}>
              <button onClick={() => chat.ask(i.prompt)} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-2 text-left text-sm text-slate-700 hover:bg-white">
                <span className="text-blue-600">{INSIGHT_ICON[i.icon]}</span>{i.text}
              </button>
            </li>
          ))}
        </ul>
      </ScrollFade>
    </section>
  )
}

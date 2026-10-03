import { Check, ChevronLeft, ChevronRight, ClipboardCheck, Eye, FileText, Image as ImageIcon, MapPin, Medal, Send, Sparkles, Star, TrendingUp, User, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ANALYTICS } from '../seed'
import { useSrs } from '../../presence/srs'
import { agentCompleteness, ratingStats, recommendedActions, reviewSources, sourceOf, timeAgo, type RecAction, type RecActionId } from '../selectors'
import type { Agent, ReviewSource } from '../types'
import { Stars } from './bits'
import { newestFirst } from './Sections'

/* ---------------- small visuals ---------------- */

/** Stylised marks for the review sources. Placeholders, not the brands' official artwork. */
export function SourceIcon({ source, size = 32 }: { source: ReviewSource; size?: number }) {
  const box = { width: size, height: size }
  if (source === 'Google') return <span style={box} className="flex shrink-0 items-center justify-center rounded-full bg-white text-base font-bold shadow-sm ring-1 ring-slate-200" aria-label="Google"><span className="bg-gradient-to-r from-blue-500 via-red-500 to-amber-400 bg-clip-text text-transparent">G</span></span>
  if (source === 'Facebook') return <span style={box} className="flex shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white" aria-label="Facebook">f</span>
  return <span style={box} className="flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-100" aria-label="Experience.com"><Sparkles size={size * 0.5} fill="currentColor" strokeWidth={1} /></span>
}

/** The NORA mascot. */
function Robot({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="NORA assistant">
      <defs>
        <linearGradient id="rb-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dbe6ff" /></linearGradient>
        <linearGradient id="rb-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e2a5a" /><stop offset="1" stopColor="#0f1738" /></linearGradient>
      </defs>
      <line x1="60" y1="10" x2="60" y2="24" stroke="#93a8e8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="9" r="5" fill="#7c5cff" />
      <rect x="14" y="52" width="9" height="22" rx="4.5" fill="#6d8dff" />
      <rect x="97" y="52" width="9" height="22" rx="4.5" fill="#6d8dff" />
      <rect x="22" y="24" width="76" height="62" rx="26" fill="url(#rb-head)" stroke="#b9c9f5" strokeWidth="2" />
      <rect x="31" y="35" width="58" height="38" rx="17" fill="url(#rb-face)" />
      <ellipse cx="48" cy="54" rx="6" ry="7.5" fill="#53e0ff" /><ellipse cx="72" cy="54" rx="6" ry="7.5" fill="#53e0ff" />
      <ellipse cx="50" cy="51.5" rx="2" ry="2.5" fill="#fff" opacity=".8" /><ellipse cx="74" cy="51.5" rx="2" ry="2.5" fill="#fff" opacity=".8" />
      <path d="M52 65 Q60 70 68 65" fill="none" stroke="#53e0ff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M38 98 Q60 88 82 98 L82 112 Q60 118 38 112 Z" fill="#7c5cff" opacity=".9" />
    </svg>
  )
}

function Donut({ pct }: { pct: number }) {
  const r = 38, c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" className="h-[84px] w-[84px] shrink-0 -rotate-90" role="img" aria-label={`${pct}% complete`}>
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-slate-100" />
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" strokeLinecap="round" className={pct >= 100 ? 'stroke-emerald-500' : 'stroke-emerald-500'} strokeDasharray={`${(pct / 100) * c} ${c}`} />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" transform="rotate(90 50 50)" className="fill-slate-900 text-[22px] font-bold">{pct}%</text>
    </svg>
  )
}

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-card'
const ICON_BOX = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'

/* ---------------- KPI cards ---------------- */

function Kpi({ to, onClick, icon: Icon, tone, title, children, sub }: { to?: string; onClick?: () => void; icon: LucideIcon; tone: string; title: string; children: ReactNode; sub: ReactNode }) {
  const body = (
    <>
      <div className="flex items-center gap-2.5"><span className={`${ICON_BOX} ${tone}`}><Icon size={18} /></span><span className="text-[15px] font-semibold text-slate-900">{title}</span></div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="min-w-0">{children}<div className="mt-1 text-sm text-slate-500">{sub}</div></div>
        <ChevronRight size={18} className="shrink-0 text-slate-400" />
      </div>
    </>
  )
  const cls = `${CARD} block w-full p-5 text-left transition hover:border-blue-300 max-sm:w-[250px] max-sm:shrink-0`
  return to ? <Link to={to} className={cls}>{body}</Link> : <button onClick={onClick} className={cls}>{body}</button>
}

const Delta = ({ pct }: { pct: number }) => <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">↑ {pct}%</span>

export function KpiCards({ agent, onActions }: { agent: Agent; onActions: () => void }) {
  const pct = agentCompleteness(agent)
  const todo = recommendedActions(agent).length
  const r = ratingStats(agent.reviews)
  const srs = useSrs(agent)
  return (
    <>
      <button onClick={onActions} className={`${CARD} block w-full p-5 text-left transition hover:border-blue-300 max-sm:w-[250px] max-sm:shrink-0`}>
        <div className="flex items-center gap-2.5"><span className={`${ICON_BOX} bg-rose-50 text-rose-500`}><ClipboardCheck size={18} /></span><span className="text-[15px] font-semibold text-slate-900">Profile Completeness</span></div>
        <div className="mt-3 flex items-center gap-4">
          <Donut pct={pct} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-emerald-600">{pct >= 100 && !todo ? 'All done!' : pct >= 80 ? 'Great progress!' : 'Keep going!'}</div>
            <div className="text-sm text-slate-500">{todo ? `${todo} item${todo === 1 ? '' : 's'} to complete` : 'Nothing left to do'}</div>
          </div>
          <ChevronRight size={18} className="shrink-0 text-slate-400" />
        </div>
      </button>
      <Kpi to={`/profile/${agent.id}?tab=reviews`} icon={Check} tone="bg-emerald-50 text-emerald-600" title="Total Rating" sub={`Based on ${r.count} review${r.count === 1 ? '' : 's'}`}>
        <div className="flex items-baseline gap-1.5"><Star size={26} className="self-center text-amber-400" fill="currentColor" strokeWidth={0} /><span className="text-3xl font-bold text-slate-900">{r.count ? r.avg.toFixed(1) : '–'}</span><span className="text-lg text-slate-500">/ 5</span></div>
      </Kpi>
      <Kpi to="/insights" icon={Eye} tone="bg-violet-50 text-violet-600" title="Profile Views" sub="Last 30 days">
        <div className="flex items-center gap-2.5"><span className="text-3xl font-bold text-slate-900">{ANALYTICS.viewsLast30Days.toLocaleString()}</span><Delta pct={ANALYTICS.viewsChangePct} /></div>
      </Kpi>
      <Kpi to="/search-rank" icon={TrendingUp} tone="bg-blue-50 text-blue-600" title="Search Rank Score" sub="Current score">
        <div className="flex items-center gap-2.5"><span className="flex items-baseline gap-1"><span className="text-3xl font-bold text-slate-900">{srs.total}</span><span className="text-lg text-slate-500">/ 850</span></span><Delta pct={ANALYTICS.rankChangePct} /></div>
      </Kpi>
    </>
  )
}

/* ---------------- Recommended actions ---------------- */

const ACTION_ICON: Record<RecActionId, { icon: LucideIcon; tone: string }> = {
  photo: { icon: User, tone: 'bg-blue-50 text-blue-600' },
  specialties: { icon: Sparkles, tone: 'bg-purple-50 text-purple-600' },
  cover: { icon: ImageIcon, tone: 'bg-blue-50 text-blue-600' },
  'service-areas': { icon: MapPin, tone: 'bg-rose-50 text-rose-500' },
  awards: { icon: Medal, tone: 'bg-amber-50 text-amber-500' },
  bio: { icon: FileText, tone: 'bg-sky-50 text-sky-600' },
}

export function RecommendedActions({ agent, onRun }: { agent: Agent; onRun: (id: RecActionId) => void }) {
  const [all, setAll] = useState(false)
  const items = recommendedActions(agent)
  const shown = all ? items : items.slice(0, 4)
  return (
    <section id="recommended-actions" className={`${CARD} flex flex-col p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Recommended Actions</h2>
          <p className="text-sm text-slate-500">Complete these items to improve your profile and online visibility.</p>
        </div>
        {items.length > 4 && <button onClick={() => setAll((a) => !a)} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 hover:underline">{all ? 'Show fewer' : 'View all actions'} <ChevronRight size={15} className={all ? '-rotate-90' : ''} /></button>}
      </div>
      {items.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><Check size={18} /> You're all set. Nothing left to improve right now.</div>
      ) : (
        <ul className="mt-4 flex flex-1 flex-col divide-y divide-slate-100 rounded-xl border border-slate-100">
          {shown.map((a) => <ActionRow key={a.id} action={a} onRun={onRun} />)}
        </ul>
      )}
    </section>
  )
}

function ActionRow({ action, onRun }: { action: RecAction; onRun: (id: RecActionId) => void }) {
  const { icon: Icon, tone } = ACTION_ICON[action.id]
  return (
    <li className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={22} /></span>
      <div className="min-w-[180px] flex-1">
        <div className="font-semibold text-slate-900">{action.title}</div>
        <div className="text-sm text-slate-500">{action.description}</div>
      </div>
      <button onClick={() => onRun(action.id)} className="rounded-lg border border-blue-600 bg-white px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50">{action.cta}</button>
      <ChevronRight size={18} className="hidden text-slate-400 sm:block" />
    </li>
  )
}

/* ---------------- NORA assistant card ---------------- */

export function NoraAssistantCard({ agent, onRun, onAsk, proposal }: { agent: Agent; onRun: (id: RecActionId) => void; onAsk: (q: string) => void; proposal: string | null }) {
  const [q, setQ] = useState('')
  const pct = agentCompleteness(agent)
  const top = recommendedActions(agent).slice(0, 3)
  const submit = () => {
    if (!q.trim()) return
    onAsk(q.trim())
    setQ('')
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-100 via-blue-50 to-white shadow-card">
      <div className="flex items-start justify-between gap-2 p-5 pb-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700"><Sparkles size={14} /> NORA AI Assistant</div>
          <h2 className="mt-2 text-xl font-bold leading-snug text-slate-900">
            {top.length === 0 ? 'Your profile is in great shape.' : pct >= 80 ? 'Your profile is strong!' : 'Let’s strengthen your profile.'}
            {top.length > 0 && <><br />Here {top.length === 1 ? 'is 1 way' : `are ${top.length} ways`} to go further.</>}
          </h2>
        </div>
        <Robot className="-mt-1 h-24 w-24 shrink-0" />
      </div>
      <div className="mx-3 mb-3 rounded-xl bg-white p-4 shadow-sm">
        {proposal && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg bg-purple-50 p-3 text-sm">
            <span className="text-slate-800"><span className="font-semibold text-purple-700">NORA found:</span> {proposal}</span>
            <button onClick={() => onRun('specialties')} className="shrink-0 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">Fix with NORA</button>
          </div>
        )}
        <ol className="space-y-3">
          {top.map((a, i) => (
            <li key={a.id} className="flex items-center gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">{i + 1}</span>
              <span className="min-w-0 flex-1 text-slate-700">{a.title}. {a.description}</span>
              <button onClick={() => onRun(a.id)} className="shrink-0 rounded-lg border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">{a.cta}</button>
            </li>
          ))}
          {top.length === 0 && <li className="text-sm text-slate-600">Nothing to add right now. Ask me anything about your profile.</li>}
        </ol>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 p-1.5 pl-3 focus-within:border-blue-400">
          <Sparkles size={16} className="shrink-0 text-blue-500" />
          <input aria-label="Ask NORA for personalized tips" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-slate-400" placeholder="Ask NORA for personalized tips..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <button onClick={submit} disabled={!q.trim()} aria-label="Send to NORA" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-40"><Send size={17} /></button>
        </div>
      </div>
    </section>
  )
}

/* ---------------- Reviews ---------------- */

export function ReviewsRatings({ agent }: { agent: Agent }) {
  const r = ratingStats(agent.reviews)
  const sources = reviewSources(agent)
  return (
    <section className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-400"><Star size={30} fill="currentColor" strokeWidth={0} /></span>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reviews &amp; Ratings</h2>
            <div className="mt-1 flex items-baseline gap-2"><Star size={22} className="self-center text-amber-400" fill="currentColor" strokeWidth={0} /><span className="text-3xl font-bold text-slate-900">{r.count ? r.avg.toFixed(1) : '–'}</span><span className="text-lg text-slate-500">/ 5</span></div>
            <p className="text-sm text-slate-500">Based on {r.count} review{r.count === 1 ? '' : 's'} across all sources</p>
          </div>
        </div>
        <div className="min-w-[220px] flex-1 sm:max-w-[320px]">
          <div className="mb-1 text-right"><Link to={`/profile/${agent.id}?tab=reviews`} className="text-sm font-medium text-blue-600 hover:underline">View all reviews →</Link></div>
          <div className="space-y-1.5">
            {r.dist.map((d) => (
              <Link key={d.stars} to={`/profile/${agent.id}?tab=reviews&stars=${d.stars}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600" aria-label={`${d.stars} star: ${d.pct}%`}>
                <span className="w-9">{d.stars} star</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${d.pct}%` }} /></span>
                <span className="w-8 text-right">{d.pct}%</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {sources.map((s) => (
          <div key={s.source} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <SourceIcon source={s.source} size={38} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{s.source}</div><div className="text-xs text-slate-500">{s.count} review{s.count === 1 ? '' : 's'}</div></div>
            <div className="text-base font-semibold text-slate-900">{s.count ? s.avg.toFixed(1) : '–'}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function RecentReviews({ agent }: { agent: Agent }) {
  const list = newestFirst(agent.reviews)
  const [i, setI] = useState(0)
  const r = list[((i % list.length) + list.length) % (list.length || 1)]
  return (
    <section className={`${CARD} p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Recent Reviews</h2>
        <Link to={`/profile/${agent.id}?tab=reviews`} className="text-sm font-medium text-blue-600 hover:underline">See all →</Link>
      </div>
      {!r ? <p className="mt-4 text-sm text-slate-500">No reviews yet.</p> : (
        <div className="mt-4 flex items-center gap-2">
          <button aria-label="Previous review" onClick={() => setI(i - 1)} disabled={list.length < 2} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <div className="min-w-0 flex-1 rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{r.author.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2"><span className="font-semibold text-slate-900">{r.author}</span><Stars rating={r.rating} size={13} /><span className="text-xs text-slate-400">{timeAgo(r.date)}</span></div>
              </div>
              <SourceIcon source={sourceOf(r)} size={26} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{r.text}</p>
          </div>
          <button aria-label="Next review" onClick={() => setI(i + 1)} disabled={list.length < 2} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      )}
      {list.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Choose review">
          {list.map((_, d) => <button key={d} role="tab" aria-selected={d === ((i % list.length) + list.length) % list.length} aria-label={`Review ${d + 1}`} onClick={() => setI(d)} className={`h-2 w-2 rounded-full ${d === ((i % list.length) + list.length) % list.length ? 'bg-blue-600' : 'bg-slate-300'}`} />)}
        </div>
      )}
    </section>
  )
}


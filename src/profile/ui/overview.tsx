import { ChevronLeft, ChevronRight, Sparkles, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ratingStats, reviewSources, sourceOf, timeAgo } from '../selectors'
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

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-card'

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


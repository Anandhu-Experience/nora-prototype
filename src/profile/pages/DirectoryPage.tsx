import { Building2, MapPin, Search, ShieldCheck, Star, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useReferral } from '../NoraContext'
import { allServices, cities, fmtRating, isTopRated, ratingStats } from '../selectors'
import { useStore } from '../store'
import { Avatar, Stars } from '../ui/bits'
import { BTN_GHOST, INPUT } from '../ui/Modal'
import { Card, EmptyState, KpiCell, KpiGrid, PageHeader } from '../ui/PageBits'
import { ScrollFade } from '../ui/ScrollFade'

type Sort = 'rating' | 'reviews' | 'experience'

export function DirectoryView() {
  const state = useStore()
  const openReferral = useReferral()
  const [params, setParams] = useSearchParams()
  const [sort, setSort] = useState<Sort>('rating')
  const q = params.get('q') ?? ''
  const city = params.get('city') ?? ''
  const service = params.get('service') ?? ''

  const set = (k: string, v: string) => setParams((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n }, { replace: true })

  const list = useMemo(() => {
    const t = q.toLowerCase()
    return state.order.map((id) => state.agents[id]!)
      .filter((a) => !city || a.city === city)
      .filter((a) => !service || a.services.some((s) => s.name === service))
      .filter((a) => !t || [a.name, a.title, a.company, a.city, ...a.specialties].some((v) => v.toLowerCase().includes(t)))
      .sort((a, b) => sort === 'reviews' ? b.reviews.length - a.reviews.length : sort === 'experience' ? b.yearsExperience - a.yearsExperience : ratingStats(b.reviews).avg - ratingStats(a.reviews).avg)
  }, [state, q, city, service, sort])

  const avg = list.length ? list.reduce((n, a) => n + ratingStats(a.reviews).avg, 0) / list.length : 0
  const filters = [q && { k: 'q', label: `“${q}”` }, city && { k: 'city', label: city }, service && { k: 'service', label: service }].filter(Boolean) as { k: string; label: string }[]

  return (
    <div className="space-y-5">
      {/* Phones: one swipeable row with edge fades. From sm up it is the usual grid and nothing scrolls. */}
      <ScrollFade axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1" innerClassName="sm:min-w-0">
      <KpiGrid slider>
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Users} label="Showing" value={list.length} sub={`of ${state.order.length} professionals`} />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Star} label="Average rating" value={fmtRating(avg)} sub="Across the list" />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={ShieldCheck} label="Top rated" value={list.filter(isTopRated).length} sub="4.5+ with 3+ reviews" />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={MapPin} label="Cities" value={new Set(list.map((a) => a.city)).size} sub="Represented" />
      </KpiGrid>
      </ScrollFade>

      <Card>
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${INPUT} pl-9`} placeholder="Filter by name, company, specialty…" aria-label="Filter professionals" value={q} onChange={(e) => set('q', e.target.value)} />
          </div>
          <select className={INPUT} aria-label="City" value={city} onChange={(e) => set('city', e.target.value)}><option value="">All cities</option>{cities(state).map((c) => <option key={c}>{c}</option>)}</select>
          <select className={INPUT} aria-label="Service" value={service} onChange={(e) => set('service', e.target.value)}><option value="">All services</option>{allServices(state).map((c) => <option key={c}>{c}</option>)}</select>
          <select className={INPUT} aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="rating">Top rated</option><option value="reviews">Most reviews</option><option value="experience">Most experienced</option></select>
        </div>
        {filters.length > 0 && (
          <ScrollFade axis="x" wrapperClassName="mt-3" innerClassName="flex items-center gap-2">
            {filters.map((f) => (
              <span key={f.k} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{f.label}<button aria-label={`Remove ${f.label} filter`} onClick={() => set(f.k, '')}><X size={12} /></button></span>
            ))}
            <button className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-500 hover:text-slate-800" onClick={() => setParams({}, { replace: true })}>Clear filters</button>
          </ScrollFade>
        )}
      </Card>

      {list.length === 0 && <EmptyState>No professionals match these filters.</EmptyState>}
      {/* Phones: one swipeable row with edge fades. From sm up the cards stack, then become a 2-column grid. */}
      {list.length > 0 && (
      <ScrollFade
        axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1"
        innerClassName="flex gap-4 sm:min-w-0 sm:grid lg:grid-cols-2"
        innerProps={{ role: 'list', 'aria-label': 'Professionals' }}
      >
        {list.map((a) => {
          const s = ratingStats(a.reviews)
          return (
            <div key={a.id} role="listitem" className="flex w-[300px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:w-auto">
              <div className="flex items-start gap-4">
                <Avatar agent={a} size={60} online />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/profile/${a.id}`} className="text-lg font-semibold text-slate-900 hover:text-blue-600">{a.name}</Link>
                    {a.pro && <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">PRO</span>}
                    {isTopRated(a) && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Top Rated</span>}
                  </div>
                  <div className="text-sm text-slate-500">{a.title}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Building2 size={13} /> {a.company}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={13} /> {a.location}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-center">
                <div className="bg-white py-2.5"><div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-900">{fmtRating(s.avg)}<span className="max-sm:hidden"><Stars rating={s.avg} size={11} /></span></div><div className="text-[11px] text-slate-500">{s.count} review{s.count === 1 ? '' : 's'}</div></div>
                <div className="bg-white py-2.5"><div className="text-sm font-semibold text-slate-900">{a.yearsExperience}+ yrs</div><div className="text-[11px] text-slate-500">Experience</div></div>
                <div className="bg-white py-2.5"><div className="text-sm font-semibold text-slate-900">{a.responseRate}%</div><div className="text-[11px] text-slate-500">Response rate</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">{a.specialties.map((t) => <span key={t} className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{t}</span>)}</div>
              <div className="mt-auto flex gap-2 pt-4">
                <Link to={`/profile/${a.id}`} className={`${BTN_GHOST} flex-1 whitespace-nowrap max-sm:px-2 max-sm:text-xs`}>View profile</Link>
                {a.id !== state.viewerId && <button className="inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 max-sm:px-2 max-sm:text-xs" onClick={() => openReferral(a.id)}>Request referral</button>}
              </div>
            </div>
          )
        })}
      </ScrollFade>
      )}
    </div>
  )
}

export default function DirectoryPage() {
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={Users} title="Professionals" subtitle="Find and refer to trusted loan professionals." />
      <DirectoryView />
    </div>
  )
}

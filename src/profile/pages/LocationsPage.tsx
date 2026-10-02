import { ArrowRight, MapPin, Star, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cities, fmtRating, ratingStats } from '../selectors'
import { useStore } from '../store'
import { Avatar } from '../ui/bits'
import { KpiCell, KpiGrid, PageHeader } from '../ui/PageBits'
import { ScrollFade } from '../ui/ScrollFade'

export default function LocationsPage() {
  const state = useStore()
  const agents = state.order.map((id) => state.agents[id]!)
  const rows = cities(state).map((city) => {
    const here = agents.filter((a) => a.city === city)
    return { city, here, avg: here.reduce((n, a) => n + ratingStats(a.reviews).avg, 0) / here.length, loans: here.reduce((n, a) => n + a.completedLoans, 0) }
  }).sort((a, b) => b.here.length - a.here.length || b.avg - a.avg)
  const overall = agents.reduce((n, a) => n + ratingStats(a.reviews).avg, 0) / (agents.length || 1)

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={MapPin} title="Locations" subtitle="Browse professionals by city." />

      {/* Phones: one swipeable row with edge fades. From sm up it is the usual grid and nothing scrolls. */}
      <ScrollFade axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1" innerClassName="sm:min-w-0">
      <KpiGrid slider>
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={MapPin} label="Cities" value={rows.length} sub="With professionals" />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Users} label="Professionals" value={agents.length} sub="In the network" />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Star} label="Average rating" value={fmtRating(overall)} sub="Across all cities" />
        <KpiCell className="max-sm:w-[168px] max-sm:shrink-0" icon={Trophy} label="Busiest city" value={rows[0]?.city ?? '–'} sub={rows[0] ? `${rows[0].here.length} professional${rows[0].here.length === 1 ? '' : 's'}` : undefined} />
      </KpiGrid>
      </ScrollFade>

      {/* Phones: one swipeable row with edge fades. From sm up the row is a grid and nothing scrolls. */}
      <ScrollFade
        axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1"
        innerClassName="flex gap-4 sm:min-w-0 sm:grid sm:grid-cols-2 xl:grid-cols-3"
        innerProps={{ role: 'list', 'aria-label': 'Cities' }}
      >
        {rows.map(({ city, here, avg, loans }) => (
          <div key={city} role="listitem" className="w-[272px] shrink-0 sm:w-auto">
            <Link to={`/professionals?city=${encodeURIComponent(city)}`} className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-blue-300">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><MapPin size={20} /></span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{here.length} professional{here.length === 1 ? '' : 's'}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">{city}</h2>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5"><dd className="text-sm font-semibold text-slate-900">{fmtRating(avg)}</dd><dt className="text-slate-500">Avg rating</dt></div>
                <div className="rounded-lg bg-slate-50 p-2.5"><dd className="text-sm font-semibold text-slate-900">{loans}+</dd><dt className="text-slate-500">Loans closed</dt></div>
              </dl>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">{here.slice(0, 4).map((a) => <span key={a.id} className="rounded-full ring-2 ring-white"><Avatar agent={a} size={30} /></span>)}</div>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-2">View <ArrowRight size={15} /></span>
              </div>
            </Link>
          </div>
        ))}
      </ScrollFade>
    </div>
  )
}

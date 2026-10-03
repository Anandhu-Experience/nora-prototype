import { Check, ChevronDown, Clock, Map, MapPin, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DAY_NAMES, agentAddresses, agentHours, amenityLabel, fmtTime, formatAddress, geoFor, hoursSummary, isOpenNow, localParts, mapsUrl } from '../details'
import type { Address, Agent } from '../types'
import { CARD } from './Sections'

/** A stylised demo map: a made-up street grid with a pin at a stable position for the address. No tiles are loaded. */
export function MapPreview({ address, className = '' }: { address: Address; className?: string }) {
  const g = geoFor(address)
  const px = 40 + g.x * 240, py = 20 + g.y * 120
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Map showing ${formatAddress(address)}`} className={`w-full rounded-xl border border-slate-200 bg-slate-100 ${className}`}>
      <rect x="196" y="12" width="92" height="56" rx="10" className="fill-emerald-100" />
      <path d="M-10 128 C 60 100, 120 150, 190 118 S 300 96, 340 120" className="stroke-sky-200" strokeWidth="14" fill="none" strokeLinecap="round" />
      {[40, 88, 140].map((y) => <line key={y} x1="0" x2="320" y1={y} y2={y + 6} className="stroke-white" strokeWidth="6" />)}
      {[60, 130, 210, 270].map((x) => <line key={x} y1="0" y2="180" x1={x} x2={x - 8} className="stroke-white" strokeWidth="6" />)}
      <line x1="0" y1="24" x2="320" y2="160" className="stroke-amber-200" strokeWidth="5" />
      <circle cx={px} cy={py + 4} r="14" className="fill-rose-500/20" />
      <path d={`M${px} ${py + 12} C ${px - 14} ${py - 2}, ${px - 10} ${py - 20}, ${px} ${py - 20} S ${px + 14} ${py - 2}, ${px} ${py + 12} Z`} className="fill-rose-500" />
      <circle cx={px} cy={py - 8} r="4" className="fill-white" />
    </svg>
  )
}

/** Small map tile with a "View on Map" button, as on today's profile. `compact` hides the pin detail for the narrow rows. */
function MapThumb({ address, href }: { address: Address; href: string }) {
  return (
    <div className="relative w-full shrink-0 sm:w-[260px]">
      <MapPreview address={address} className="!h-[100px] !rounded-lg object-cover" />
      <a href={href} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-3 py-1 text-sm font-medium text-blue-700 shadow hover:bg-slate-50">View on Map</a>
    </div>
  )
}

function AddressRow({ address }: { address: Address }) {
  return (
    <li className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><MapPin size={20} /></span>
        <div className="min-w-0">
          <div className="text-[15px] text-slate-900">{formatAddress(address) || address.city}</div>
          {address.label && <div className="text-xs text-slate-500">{address.label}</div>}
          {address.amenities.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {address.amenities.map((id) => <li key={id} className="inline-flex items-center gap-1.5 text-sm text-slate-600"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300 text-emerald-600"><Check size={12} /></span>{amenityLabel(id)}</li>)}
            </ul>
          )}
        </div>
      </div>
      <MapThumb address={address} href={mapsUrl(address)} />
    </li>
  )
}

/** The edit pencil in a card header: opens Edit Profile at the right section for the owner. */
function EditLink({ section, label }: { section: string; label: string }) {
  return <Link to={`/profile?edit=${encodeURIComponent(section)}`} aria-label={label} title={label} className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50"><Pencil size={19} /></Link>
}

const SHOW_OTHERS = 2

/** Primary address first, then the others (two shown, "View more" for the rest), each with its amenities and a map. */
export function LocationsCard({ agent, isOwner = false }: { agent: Agent; isOwner?: boolean }) {
  const [primary, ...others] = agentAddresses(agent)
  const [all, setAll] = useState(false)
  const shown = all ? others : others.slice(0, SHOW_OTHERS)
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between"><h2 className="text-[19px] font-semibold text-slate-900">Location</h2>{isOwner && <EditLink section="Location" label="Edit locations" />}</div>
      <div className="mt-5 text-sm font-medium text-slate-500">Primary address</div>
      <ul className="mt-3"><AddressRow address={primary!} /></ul>
      {others.length > 0 && (
        <>
          <div className="mt-6 text-sm font-medium text-slate-500">Other addresses</div>
          <ul className="mt-3 space-y-5">{shown.map((x) => <AddressRow key={x.id} address={x} />)}</ul>
          {others.length > SHOW_OTHERS && (
            <button onClick={() => setAll((v) => !v)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
              {all ? 'View less' : `View more (${others.length - SHOW_OTHERS})`} <ChevronDown size={16} className={all ? 'rotate-180' : ''} />
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** A drawn regional map with a pin per service area. */
function AreaMap({ areas, href }: { areas: string[]; href: string }) {
  const pins = areas.slice(0, 6).map((c) => geoFor({ id: c, label: c, street: '', city: c, region: '', postal: '', amenities: [] }))
  return (
    <div className="relative w-full shrink-0 sm:w-[260px]">
      <svg viewBox="0 0 320 130" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Map of service areas: ${areas.join(', ')}`} className="h-[100px] w-full rounded-lg border border-slate-200 bg-sky-100">
        <path d="M-10 40 C 40 10, 90 20, 130 36 S 210 20, 250 40 S 320 70, 340 60 L 340 140 L -10 140 Z" className="fill-emerald-100" />
        <path d="M60 50 C 100 40, 140 70, 190 60 S 270 90, 300 80" className="stroke-emerald-200" strokeWidth="2" fill="none" strokeDasharray="4 4" />
        {pins.map((g, i) => <g key={i}><circle cx={40 + g.x * 240} cy={30 + g.y * 80} r="9" className="fill-blue-600/20" /><circle cx={40 + g.x * 240} cy={30 + g.y * 80} r="4.5" className="fill-blue-600" /></g>)}
      </svg>
      <a href={href} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-3 py-1 text-sm font-medium text-blue-700 shadow hover:bg-slate-50">View on Map</a>
    </div>
  )
}

/** The cities the agent serves, the first one as the primary service area. */
export function ServiceAreasCard({ agent, isOwner = false }: { agent: Agent; isOwner?: boolean }) {
  const [first, ...rest] = agent.serviceAreas
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(agent.serviceAreas.join(' | ') || agent.city)}`
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between"><h2 className="text-[19px] font-semibold text-slate-900">Service Areas</h2>{isOwner && <EditLink section="Location" label="Edit service areas" />}</div>
      {!first ? <p className="mt-4 text-sm text-slate-500">No service areas listed.</p> : (
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Map size={20} /></span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-500">Primary service area</div>
              <span className="mt-1.5 inline-block rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800">{first}</span>
              {rest.length > 0 && (
                <>
                  <div className="mt-3 text-sm font-medium text-slate-500">Other service areas</div>
                  <ul className="mt-1.5 flex flex-wrap gap-2">{rest.map((c) => <li key={c} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800">{c}</li>)}</ul>
                </>
              )}
            </div>
          </div>
          <AreaMap areas={agent.serviceAreas} href={href} />
        </div>
      )}
    </section>
  )
}

/** The week at a glance, with today highlighted and an "Open now" badge in the agent's own time zone. */
export function HoursCard({ agent }: { agent: Agent }) {
  const h = agentHours(agent)
  const today = localParts(h.timeZone, new Date()).day
  const open = isOpenNow(h)
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <h2 className="flex items-center gap-2.5 text-[17px] font-semibold text-slate-900"><Clock size={19} className="text-slate-500" /> Business hours</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{open ? 'Open now' : 'Closed now'}</span>
      </div>
      <ul className="mt-3 grid gap-x-10 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-4 [&>li]:border-b [&>li]:border-slate-100">
        {h.days.map((d, k) => (
          <li key={k} className={`flex items-center justify-between py-2 text-sm ${k === today ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
            <span>{DAY_NAMES[k]}{k === today && <span className="ml-2 text-xs font-medium text-blue-600">Today</span>}</span>
            <span>{d.open ? `${fmtTime(d.from)} to ${fmtTime(d.to)}` : 'Closed'}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Times are in {h.timeZone.replace(/_/g, ' ')}. {hoursSummary(h)}.</p>
    </section>
  )
}

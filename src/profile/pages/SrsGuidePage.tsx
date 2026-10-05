import { ArrowLeft, ArrowRight, BarChart3, Info, Lock, Trophy, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PROFILE_WEIGHTS } from '../../mock/rules'
import { CONNECTIONS } from '../../presence/connections'
import { SRS_UNLOCK } from '../../presence/insights'
import { DRIVER_MAX, SRS_MAX, type DriverId } from '../../presence/srs'
import { PARAM_MAX, PARAM_LABEL, TAGS } from '../../presence/website'
import { Card, PageHeader } from '../ui/PageBits'

/**
 * A general explanation of the Search Rank Score: what it is, how the 850 points are divided, how each part is calculated and what
 * the score affects. It deliberately shows no one's real score. The numbers come from the same constants the score uses.
 */
interface Meta { id: DriverId; label: string; max: number; stroke: string; bar: string; chip: string; to: string; blurb: string }
const DRIVERS: Meta[] = [
  { id: 'reviews', label: 'Reviews', max: DRIVER_MAX.reviews, stroke: 'stroke-amber-500', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200', to: '/profile?tab=reviews', blurb: 'What clients say about you, and how many say it.' },
  { id: 'website', label: 'Web Analytics', max: DRIVER_MAX.website, stroke: 'stroke-purple-500', bar: 'bg-purple-500', chip: 'bg-purple-50 text-purple-700 border-purple-200', to: '/analytics', blurb: 'How well your own website supports your name online.' },
  { id: 'profile', label: 'Profile', max: DRIVER_MAX.profile, stroke: 'stroke-blue-500', bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200', to: '/profile', blurb: 'How complete your professional profile is.' },
  { id: 'listings', label: 'Listings', max: DRIVER_MAX.listings, stroke: 'stroke-emerald-500', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', to: '/listings', blurb: 'How widely your business details are published and how accurate they are.' },
  { id: 'connections', label: 'Connections', max: DRIVER_MAX.connections, stroke: 'stroke-sky-500', bar: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 border-sky-200', to: '/connections', blurb: 'The accounts you have linked, each adding credibility.' },
]
const pct = (n: number) => Math.round((n / SRS_MAX) * 100)

/** Donut of the 850 points, one arc per driver. Clicking an arc selects it. */
function Donut({ sel, onSel }: { sel: DriverId; onSel: (id: DriverId) => void }) {
  const size = 240, stroke = 34, r = (size - stroke - 8) / 2, c = 2 * Math.PI * r, gap = 3
  let offset = 0
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`The ${SRS_MAX} points split into ${DRIVERS.map((d) => `${d.label} ${d.max}`).join(', ')}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100" />
        {DRIVERS.map((d) => {
          const len = (d.max / SRS_MAX) * c
          const el = (
            <circle key={d.id} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sel === d.id ? stroke + 6 : stroke} strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset}
              className={`${d.stroke} cursor-pointer transition-all`} onClick={() => onSel(d.id)} role="button" tabIndex={0} aria-label={`${d.label}, ${d.max} points`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSel(d.id)} />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-bold text-slate-900">{SRS_MAX}</span>
        <span className="text-xs text-slate-500">points in total</span>
      </div>
    </div>
  )
}

/** A labelled bar sized against `of`. */
function Part({ label, points, of, bar, note }: { label: string; points: number; of: number; bar: string; note?: string }) {
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="font-medium text-slate-800">{label}</span><span className="shrink-0 font-mono text-xs text-slate-500">{points} pts</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(2, (points / of) * 100)}%` }} /></div>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </li>
  )
}

const Formula = ({ children }: { children: React.ReactNode }) => <div className="rounded-xl bg-slate-50 px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-700"><span className="mb-1 block font-sans text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">Prototype estimate</span>{children}</div>
const InV2 = ({ children }: { children: React.ReactNode }) => <p className="flex gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900"><span className="shrink-0 rounded bg-white/70 px-1.5 py-0.5 font-semibold">Confirmed in V2</span><span>{children}</span></p>
const Example = ({ children }: { children: React.ReactNode }) => <p className="flex gap-2 rounded-xl border border-dashed border-slate-200 px-3.5 py-2.5 text-xs text-slate-600"><Info size={14} className="mt-0.5 shrink-0 text-slate-400" /><span><b className="text-slate-700">Example. </b>{children}</span></p>

function Detail({ d }: { d: Meta }) {
  const bar = d.bar
  switch (d.id) {
    case 'profile':
      return (
        <div className="space-y-4">
          <Formula>Profile points = the sum of the points for each field you have filled in (100 in all)</Formula>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[['Name', PROFILE_WEIGHTS.name], ['Photo', PROFILE_WEIGHTS.photoUrl], ['Headline (job title)', PROFILE_WEIGHTS.headline], ['Phone number', PROFILE_WEIGHTS.phone], ['Location', PROFILE_WEIGHTS.location], ['Bio', PROFILE_WEIGHTS.bio], ['Specialties (5 or more)', PROFILE_WEIGHTS.specialties]].map(([l, p]) => <Part key={l as string} label={l as string} points={p as number} of={20} bar={bar} />)}
          </ul>
          <InV2>The backend sends a profile score, its maximum and the list of incomplete fields. Which fields count and what each is worth are not visible in the V2 app.</InV2>
          <Example>A profile with everything except a photo and a bio earns 100 − 14 − 15 = 71 points.</Example>
        </div>
      )
    case 'reviews':
      return (
        <div className="space-y-4">
          <Formula>Reviews points = rating ÷ 5 × 200  +  5 × number of reviews (up to 20)  +  1 × public replies (up to 75)   (capped at 300)</Formula>
          <ul className="grid gap-3 sm:grid-cols-2">
            <Part label="Rating quality" points={200} of={300} bar={bar} note="Your average star rating as a share of 5 stars, worth up to 200 points." />
            <Part label="Review volume" points={100} of={300} bar={bar} note="5 points for each review, up to 20 reviews, worth up to 100 points." />
            <Part label="Replies" points={75} of={300} bar={bar} note="1 point for each public reply, up to 75. V2 scores replies; the value per reply is our assumption." />
          </ul>
          <InV2>V2 scores this part as <b>Reviews &amp; Replies</b>. Besides how many recent reviews you have, <b>replying to reviews earns points</b> (with a half-point rounding on the last reply). The architecture plan also lets recent reviews lapse after 365 days, which our estimate does not do yet. V2 does not show how rating or review source is weighted.</InV2>
          <Example>An average of 4.5 stars with 10 reviews earns 4.5 ÷ 5 × 200 = 180, plus 10 × 5 = 50, so 230 points.</Example>
        </div>
      )
    case 'website':
      return (
        <div className="space-y-4">
          <Formula>Web Analytics points = the points of every check your website passes (250 in all). A website that is not verified earns 0.</Formula>
          <ul className="grid gap-3 sm:grid-cols-2">
            <Part label={PARAM_LABEL.nap} points={PARAM_MAX.nap} of={90} bar={bar} note="Name 14, address 13, phone 13: found on your site." />
            <Part label={PARAM_LABEL.load} points={PARAM_MAX.load} of={90} bar={bar} note="40 if the page loads in 2.5 s or less, 20 up to 4 s, 0 above that." />
            <Part label={PARAM_LABEL.html} points={PARAM_MAX.html} of={90} bar={bar} note={TAGS.map((t) => `${t.label} ${t.points}`).join(', ') + '.'} />
            <Part label={PARAM_LABEL.reviews} points={PARAM_MAX.reviews} of={90} bar={bar} note="Review widget 16, review schema 14, review count shown 10." />
            <Part label={PARAM_LABEL.security} points={PARAM_MAX.security} of={90} bar={bar} note="Valid SSL certificate 28, http redirects to https 12." />
          </ul>
          <InV2>The five groups match V2: NAP, profile data, HTML and meta tags, reviews on the page, site security, plus load time. The 250 maximum is in the plan; V2 shows each group as completed or not completed and does not show the points split.</InV2>
          <Example>A verified site that loads in 3 s, has every meta tag and valid SSL but no reviews, no address and no redirect earns 20 + 90 + 28 + 27 = 165 points.</Example>
        </div>
      )
    case 'listings':
      return (
        <div className="space-y-4">
          <Formula>Listings points = 60 × (published sites ÷ all sites)  +  40 × (business details filled ÷ 8)  −  12 per open data issue   (kept between 0 and 100)</Formula>
          <ul className="grid gap-3 sm:grid-cols-2">
            <Part label="Published sites" points={60} of={100} bar={bar} note="The share of directory sites (Google, Facebook, Yelp, Bing and more) where your listing is live." />
            <Part label="Business details" points={40} of={100} bar={bar} note="Name, address, phone, category, website, hours, service area and place ID." />
            <Part label="Open data issues" points={-12} of={100} bar="bg-rose-500" note="Each unresolved problem, such as an invalid service area, takes 12 points off." />
          </ul>
          <InV2>V2 scores published sites and business info with a backend score and maximum. The 60/40 split and the issue penalty are not visible in the V2 app.</InV2>
          <Example>With 7 of 14 sites published, all 8 details filled and no issues: 60 × 0.5 + 40 = 70 points.</Example>
        </div>
      )
    default:
      return (
        <div className="space-y-4">
          <Formula>Connections points = the sum of the points for each account you have connected (100 in all)</Formula>
          <ul className="grid gap-3 sm:grid-cols-2">
            {CONNECTIONS.map((c) => <Part key={c.id} label={c.name} points={c.points} of={30} bar={bar} note={c.id === 'google' ? 'The most valuable: it also unlocks Insights.' : undefined} />)}
          </ul>
          <InV2>V2 shows connections as <b>how many networks are connected out of a target number</b>, next to a backend score. The points per network are not visible in the V2 app; Google is marked the most valuable in the plan.</InV2>
          <Example>Google (30) + Facebook (15) + LinkedIn (10) connected earns 55 points.</Example>
        </div>
      )
  }
}

const IMPACTS: { icon: typeof Trophy; title: string; text: string; source: 'v2' | 'prototype' }[] = [
  { icon: Trophy, title: 'Your rank among nearby agents', text: 'A rank in your location, the points to number one, and a Top 5% badge for the highest scorers. The ranking itself is worked out by the backend.', source: 'v2' },
  { icon: Lock, title: `Unlocks the Insights dashboard (${SRS_UNLOCK}+)`, text: `The Google traffic dashboard needs a score of ${SRS_UNLOCK} or more, along with a connected Google account and at least one listing. The score tab itself is never locked.`, source: 'v2' },
  { icon: BarChart3, title: 'Sets your AI Visibility plan tier', text: 'Your score band decides which AI Visibility (VOCE) tier is offered before you subscribe: Discover at 550 and Engage at 850.', source: 'v2' },
  { icon: Wand2, title: 'Colours your score gauge', text: 'The dashboard gauge turns red, orange, yellow or green as your share of 850 grows. This is display only.', source: 'v2' },
  { icon: ArrowRight, title: 'Decides what to do next', text: 'This prototype ranks "Next best actions" by the points each step can add for the effort it takes. V2 shows suggested actions with their points, chosen by the backend.', source: 'prototype' },
]

export default function SrsGuidePage() {
  const [sel, setSel] = useState<DriverId>('reviews')
  const d = DRIVERS.find((x) => x.id === sel)!
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <Link to="/search-rank" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"><ArrowLeft size={15} /> Search Rank Score</Link>
      <PageHeader icon={BarChart3} title="How the Search Rank Score works" subtitle="What it is, how the points are divided, how each part is calculated and what it affects. This is a general guide, not your own score." />

      <div role="note" className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <Info size={18} className="mt-0.5 shrink-0" />
        <p><b>What is confirmed and what is an estimate.</b> The total of {SRS_MAX}, the five parts and the maximum for each come from the v3 plan. The point rules <i>inside</i> each part (weights, formulas and the points per network) are <b>estimates used by this prototype</b>: in the V2 product the score is calculated by the backend, and the V2 app only displays the numbers it is sent. Items marked <span className="rounded bg-white/70 px-1.5 text-xs font-semibold text-emerald-800">Confirmed in V2</span> were checked against the V2 code.</p>
      </div>

      <section className="rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-700 p-6 text-white shadow-card sm:p-7">
        <h2 className="text-xl font-bold sm:text-2xl">One number for your whole online presence</h2>
        <p className="mt-2 max-w-3xl text-sm text-white/85">The Search Rank Score is a number from 0 to {SRS_MAX}. It adds up five things that together show how complete, trusted and visible a professional is online: reviews, website, profile, listings and connections. The higher it is, the higher you sit among nearby agents.</p>
      </section>

      <Card title="How the 850 points are divided">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 md:grid-cols-[260px_minmax(0,1fr)]">
          <Donut sel={sel} onSel={setSel} />
          <div>
            <div className="mb-3 flex h-5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Share of the 850 points per part">
              {DRIVERS.map((x) => <button key={x.id} onClick={() => setSel(x.id)} aria-label={`${x.label}, ${pct(x.max)} percent`} className={`h-full ${x.bar} ${sel === x.id ? '' : 'opacity-70 hover:opacity-100'} border-r-2 border-white last:border-0`} style={{ width: `${(x.max / SRS_MAX) * 100}%` }} />)}
            </div>
            <ul className="space-y-1.5">
              {DRIVERS.map((x) => (
                <li key={x.id}>
                  <button onClick={() => setSel(x.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${sel === x.id ? 'border-slate-400 bg-slate-50' : 'border-transparent hover:bg-slate-50'}`}>
                    <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${x.bar}`} />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{x.label}</span><span className="block truncate text-xs text-slate-500">{x.blurb}</span></span>
                    <span className="shrink-0 text-right"><span className="block text-sm font-semibold text-slate-900">{x.max}</span><span className="block text-[11px] text-slate-500">{pct(x.max)}% of the total</span></span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Select a part to see how it is calculated. {DRIVERS.map((x) => x.max).join(' + ')} = {SRS_MAX}.</p>
          </div>
        </div>
      </Card>

      <Card title={`How ${d.label} is calculated (up to ${d.max} points)`} right={<span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${d.chip}`}>{d.max} of {SRS_MAX}</span>}>
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Parts of the score">
          {DRIVERS.map((x) => <button key={x.id} role="tab" aria-selected={sel === x.id} onClick={() => setSel(x.id)} className={`rounded-full border px-3 py-1 text-sm font-medium ${sel === x.id ? x.chip : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{x.label}</button>)}
        </div>
        <Detail d={d} />
        <Link to={d.to} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">Work on {d.label.toLowerCase()} <ArrowRight size={14} /></Link>
      </Card>

      <Card title="What the score affects">
        <ul className="grid gap-3 sm:grid-cols-2">
          {IMPACTS.map((i) => (
            <li key={i.title} className="flex gap-3 rounded-xl border border-slate-200 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><i.icon size={19} /></span>
              <div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-slate-900">{i.title}</span><span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${i.source === 'v2' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{i.source === 'v2' ? 'Confirmed in V2' : 'This prototype'}</span></div><p className="mt-0.5 text-xs leading-relaxed text-slate-500">{i.text}</p></div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Where the points are">
        <p className="mb-3 text-sm text-slate-600">Reviews and your website hold most of the points, so they move the score the most. Profile, listings and connections are quicker to finish but worth less each.</p>
        <ul className="space-y-2.5">
          {[...DRIVERS].sort((a, b) => b.max - a.max).map((x) => (
            <li key={x.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-medium text-slate-800">{x.label}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${x.bar}`} style={{ width: `${(x.max / SRS_MAX) * 100}%` }} /></span>
              <span className="w-16 shrink-0 text-right font-mono text-xs text-slate-500">{pct(x.max)}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">AI Authority (from AI Visibility) is shown next to the score but is not part of the {SRS_MAX} yet. <b>Not confirmed:</b> whether the score changes how you appear in public search results. The V2 app only displays it, so that would be decided by backend or search services. The leaderboard here compares you with demo peers.</p>
      </Card>
    </div>
  )
}

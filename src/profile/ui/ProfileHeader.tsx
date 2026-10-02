import { Award, Briefcase, Building2, Camera, Clock, Download, FileText, Flag, Gauge, Heart, History, LayoutGrid, Link2, Mail, MapPin, MoreVertical, Pencil, Printer, Share2, Sparkles, Star, Trophy, UserPlus } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useNora, useNoraFix } from '../NoraContext'
import { agentCompleteness, agentGaps, coverStyle, fmtRating, isTopRated, ratingStats, satisfaction, vcard } from '../selectors'
import type { Agent } from '../types'
import { Avatar, MENU_ITEM, Popover, Stars } from './bits'
import { BTN_GHOST } from './Modal'
import { ScrollFade } from './ScrollFade'
import { useToast } from './Toast'

export const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid }, { id: 'reviews', label: 'Reviews', icon: Star }, { id: 'about', label: 'About', icon: FileText },
  { id: 'services', label: 'Services', icon: Briefcase }, { id: 'awards', label: 'Awards', icon: Award }, { id: 'activity', label: 'Activity', icon: History }, { id: 'contact', label: 'Contact', icon: Mail },
] as const
export type TabId = (typeof TABS)[number]['id']

interface Props {
  agent: Agent
  isOwner: boolean
  tab: TabId
  onTab: (t: TabId) => void
  onEdit: () => void
  onReferral: () => void
  onCover: () => void
  onReport: () => void
}

const first = (n: string) => n.replace(/^agent\s+/i, '').split(' ')[0]!

function Summary({ agent, isOwner }: { agent: Agent; isOwner: boolean }) {
  const { state } = useNora()
  const fix = useNoraFix()
  const s = ratingStats(agent.reviews)
  let text: string
  let fixable = false
  if (!isOwner) {
    text = `${first(agent.name)} is rated ${fmtRating(s.avg)} from ${s.count} review${s.count === 1 ? '' : 's'}, typically responds within ${agent.responseTime}, and has closed ${agent.completedLoans}+ loans.`
  } else if (!state.graph) {
    text = 'NORA is reading your profile…'
  } else {
    const queue = state.evaluations.filter((e) => e.rank).sort((a, b) => a.rank! - b.rank!)
    const pct = state.graph.profile.completeness
    fixable = queue.length > 0 && state.status === 'SKILL_PROPOSED'
    text = queue.length
      ? `Your profile is ${pct}% complete. NORA found ${queue.length} opportunit${queue.length === 1 ? 'y' : 'ies'}: ${queue.map((e) => e.name).join(', ')}.`
      : `Your profile is ${pct}% complete and nothing needs your attention. You’re rated ${fmtRating(s.avg)} from ${s.count} review${s.count === 1 ? '' : 's'}.`
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-orange-100 bg-orange-50 px-5 py-3.5 text-sm text-slate-800">
      <Sparkles size={18} className="mt-0.5 shrink-0 text-orange-500" />
      <p className="min-w-0 flex-1"><span className="font-semibold tracking-wide">NORA SUMMARY</span><span className="mx-2 text-slate-400">·</span>{text}</p>
      {fixable && <button onClick={() => fix()} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-sm ring-1 ring-purple-200 hover:bg-purple-50">Fix with NORA →</button>}
    </div>
  )
}

function Kpi({ icon, label, children, onClick }: { icon: ReactNode; label: string; children: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">{icon}{label}</div>
      <div className="mt-2.5 text-left">{children}</div>
    </>
  )
  const cls = 'bg-white p-5 text-left'
  return onClick ? <button onClick={onClick} className={`${cls} hover:bg-slate-50`}>{body}</button> : <div className={cls}>{body}</div>
}

export function ProfileHeader({ agent, isOwner, tab, onTab, onEdit, onReferral, onCover, onReport }: Props) {
  const toast = useToast()
  const fix = useNoraFix()
  const [menu, setMenu] = useState<'share' | 'more' | null>(null)
  const s = ratingStats(agent.reviews)
  const pct = agentCompleteness(agent)
  const gaps = agentGaps(agent)
  const url = `${location.origin}/profile/${agent.id}`
  const close = () => setMenu(null)

  // Keep the selected tab visible (the edge fades would otherwise hide it). Scroll the row only,
  // never the page, so this is safe on first render.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[role=tablist] [aria-selected=true]')
    const row = el?.closest('[role=tablist]')?.parentElement
    if (!el || !row) return
    const { offsetLeft: left, offsetWidth: width } = el
    if (left < row.scrollLeft + 24 || left + width > row.scrollLeft + row.clientWidth - 24) {
      row.scrollTo({ left: left - (row.clientWidth - width) / 2, behavior: 'smooth' })
    }
  }, [tab])

  const copyLink = async () => {
    close()
    try { await navigator.clipboard.writeText(url); toast('Profile link copied') } catch { toast(url, 'info') }
  }
  const openShare = (href: string) => { close(); window.open(href, '_blank', 'noopener,noreferrer') }
  const download = () => {
    close()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([vcard(agent)], { type: 'text/vcard' }))
    a.download = `${agent.name.replace(/\s+/g, '-').toLowerCase()}.vcf`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Contact card downloaded')
  }
  const IconBtn = 'flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'

  return (
    <>
      <div className="relative h-20 overflow-hidden rounded-2xl" style={coverStyle(agent.cover)}>
        {isOwner && (
          <button onClick={onCover} className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/70">
            <Camera size={14} /> Change cover
          </button>
        )}
      </div>

      <section className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <div className="rounded-full shadow-card"><Avatar agent={agent} size={84} online /></div>
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{agent.name}</h1>
            {agent.pro && <span className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">PRO</span>}
            {isTopRated(agent) && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Top Rated</span>}
            <span className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">NMLS #{agent.nmls}</span>
          </div>
          <p className="mt-1 text-[15px] text-slate-500">{agent.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {agent.location}</span>
            <span className="inline-flex items-center gap-1.5"><Building2 size={14} /> {agent.company}</span>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          <div className="relative">
            <button aria-label="Share profile" aria-expanded={menu === 'share'} onClick={() => setMenu(menu === 'share' ? null : 'share')} className={IconBtn}><Share2 size={17} /></button>
            <Popover open={menu === 'share'} onClose={close}>
              <button className={MENU_ITEM} onClick={() => void copyLink()}><Link2 size={15} /> Copy link</button>
              <button className={MENU_ITEM} onClick={() => openShare(`mailto:?subject=${encodeURIComponent(agent.name + ' on Experience.com')}&body=${encodeURIComponent(url)}`)}><Mail size={15} /> Email</button>
              <button className={MENU_ITEM} onClick={() => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)}>in&nbsp; LinkedIn</button>
              <button className={MENU_ITEM} onClick={() => openShare(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(agent.name)}`)}>𝕏&nbsp; Post on X</button>
            </Popover>
          </div>
          <div className="relative">
            <button aria-label="More actions" aria-expanded={menu === 'more'} onClick={() => setMenu(menu === 'more' ? null : 'more')} className={IconBtn}><MoreVertical size={17} /></button>
            <Popover open={menu === 'more'} onClose={close}>
              <button className={MENU_ITEM} onClick={download}><Download size={15} /> Download contact card</button>
              <button className={MENU_ITEM} onClick={() => { close(); window.print() }}><Printer size={15} /> Print profile</button>
              {!isOwner && <button className={`${MENU_ITEM} text-rose-600`} onClick={() => { close(); onReport() }}><Flag size={15} /> Report profile</button>}
            </Popover>
          </div>
          <button className={`${BTN_GHOST} h-10 rounded-xl`} onClick={onReferral}><UserPlus size={15} /> Request Referral</button>
          {isOwner && (
            <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 px-4 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:brightness-110" onClick={onEdit}>
              <Pencil size={15} /> Edit Profile
            </button>
          )}
        </div>
      </section>

      <Summary agent={agent} isOwner={isOwner} />

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-card md:grid-cols-3" aria-label="Key figures">
        <Kpi icon={<Gauge size={15} />} label="Profile completeness">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div>
            <span className="text-sm font-medium text-slate-700">{pct}%</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span>{gaps.length ? `Missing: ${gaps.map((g) => (g === 'photoUrl' ? 'photo' : g)).join(', ')}` : 'Complete'}</span>
            {isOwner && gaps.length > 0 && <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); fix('profile') }} onKeyDown={(e) => e.key === 'Enter' && fix('profile')} className="cursor-pointer font-medium text-purple-600 hover:underline">Fix with NORA →</span>}
          </div>
        </Kpi>
        <Kpi icon={<Star size={15} />} label="Rating" onClick={() => onTab('reviews')}>
          <div className="flex items-center gap-2"><span className="text-lg font-semibold text-slate-900">{fmtRating(s.avg)}</span><Stars rating={s.avg} size={14} /></div>
          <div className="mt-1 text-xs text-slate-500">{s.count} review{s.count === 1 ? '' : 's'}</div>
        </Kpi>
        <Kpi icon={<Clock size={15} />} label="Response rate">
          <div className="text-lg font-semibold text-slate-900">{agent.responseRate}%</div>
          <div className="mt-1 text-xs text-slate-500">Typically within {agent.responseTime}</div>
        </Kpi>
        <Kpi icon={<Briefcase size={15} />} label="Experience">
          <div className="text-lg font-semibold text-slate-900">{agent.yearsExperience}+ years</div>
          <div className="mt-1 text-xs text-slate-500">{agent.services.length} service{agent.services.length === 1 ? '' : 's'} offered</div>
        </Kpi>
        <Kpi icon={<Trophy size={15} />} label="Completed loans">
          <div className="text-lg font-semibold text-slate-900">{agent.completedLoans}+</div>
          <div className="mt-1 text-xs text-slate-500">{agent.awards.length} award{agent.awards.length === 1 ? '' : 's'}</div>
        </Kpi>
        <Kpi icon={<Heart size={15} />} label="Client satisfaction">
          <div className="text-lg font-semibold text-slate-900">{s.count ? `${satisfaction(agent)}%` : '–'}</div>
          <div className="mt-1 text-xs text-slate-500">From client reviews</div>
        </Kpi>
      </section>

      <ScrollFade axis="x" tone="page" className="border-b border-slate-200" innerClassName="flex gap-1" innerProps={{ role: 'tablist', 'aria-label': 'Profile sections' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => onTab(id)} className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm font-medium ${tab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Icon size={16} /> {label}{id === 'reviews' ? ` (${s.count})` : ''}
          </button>
        ))}
      </ScrollFade>
    </>
  )
}

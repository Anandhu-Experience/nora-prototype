import { LayoutTemplate, Camera, CheckCircle2, Download, EyeOff, Link2, MapPin, MoreVertical, Pencil, Printer, ExternalLink, ChevronRight, Building2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useNora, useNoraChat, useNoraFix } from '../NoraContext'
import { coverStyle, initials, vcard, type RecActionId } from '../selectors'
import { actions, useStore } from '../store'
import { MENU_ITEM, Popover } from '../ui/bits'
import { EditProfileModal, SECTIONS, type EditSection } from '../ui/EditProfileModal'
import { NoraAssistantCard, KpiCards, RecentReviews, RecommendedActions, ReviewsRatings } from '../ui/overview'
import { ScrollFade } from '../ui/ScrollFade'
import { CoverModal } from '../ui/SmallModals'
import { useToast } from '../ui/Toast'

type ModalState = { kind: 'edit'; section: EditSection } | { kind: 'cover' } | null

export default function OverviewPage() {
  const state = useStore()
  const agent = state.agents[state.viewerId]!
  const { state: nora } = useNora()
  const fix = useNoraFix()
  const chat = useNoraChat()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState<ModalState>(null)
  const [moreBio, setMoreBio] = useState(false)
  const [moreChips, setMoreChips] = useState(false)
  const [menu, setMenu] = useState(false)

  // Deep link from the account menu: /profile?edit=1
  useEffect(() => {
    const wanted = params.get('edit')
    if (wanted) {
      setModal({ kind: 'edit', section: (SECTIONS as readonly string[]).includes(wanted) ? (wanted as EditSection) : 'Basic Info' })
      setParams((p) => { const n = new URLSearchParams(p); n.delete('edit'); return n }, { replace: true })
    }
  }, [params, setParams])

  /** Every recommended action does something real. */
  const run = (id: RecActionId) => {
    if (id === 'specialties') return fix('profile')
    if (id === 'cover') return setModal({ kind: 'cover' })
    const section: Record<Exclude<RecActionId, 'specialties' | 'cover'>, EditSection> = { photo: 'Photos', 'service-areas': 'Location', awards: 'Awards', bio: 'About' }
    setModal({ kind: 'edit', section: section[id] })
  }

  const published = agent.published !== false
  const publicUrl = `${location.origin}/profile/${agent.id}`
  const copyLink = async () => {
    setMenu(false)
    try { await navigator.clipboard.writeText(publicUrl); toast('Public profile link copied') } catch { toast(publicUrl, 'info') }
  }
  const download = () => {
    setMenu(false)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([vcard(agent)], { type: 'text/vcard' }))
    a.download = `${agent.name.replace(/\s+/g, '-').toLowerCase()}.vcf`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Contact card downloaded')
  }

  const chips = moreChips ? agent.specialties : agent.specialties.slice(0, 4)
  const hidden = agent.specialties.length - 4
  const proposal = nora.status === 'SKILL_PROPOSED' && nora.proposal ? nora.proposal.message : null

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400">Profile &amp; Presence <span className="mx-1.5">›</span> <span className="text-slate-700">Overview</span></nav>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Profile Overview</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your professional profile, track your presence, and take actions to stand out online.</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button onClick={() => setModal({ kind: 'edit', section: 'Basic Info' })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:brightness-110"><Pencil size={15} /> Edit Profile</button>
          <Link to={`/profile/${agent.id}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">View Public Profile <ExternalLink size={14} /></Link>
          <div className="relative">
            <button aria-label="More actions" aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"><MoreVertical size={17} /></button>
            <Popover open={menu} onClose={() => setMenu(false)}>
              <Link className={MENU_ITEM} to={`/rank/${agent.id}`}><LayoutTemplate size={15} /> Rank page and schema</Link>
              <button className={MENU_ITEM} onClick={() => void copyLink()}><Link2 size={15} /> Copy public link</button>
              <button className={MENU_ITEM} onClick={download}><Download size={15} /> Download contact card</button>
              <button className={MENU_ITEM} onClick={() => { setMenu(false); window.print() }}><Printer size={15} /> Print</button>
            </Popover>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(300px,36%)]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row">
            <div className="relative h-[150px] w-[150px] shrink-0">
              {agent.photoUrl ? <img src={agent.photoUrl} alt={agent.name} className="h-full w-full rounded-full object-cover" /> : <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-700 text-5xl font-bold text-white">{initials(agent.name)}</div>}
              {agent.pro && <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white ring-2 ring-white">PRO</span>}
              <button onClick={() => setModal({ kind: 'edit', section: 'Photos' })} aria-label="Change photo" className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-800 shadow-md hover:bg-slate-50"><Camera size={16} /></button>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">{agent.name}{agent.pro && <CheckCircle2 size={22} className="text-blue-600" aria-label="Verified Pro member" />}</h2>
              <p className="text-slate-600">{agent.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {agent.location}</span>
                <span className="inline-flex items-center gap-1.5"><Building2 size={14} /> {agent.company}</span>
              </div>
              <p className={`mt-3 text-sm leading-relaxed text-slate-700 ${moreBio ? '' : 'line-clamp-2'}`}>{agent.about || 'Add a bio so clients know who you are.'}</p>
              {agent.about.length > 140 && <button onClick={() => setMoreBio(!moreBio)} className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">{moreBio ? 'Show less' : 'Show more'} <ChevronRight size={14} className={moreBio ? '-rotate-90' : 'rotate-90'} /></button>}
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((c) => <span key={c} className="rounded-md bg-slate-100 px-3 py-1 text-sm text-slate-700">{c}</span>)}
                {!moreChips && hidden > 0 && <button onClick={() => setMoreChips(true)} className="rounded-md bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200" aria-label={`Show ${hidden} more specialties`}>+{hidden}</button>}
              </div>
            </div>
          </div>
          <div className="relative min-h-[150px]" style={coverStyle(agent.cover)}>
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/50 to-transparent max-lg:hidden" aria-hidden />
            <div className="absolute inset-0 bg-white/60 lg:hidden" aria-hidden />
            <div className="relative flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
              <span className={`rounded-full px-4 py-1 text-sm font-semibold text-white ${published ? 'bg-emerald-500' : 'bg-slate-500'}`}>{published ? 'Published' : 'Unpublished'}</span>
              <p className="max-w-[240px] text-sm font-medium text-slate-900">{published ? 'Your profile is live and visible on Experience.com' : 'Only you can see this profile right now'}</p>
              <button onClick={() => { actions.setPublished(agent.id, !published); toast(published ? 'Profile unpublished' : 'Profile published', 'info') }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">{published ? <><EyeOff size={13} /> Unpublish</> : <>Publish now</>}</button>
              <button onClick={() => setModal({ kind: 'cover' })} className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline">Change cover</button>
            </div>
          </div>
        </div>
      </section>

      {/* KPI cards: a swipeable row on phones */}
      <ScrollFade axis="x" tone="page" className="-mb-3 -mt-1 pb-3 pt-1" innerClassName="flex gap-4 sm:min-w-0 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <KpiCards agent={agent} onActions={() => document.getElementById('recommended-actions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      </ScrollFade>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <RecommendedActions agent={agent} onRun={run} />
        <NoraAssistantCard agent={agent} onRun={run} onAsk={(q) => chat.ask(q)} proposal={proposal} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <ReviewsRatings agent={agent} />
        <RecentReviews agent={agent} />
      </div>

      {modal?.kind === 'edit' && <EditProfileModal agent={agent} initialSection={modal.section} onClose={() => setModal(null)} />}
      {modal?.kind === 'cover' && <CoverModal agent={agent} onClose={() => setModal(null)} />}
    </div>
  )
}

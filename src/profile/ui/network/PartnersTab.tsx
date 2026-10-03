import { Check, Copy, Download, Eye, FileText, Heart, MapPin, MessageSquare, Pause, Play, RefreshCw, Search, Send, Trash2, UserPlus, Users, Video } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MAX_PROMOTED, isFull, isPromoted, networkStore, partnerOf, promote, regeneratePromoCode, removePotential, removePromoted, respondToRequest, savePotential,
  type PartnerEntry, type RequestStatus,
} from '../../../presence/network'
import { useReferral } from '../../NoraContext'
import { fmtDate, fmtRating, ratingStats } from '../../selectors'
import { useStore } from '../../store'
import { Avatar, Stars } from '../bits'
import { Hero, Pill, type PillTone } from '../kit'
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, INPUT, Modal } from '../Modal'
import { Card, EmptyState } from '../PageBits'
import { useToast } from '../Toast'
import { copyText, downloadFile } from './shared'

const REQ_TONE: Record<RequestStatus, PillTone> = { pending: 'amber', accepted: 'green', declined: 'slate' }

function PartnerAvatar({ p }: { p: PartnerEntry }) {
  const state = useStore()
  const a = p.agentId ? state.agents[p.agentId] : undefined
  return <Avatar agent={a ?? { id: p.id, name: p.name, photoUrl: '' }} size={46} />
}

function HeroArt() {
  const card = (n: string, cls: string) => (
    <div className={`w-52 rounded-xl bg-white/95 p-3 shadow-lg ${cls}`}>
      <div className="flex items-center gap-2"><span className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500" /><span className="space-y-1"><span className="block h-2 w-20 rounded bg-slate-200" /><span className="block h-2 w-12 rounded bg-slate-100" /></span></div>
      <div className="mt-2 text-xs text-amber-500">{'★★★★★'} <span className="text-slate-400">({n})</span></div>
    </div>
  )
  return <div aria-hidden className="relative h-28 w-64">{card('18', 'absolute right-0 top-0')}{card('24', 'absolute bottom-0 left-0')}</div>
}

function SeeHowModal({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const me = state.agents[state.viewerId]!
  const { promoted } = networkStore.use()
  return (
    <Modal title="How promoted partners look on your public page" onClose={onClose} width="max-w-xl" footer={<button className={BTN_PRIMARY} onClick={onClose}>Done</button>}>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 bg-slate-50 p-4"><Avatar agent={me} size={48} /><div><div className="font-semibold text-slate-900">{me.name}</div><div className="text-xs text-slate-500">{me.title} · {me.company}</div></div></div>
        <div className="p-4">
          <div className="mb-3 text-sm font-semibold text-slate-900">Trusted partners</div>
          {promoted.length === 0 ? <p className="text-sm text-slate-500">Promote partners and they will appear here.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {promoted.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5"><PartnerAvatar p={p} /><div className="min-w-0"><div className="truncate text-sm font-medium text-slate-900">{p.name}</div><div className="truncate text-xs text-slate-500">{p.title}</div></div></li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Your pinned partners show on your public pro page. You can promote up to {MAX_PROMOTED}.</p>
    </Modal>
  )
}

function VideoModal({ onClose }: { onClose: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [pct, setPct] = useState(0)
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setPct((p) => (p >= 100 ? (setPlaying(false), 100) : p + 2)), 200)
    return () => clearInterval(t)
  }, [playing])
  const secs = Math.round((pct / 100) * 150)
  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`
  return (
    <Modal title="SRS demo video" onClose={onClose} width="max-w-2xl">
      <div className="overflow-hidden rounded-xl bg-slate-900">
        <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-800 to-blue-700 text-white">
          <span className="absolute left-4 top-4 text-sm font-semibold">Search Rank Score, in 2 minutes 30</span>
          <button onClick={() => { if (pct >= 100) setPct(0); setPlaying((p) => !p) }} aria-label={playing ? 'Pause' : 'Play'} className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-indigo-700 shadow-lg hover:bg-white">
            {playing ? <Pause size={26} /> : <Play size={26} className="ml-1" />}
          </button>
        </div>
        <div className="flex items-center gap-3 bg-slate-900 px-4 py-3 text-xs text-white">
          <span className="w-9 tabular-nums">{fmt(secs)}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
          <span className="w-9 text-right tabular-nums">2:30</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Demo player: play it at your next office visit to show new partners how Search Rank Score works.</p>
    </Modal>
  )
}

const SLIDES = [
  { title: 'Search Rank Platform', body: 'Find and refer top professionals online.' },
  { title: 'How your score is built', body: 'Profile, reviews, listings, connections and web analytics add up to 850 points.' },
  { title: 'Partner up', body: 'Promote trusted partners on your page, get promoted back, and share your promo code.' },
]
const slidesHtml = () => `<!doctype html><html><head><meta charset="utf-8"><title>SRS demo slides</title><style>body{font-family:system-ui,sans-serif;margin:0}section{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 12vw;background:linear-gradient(135deg,#1e1b4b,#1d4ed8);color:#fff}h1{font-size:3rem}p{font-size:1.3rem;max-width:36rem}</style></head><body>${SLIDES.map((s) => `<section><h1>${s.title}</h1><p>${s.body}</p></section>`).join('')}</body></html>`

function SlidesModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [i, setI] = useState(0)
  const s = SLIDES[i]!
  return (
    <Modal title="SRS demo slides" onClose={onClose} width="max-w-2xl" footer={<><button className={BTN_GHOST} onClick={onClose}>Close</button><button className={BTN_PRIMARY} onClick={() => { downloadFile('srs-demo-slides.html', slidesHtml()); toast('Slides downloaded') }}><Download size={15} /> Download</button></>}>
      <div className="flex aspect-video flex-col justify-center rounded-xl bg-gradient-to-br from-indigo-900 to-blue-700 p-8 text-white">
        <h3 className="text-2xl font-bold">{s.title}</h3>
        <p className="mt-2 max-w-md text-white/80">{s.body}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button className={BTN_GHOST} onClick={() => setI((n) => n - 1)} disabled={i === 0}>Previous</button>
        <span className="text-xs text-slate-500" aria-live="polite">Slide {i + 1} of {SLIDES.length}</span>
        <button className={BTN_GHOST} onClick={() => setI((n) => n + 1)} disabled={i === SLIDES.length - 1}>Next</button>
      </div>
    </Modal>
  )
}

export function PartnersTab({ onFind }: { onFind: () => void }) {
  const state = useStore()
  const net = networkStore.use()
  const toast = useToast()
  const nav = useNavigate()
  const openReferral = useReferral()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | RequestStatus>('all')
  const [modal, setModal] = useState<null | 'how' | 'video' | 'slides'>(null)
  const [removing, setRemoving] = useState<PartnerEntry | null>(null)
  const [copied, setCopied] = useState(false)
  const [limitMsg, setLimitMsg] = useState(false)
  const full = isFull(net)

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return state.order.filter((id) => id !== state.viewerId).map((id) => state.agents[id]!)
      .filter((a) => [a.name, a.title, a.company, a.city, ...a.specialties].some((v) => v.toLowerCase().includes(t))).slice(0, 6)
  }, [q, state.order, state.agents, state.viewerId])

  const doPromote = (p: PartnerEntry) => {
    const r = promote(p)
    if (r === 'full') { setLimitMsg(true); toast(`${MAX_PROMOTED}/${MAX_PROMOTED} limit reached. Remove a partner to promote someone new.`, 'error') }
    else if (r === 'already') toast(`${p.name} is already promoted`, 'info')
    else { setLimitMsg(false); toast(`${p.name} is now a promoted partner`) }
  }
  const doSave = (p: PartnerEntry) => {
    const ok = savePotential(p)
    toast(ok ? `${p.name} saved to Potential Partners` : `${p.name} is already saved or promoted`, ok ? 'success' : 'info')
  }
  const message = (p: PartnerEntry) => {
    if (!p.agentId) return toast(`${p.name} isn’t in the directory yet. Invite email drafted (demo).`, 'info')
    const t = state.threads.find((x) => x.withAgentId === p.agentId)
    if (t) nav(`/messages?t=${t.id}`)
    else openReferral(p.agentId)
  }
  const copy = async () => {
    const ok = await copyText(net.promoCode)
    setCopied(ok)
    toast(ok ? 'Promo code copied' : 'Could not copy. Select the code and copy it manually.', ok ? 'success' : 'error')
    if (ok) setTimeout(() => setCopied(false), 2000)
  }
  const requests = net.requests.filter((r) => status === 'all' || r.status === status)

  return (
    <div className="space-y-5">
      <Hero title="Partner up!" blurb="Promote your partner and get promoted back" aside={<HeroArt />} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card title="Search and add your partner">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${INPUT} pl-9`} placeholder="Search professionals by name, company, city…" aria-label="Search professionals" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {limitMsg && <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{MAX_PROMOTED}/{MAX_PROMOTED} limit reached. Remove a promoted partner to promote someone new.</p>}
            {q.trim() && results.length === 0 && <p className="mt-3 text-sm text-slate-500">No professionals match “{q}”.</p>}
            {results.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {results.map((a) => {
                  const s = ratingStats(a.reviews)
                  const p = partnerOf(a)
                  const promoted = isPromoted(net, a.id)
                  const saved = net.potential.some((x) => x.id === a.id)
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                      <Avatar agent={a} size={42} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{a.name}</div>
                        <div className="truncate text-xs text-slate-500">{a.title} · {a.city}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Stars rating={s.avg} size={11} /> {fmtRating(s.avg)} ({s.count})</div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button className={`${BTN_PRIMARY} !px-3 !py-1.5 !text-xs`} onClick={() => doPromote(p)} disabled={promoted}>{promoted ? <><Check size={13} /> Promoted</> : <><UserPlus size={13} /> Promote</>}</button>
                        <button className={`${BTN_GHOST} !px-3 !py-1.5 !text-xs`} onClick={() => doSave(p)} disabled={saved || promoted}><Heart size={13} /> {saved ? 'Saved' : 'Save'}</button>
                        <Link to={`/profile/${a.id}`} className={`${BTN_GHOST} !px-3 !py-1.5 !text-xs`}>View profile</Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="Promoted Partners" right={<span className="text-sm text-slate-500">{net.promoted.length}/{MAX_PROMOTED}</span>}>
            <p className="-mt-1 mb-4 text-sm text-slate-500">Profiles promoted here appear on your Pro Page. You can promote up to {MAX_PROMOTED} partners. <button className="font-medium text-blue-600 hover:underline" onClick={() => setModal('how')}>See how it looks</button></p>
            {net.promoted.length === 0 ? <EmptyState>You haven’t promoted anyone yet. Search for a partner above.</EmptyState> : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {net.promoted.map((p) => (
                  <li key={p.id} className="flex flex-col rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-center gap-3">
                      <PartnerAvatar p={p} />
                      <div className="min-w-0">
                        {p.agentId ? <Link to={`/profile/${p.agentId}`} className="block truncate text-sm font-semibold text-slate-900 hover:text-blue-600">{p.name}</Link> : <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>}
                        <div className="truncate text-xs text-slate-500">{p.title}</div>
                        <div className="flex items-center gap-1 text-xs text-slate-400"><MapPin size={11} /> {p.city}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button className={`${BTN_GHOST} !px-2.5 !py-1 !text-xs`} onClick={() => setRemoving(p)}><Trash2 size={12} /> Remove</button>
                      <button className={`${BTN_GHOST} !px-2.5 !py-1 !text-xs`} onClick={() => message(p)}><MessageSquare size={12} /> Message</button>
                      <button className={`${BTN_OUTLINE} !px-2.5 !py-1 !text-xs`} onClick={() => (p.agentId ? openReferral(p.agentId) : toast(`${p.name} isn’t in the directory yet`, 'info'))}><Send size={12} /> Request referral</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {full && <p className="mt-3 text-xs font-medium text-amber-700">{MAX_PROMOTED}/{MAX_PROMOTED} limit reached</p>}
          </Card>

          <Card title="Potential Partners">
            <p className="-mt-1 mb-4 text-sm text-slate-500">Track future collaborators by adding them to your Potential Partners group.</p>
            {net.potential.length === 0 ? <EmptyState>You haven’t added anyone to this group. Search for a partner or save them from the directory.</EmptyState> : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {net.potential.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                    <PartnerAvatar p={p} />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{p.name}</div><div className="truncate text-xs text-slate-500">{p.title} · {p.city}</div></div>
                    <button className={`${BTN_PRIMARY} !px-3 !py-1.5 !text-xs`} onClick={() => doPromote(p)}><UserPlus size={13} /> Promote</button>
                    <button className={`${BTN_GHOST} !px-3 !py-1.5 !text-xs`} onClick={() => { removePotential(p.id); toast(`${p.name} removed from Potential Partners`) }} aria-label={`Remove ${p.name}`}><Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
            <button className="mt-3 text-sm font-medium text-blue-600 hover:underline" onClick={onFind}>Browse all professionals</button>
          </Card>

          <div id="promotion-requests" className="scroll-mt-4"><Card title="Promotion Requests Received" right={
            <select className={`${INPUT} !w-auto`} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as 'all' | RequestStatus)}><option value="all">Status: All</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="declined">Declined</option></select>
          }>
            <p className="-mt-1 mb-4 text-sm text-slate-500">These professionals have asked you to promote them on your page.</p>
            {requests.length === 0 ? <EmptyState>No promotion requests{status === 'all' ? '' : ` with status “${status}”`}.</EmptyState> : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
                    <Avatar agent={{ id: r.id, name: r.name, photoUrl: '' }} size={42} />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-900">{r.name}</div><div className="truncate text-xs text-slate-500">{r.title} · {r.city} · {fmtDate(r.at)}</div></div>
                    <Pill tone={REQ_TONE[r.status]}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</Pill>
                    {r.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button className={`${BTN_PRIMARY} !px-3 !py-1.5 !text-xs`} onClick={() => {
                          const res = respondToRequest(r.id, true)
                          if (res === 'full') { setLimitMsg(true); toast(`${MAX_PROMOTED}/${MAX_PROMOTED} limit reached. Remove a partner first, then accept.`, 'error') } else toast(`${r.name} accepted and promoted`)
                        }}>Accept</button>
                        <button className={`${BTN_GHOST} !px-3 !py-1.5 !text-xs`} onClick={() => { respondToRequest(r.id, false); toast(`Request from ${r.name} declined`, 'info') }}>Decline</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card></div>
        </div>

        <aside className="min-w-0 space-y-5">
          <Card title="Your personal partner promo code">
            <p className="-mt-1 mb-3 text-sm text-slate-500">Give your partners a discount on Experience.com PRO features.</p>
            <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-center">
              <div className="break-all font-mono text-lg font-bold tracking-wide text-blue-700" aria-label="Promo code">{net.promoCode}</div>
              <div className="mt-3 flex justify-center gap-2">
                <button className={`${BTN_PRIMARY} !px-3 !py-1.5 !text-xs`} onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}</button>
                <button className={`${BTN_GHOST} !px-3 !py-1.5 !text-xs`} onClick={() => { const c = regeneratePromoCode(); setCopied(false); toast(`New promo code: ${c}`) }}><RefreshCw size={13} /> Regenerate</button>
              </div>
            </div>
          </Card>
          <Card title="Office visit resources">
            <p className="-mt-1 mb-3 text-sm text-slate-500">Use these resources at your next office visit to win new partners.</p>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-900">SRS Demo Video</div>
                <button onClick={() => setModal('video')} className="mt-2 flex aspect-video w-full items-center justify-center rounded-lg bg-gradient-to-br from-indigo-900 to-blue-700 text-white" aria-label="Play SRS demo video"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-indigo-700"><Play size={20} className="ml-0.5" /></span></button>
                <button className={`${BTN_GHOST} mt-2 w-full !py-1.5 !text-xs`} onClick={() => setModal('video')}><Video size={13} /> Watch video</button>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-900">SRS Demo Slides</div>
                <p className="mt-0.5 text-xs text-slate-500">Share your expertise on the Experience.com platform.</p>
                <div className="mt-2 flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600"><FileText size={18} className="mr-2" /> Search Rank Platform</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className={`${BTN_GHOST} !px-2 !py-1.5 !text-xs`} onClick={() => setModal('slides')}><Eye size={13} /> Preview slides</button>
                  <button className={`${BTN_PRIMARY} !px-2 !py-1.5 !text-xs`} onClick={() => { downloadFile('srs-demo-slides.html', slidesHtml()); toast('Slides downloaded') }}><Download size={13} /> Download</button>
                </div>
              </div>
            </div>
          </Card>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-card"><Users size={14} className="mr-1 inline" /> Pinned partners are shown on your public pro page.</div>
        </aside>
      </div>

      {modal === 'how' && <SeeHowModal onClose={() => setModal(null)} />}
      {modal === 'video' && <VideoModal onClose={() => setModal(null)} />}
      {modal === 'slides' && <SlidesModal onClose={() => setModal(null)} />}
      {removing && (
        <Modal title="Remove promoted partner?" onClose={() => setRemoving(null)} footer={<><button className={BTN_GHOST} onClick={() => setRemoving(null)}>Cancel</button><button className={BTN_PRIMARY} onClick={() => { removePromoted(removing.id); toast(`${removing.name} removed from Promoted Partners`); setRemoving(null) }}>Remove</button></>}>
          <p className="text-sm text-slate-600">{removing.name} will no longer appear on your public pro page.</p>
        </Modal>
      )}
    </div>
  )
}


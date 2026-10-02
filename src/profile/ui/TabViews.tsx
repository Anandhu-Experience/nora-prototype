import { Award, AtSign, Briefcase, Calendar, Globe, Link2, Loader2, Mail, Phone, Send, Sparkles, Star, Trophy, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { fmtDate, ratingStats } from '../selectors'
import { draftReviewReply, type ReplyDraft } from '../aiDrafts'
import { actions } from '../store'
import type { ActivityType, Agent, Service } from '../types'
import { Stars } from './bits'
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, INPUT } from './Modal'
import { ServiceArt } from './ServiceArt'
import { ScrollFade } from './ScrollFade'
import { CARD, newestFirst } from './Sections'
import { useToast } from './Toast'

type Sort = 'newest' | 'highest' | 'lowest'

export function ReviewsTab({ agent, isOwner, stars, onStars, onWrite }: { agent: Agent; isOwner: boolean; stars: number; onStars: (n: number) => void; onWrite: () => void }) {
  const toast = useToast()
  const [sort, setSort] = useState<Sort>('newest')
  const [replying, setReplying] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [drafted, setDrafted] = useState<ReplyDraft | null>(null)
  const s = ratingStats(agent.reviews)

  const filtered = newestFirst(agent.reviews)
    .filter((r) => !stars || r.rating === stars)
    .sort((a, b) => (sort === 'highest' ? b.rating - a.rating : sort === 'lowest' ? a.rating - b.rating : 0))

  const send = (id: string) => {
    if (!reply.trim()) return
    actions.replyToReview(agent.id, id, reply.trim())
    setReplying(null)
    setReply('')
    setDrafted(null)
    toast('Reply posted')
  }

  // The draft only fills the box; nothing is posted until the owner clicks Post.
  const draftWithAi = async (r: (typeof filtered)[number]) => {
    setDrafting(true)
    setDrafted(null)
    const d = await draftReviewReply(agent, r)
    setReply(d.text)
    setDrafted(d)
    setDrafting(false)
  }

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <h2 className="text-[17px] font-semibold text-slate-900">Reviews ({s.count})</h2>
        <button className={BTN_PRIMARY} onClick={onWrite}><Star size={15} /> Write a review</button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <ScrollFade axis="x" wrapperClassName="flex-1" innerClassName="flex items-center gap-2 py-0.5" innerProps={{ role: 'group', 'aria-label': 'Filter by rating' }}>
        {[0, 5, 4, 3, 2, 1].map((n) => (
          <button key={n} onClick={() => onStars(n)} aria-pressed={stars === n} className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${stars === n ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {n === 0 ? 'All' : `${n} ★`}
          </button>
        ))}
        </ScrollFade>
        <select aria-label="Sort reviews" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
          <option value="newest">Newest</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option>
        </select>
      </div>
      <ul className="mt-4 divide-y divide-slate-100">
        {filtered.length === 0 && <li className="py-6 text-center text-sm text-slate-500">No reviews match this filter.</li>}
        {filtered.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{r.author.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div>
                <div className="text-sm font-semibold text-slate-900">{r.author}</div>
                <div className="flex items-center gap-2 text-xs text-slate-400"><Stars rating={r.rating} size={12} /> {fmtDate(r.date)}</div>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-700">{r.text}</p>
            {r.reply && <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><span className="font-semibold text-slate-800">Reply from {agent.name}: </span>{r.reply}</div>}
            {isOwner && !r.reply && (
              replying === r.id ? (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    <input className={`${INPUT} min-w-[200px] flex-1`} autoFocus placeholder="Write a public reply" value={reply} onChange={(e) => { setReply(e.target.value); setDrafted(null) }} onKeyDown={(e) => e.key === 'Enter' && send(r.id)} />
                    <button className={BTN_GHOST} onClick={() => void draftWithAi(r)} disabled={drafting} aria-label="Draft reply with AI">
                      {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-purple-500" />} {drafting ? 'Drafting…' : 'Draft with AI'}
                    </button>
                    <button className={BTN_PRIMARY} onClick={() => send(r.id)} disabled={!reply.trim() || drafting}>Post</button>
                    <button className={BTN_GHOST} onClick={() => { setReplying(null); setDrafted(null) }}>Cancel</button>
                  </div>
                  {drafted && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      {drafted.source === 'ai'
                        ? `Drafted by ${drafted.model ?? 'AI'}. Read and edit it before posting.`
                        : `Template draft${drafted.note ? ` (${drafted.note.replace(/\.$/, '')})` : ''}. Read and edit it before posting.`}
                    </p>
                  )}
                </div>
              ) : <button onClick={() => { setReplying(r.id); setReply(''); setDrafted(null) }} className="mt-2 text-sm font-medium text-blue-600 hover:underline">Reply</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ServicesTab({ agent, onOpen, onRequest }: { agent: Agent; onOpen: (s: Service) => void; onRequest: (s: Service) => void }) {
  return (
    <section className={CARD}>
      <h2 className="border-b border-slate-100 pb-3 text-[17px] font-semibold text-slate-900">Services</h2>
      {agent.services.length === 0 && <p className="mt-3 text-sm text-slate-500">No services listed.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {agent.services.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-xl border border-slate-200">
            <ServiceArt icon={s.icon} className="h-24" />
            <div className="p-4">
              <h3 className="font-semibold text-slate-900">{s.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{s.blurb}</p>
              <div className="mt-3 flex gap-2">
                <button className={`${BTN_GHOST} !px-3 !py-1.5 !text-xs`} onClick={() => onOpen(s)}>Details</button>
                <button className={`${BTN_OUTLINE} !px-3 !py-1.5 !text-xs`} onClick={() => onRequest(s)}>Request</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function AwardsTab({ agent }: { agent: Agent }) {
  return (
    <section className={CARD}>
      <h2 className="border-b border-slate-100 pb-3 text-[17px] font-semibold text-slate-900">Awards</h2>
      {agent.awards.length === 0 ? <p className="mt-3 text-sm text-slate-500">No awards yet.</p> : (
        <ul className="mt-3 divide-y divide-slate-100">
          {agent.awards.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Award size={20} /></span>
              <div><div className="font-medium text-slate-900">{a.title}</div><div className="text-sm text-slate-500">{a.issuer} · {a.year}</div></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const ACT_ICON: Record<ActivityType, typeof Star> = { review: Star, referral: UserPlus, profile: Calendar, award: Trophy, loan: Briefcase }

export function ActivityTab({ agent }: { agent: Agent }) {
  const items = [...agent.activity].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <section className={CARD}>
      <h2 className="border-b border-slate-100 pb-3 text-[17px] font-semibold text-slate-900">Activity</h2>
      <ol className="mt-3 space-y-4 border-l border-slate-200 pl-5">
        {items.map((a) => {
          const Icon = ACT_ICON[a.type]
          return (
            <li key={a.id} className="relative">
              <span className="absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-4 ring-white"><Icon size={14} /></span>
              <div className="text-sm text-slate-800">{a.text}</div>
              <div className="text-xs text-slate-400">{fmtDate(a.at)}</div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function ContactTab({ agent, isOwner }: { agent: Agent; isOwner: boolean }) {
  const toast = useToast()
  const [msg, setMsg] = useState('')
  const rows = [
    { icon: Phone, label: 'Phone', value: agent.phone, href: agent.phone && `tel:${agent.phone.replace(/\s/g, '')}` },
    { icon: Mail, label: 'Email', value: agent.email, href: agent.email && `mailto:${agent.email}` },
    { icon: Globe, label: 'Website', value: agent.social.website, href: agent.social.website },
    { icon: Link2, label: 'LinkedIn', value: agent.social.linkedin, href: agent.social.linkedin },
    { icon: AtSign, label: 'X / Twitter', value: agent.social.twitter, href: agent.social.twitter },
    { icon: Users, label: 'Facebook', value: agent.social.facebook, href: agent.social.facebook },
  ].filter((r) => r.value)

  const send = () => {
    if (!msg.trim()) return
    actions.sendReferral(agent.id, msg.trim())
    setMsg('')
    toast(`Message sent to ${agent.name}`)
  }

  return (
    <section className={CARD}>
      <h2 className="border-b border-slate-100 pb-3 text-[17px] font-semibold text-slate-900">Contact</h2>
      {rows.length === 0 && <p className="mt-3 text-sm text-slate-500">No contact details listed.</p>}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.label}>
            <a href={r.href || undefined} target={r.href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
              <r.icon size={18} className="text-blue-600" />
              <span className="min-w-0"><span className="block text-xs text-slate-500">{r.label}</span><span className="block truncate text-sm text-slate-900">{r.value}</span></span>
            </a>
          </li>
        ))}
      </ul>
      {!isOwner && (
        <div className="mt-5">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="contact-msg">Send a message</label>
          <textarea id="contact-msg" className={`${INPUT} h-24 resize-none`} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={`Write to ${agent.name}…`} />
          <button className={`${BTN_PRIMARY} mt-2`} onClick={send} disabled={!msg.trim()}><Send size={14} /> Send message</button>
        </div>
      )}
    </section>
  )
}

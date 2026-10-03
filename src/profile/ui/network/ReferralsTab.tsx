import { Archive, ArrowDown, ArrowUp, CheckCircle2, MoreVertical, Search, Send, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  networkStore, referralCounts, referralRows, setReferralStatus, sortRows,
  type RefSort, type ReferralKind, type ReferralRow,
} from '../../../presence/network'
import { useReferral } from '../../NoraContext'
import { fmtDate, ratingStats } from '../../selectors'
import { useStore } from '../../store'
import { Avatar, useDismiss } from '../bits'
import { Hero, Pill } from '../kit'
import { BTN_GHOST, INPUT, Modal } from '../Modal'
import { EmptyState } from '../PageBits'
import { ScrollFade } from '../ScrollFade'
import { useToast } from '../Toast'

const KINDS: { id: ReferralKind; label: string }[] = [{ id: 'received', label: 'Referrals Received' }, { id: 'requested', label: 'Referrals Requested' }, { id: 'given', label: 'Referrals Given' }]
type StatusFilter = 'active' | 'open' | 'converted' | 'archived'

/** Pick the professional to refer to, then hand over to the existing referral flow. */
function PickerModal({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const openReferral = useReferral()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return state.order.filter((id) => id !== state.viewerId).map((id) => state.agents[id]!)
      .filter((a) => !t || [a.name, a.title, a.company, a.city].some((v) => v.toLowerCase().includes(t)))
  }, [q, state])
  return (
    <Modal title="Choose a professional" onClose={onClose} footer={<button className={BTN_GHOST} onClick={onClose}>Cancel</button>}>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${INPUT} pl-9`} placeholder="Search by name, company or city" aria-label="Search professionals" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {list.length === 0 && <li className="p-4 text-sm text-slate-500">No professionals match.</li>}
        {list.map((a) => (
          <li key={a.id}>
            <button className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50" onClick={() => { onClose(); openReferral(a.id) }}>
              <Avatar agent={a} size={38} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{a.name}</span><span className="block truncate text-xs text-slate-500">{a.title} · {a.city} · {ratingStats(a.reviews).avg.toFixed(2)} rating</span></span>
              <span className="text-xs font-medium text-blue-600">Select</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function RowMenu({ row, at, onClose, onFollowUp }: { row: ReferralRow; at: { top: number; right: number }; onClose: () => void; onFollowUp: (r: ReferralRow) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const toast = useToast()
  useDismiss(ref, onClose)
  useEffect(() => {
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => { window.removeEventListener('scroll', onClose, true); window.removeEventListener('resize', onClose) }
  }, [onClose])
  const item = 'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'
  return (
    <div ref={ref} role="menu" style={{ top: at.top, right: at.right }} className="fixed z-40 w-52 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
      <button role="menuitem" className={item} onClick={() => { onClose(); onFollowUp(row) }}><Send size={14} /> Follow up</button>
      {row.status !== 'converted' && <button role="menuitem" className={item} onClick={() => { setReferralStatus([row.id], 'converted'); toast(`${row.name} marked as converted`); onClose() }}><CheckCircle2 size={14} /> Mark as converted</button>}
      {row.status !== 'archived' && <button role="menuitem" className={item} onClick={() => { setReferralStatus([row.id], 'archived'); toast(`${row.name} archived`); onClose() }}><Archive size={14} /> Archive</button>}
      {row.status === 'archived' && <button role="menuitem" className={item} onClick={() => { setReferralStatus([row.id], 'open'); toast(`${row.name} restored`); onClose() }}><Archive size={14} /> Restore</button>}
    </div>
  )
}

export function ReferralsTab({ kind, onKind, onFollowUp }: { kind: ReferralKind; onKind: (k: ReferralKind) => void; onFollowUp: (r: ReferralRow) => void }) {
  const state = useStore()
  const net = networkStore.use()
  const toast = useToast()
  const [picker, setPicker] = useState(false)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [sort, setSort] = useState<{ key: RefSort; dir: 1 | -1 }>({ key: 'at', dir: -1 })
  const [sel, setSel] = useState<string[]>([])
  const [menu, setMenu] = useState<{ row: ReferralRow; top: number; right: number } | null>(null)

  const all = useMemo(() => referralRows(net, state.threads, state.agents), [net, state.threads, state.agents])
  const counts = referralCounts(all)
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    const f = all.filter((r) => r.kind === kind)
      .filter((r) => (status === 'active' ? r.status !== 'archived' : r.status === status))
      .filter((r) => !t || [r.name, r.email, r.source, r.referredBy].some((v) => v.toLowerCase().includes(t)))
    return sortRows(f, sort.key, sort.dir)
  }, [all, kind, status, q, sort])
  const visibleSel = sel.filter((id) => rows.some((r) => r.id === id))
  const allSel = rows.length > 0 && visibleSel.length === rows.length

  const th = (key: RefSort, label: string) => (
    <th scope="col" className="px-3 py-2.5 text-left text-xs font-medium text-slate-500">
      <button className="inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-800" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} aria-label={`Sort by ${label}`}>
        {label}{sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )
  const plain = (label: string) => <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-slate-500">{label}</th>
  const statusPill = (r: ReferralRow) => <Pill tone={r.status === 'converted' ? 'green' : r.status === 'archived' ? 'slate' : 'blue'}>{r.status[0]!.toUpperCase() + r.status.slice(1)}</Pill>

  return (
    <div className="space-y-5">
      <Hero
        title="Referral Revolution" blurb="Effortlessly ask for and receive referrals. Discover the easiest route to quality leads and lasting relationships."
        aside={<button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow hover:bg-slate-50" onClick={() => setPicker(true)}><UserPlus size={16} /> Request a Referral</button>}
      >
        <button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow hover:bg-slate-50 md:hidden" onClick={() => setPicker(true)}><UserPlus size={16} /> Request a Referral</button>
      </Hero>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
        <ScrollFade axis="x" innerClassName="flex gap-2" innerProps={{ role: 'tablist', 'aria-label': 'Referral type' }}>
          {KINDS.map((k) => (
            <button key={k.id} role="tab" aria-selected={kind === k.id} onClick={() => { onKind(k.id); setSel([]) }} className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium ${kind === k.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
              {k.label}<span className={`rounded-full px-1.5 text-xs ${kind === k.id ? 'bg-white/25' : 'bg-slate-100 text-slate-600'}`}>{counts[k.id]}</span>
            </button>
          ))}
        </ScrollFade>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[17px] font-semibold text-slate-900">{KINDS.find((k) => k.id === kind)!.label}</h2>
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${INPUT} pl-9`} placeholder="Search referrals" aria-label="Search referrals" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={`${INPUT} !w-auto`} aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="active">Active</option><option value="open">Open</option><option value="converted">Converted</option><option value="archived">Archived</option>
          </select>
        </div>
        {visibleSel.length > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <span>{visibleSel.length} selected</span>
            <button className="inline-flex items-center gap-1 font-semibold hover:underline" onClick={() => { setReferralStatus(visibleSel, 'archived'); toast(`${visibleSel.length} referral${visibleSel.length === 1 ? '' : 's'} archived`); setSel([]) }}><Archive size={14} /> Archive</button>
            <button className="ml-auto text-xs hover:underline" onClick={() => setSel([])}>Clear</button>
          </div>
        )}
        {rows.length === 0 ? <EmptyState>{q || status !== 'active' ? 'No referrals match these filters.' : `No referrals ${kind} yet.`}</EmptyState> : (
          <ScrollFade axis="x" innerClassName="min-w-max">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Select all" checked={allSel} onChange={() => setSel(allSel ? [] : rows.map((r) => r.id))} className="h-4 w-4 rounded border-slate-300" /></th>
                  {th('name', 'Name')}{plain('Email')}{plain('Source')}{th('at', 'Referred on')}{plain('Referred by')}{th('lastFollowUp', 'Last follow-up')}{th('attempts', 'Follow-up attempts')}{plain('Status')}{plain('Action')}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className={visibleSel.includes(r.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${r.name}`} checked={visibleSel.includes(r.id)} onChange={() => setSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))} className="h-4 w-4 rounded border-slate-300" /></td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">{r.name}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.email || '–'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.source}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{fmtDate(r.at)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.referredBy}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{r.lastFollowUp ? fmtDate(r.lastFollowUp) : '–'}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{r.attempts}</td>
                    <td className="px-3 py-3">{statusPill(r)}</td>
                    <td className="px-3 py-3">
                      <button aria-label={`Actions for ${r.name}`} aria-haspopup="menu" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setMenu({ row: r, top: b.bottom + 4, right: Math.max(8, window.innerWidth - b.right) }) }}><MoreVertical size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollFade>
        )}
      </section>

      {menu && <RowMenu row={menu.row} at={menu} onClose={() => setMenu(null)} onFollowUp={onFollowUp} />}
      {picker && <PickerModal onClose={() => setPicker(false)} />}
    </div>
  )
}

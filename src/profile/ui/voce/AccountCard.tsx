import { BarChart3, Check, Zap } from 'lucide-react'
import { useState } from 'react'
import { DRAFT_COST, PLANS, creditsAvailable, planOf, publishedCount, setPlan, voceStore, contentAnalytics, type PlanId } from '../../../presence/voce'
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, Modal } from '../Modal'
import { Pill } from '../kit'
import { useToast } from '../Toast'

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const s = voceStore.use()
  const toast = useToast()
  const [pick, setPick] = useState<PlanId>(s.plan)
  return (
    <Modal title="Choose a VOCE plan" onClose={onClose} width="max-w-2xl" footer={<><button onClick={onClose} className={BTN_GHOST}>Cancel</button><button disabled={pick === s.plan} onClick={() => { setPlan(pick); toast(`Plan changed to ${pick}`); onClose() }} className={BTN_PRIMARY}>Switch to {pick}</button></>}>
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Plans">
        {PLANS.map((p) => (
          <button key={p.id} role="radio" aria-checked={pick === p.id} onClick={() => setPick(p.id)} className={`rounded-xl border p-4 text-left ${pick === p.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-slate-900">{p.id}</span>{pick === p.id && <Check size={16} className="text-blue-600" />}</div>
            <div className="mt-1 text-xs font-medium text-blue-700">{p.price}</div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{p.credits}<span className="text-xs font-normal text-slate-500"> credits / month</span></div>
            <p className="mt-2 text-xs text-slate-500">{p.blurb}</p>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">Demo: plan changes are saved locally and no payment is taken.</p>
    </Modal>
  )
}

export function AccountCard() {
  const s = voceStore.use()
  const [open, setOpen] = useState(false)
  const p = planOf(s)
  const left = creditsAvailable(s)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3"><h2 className="flex items-center gap-2 text-[17px] font-semibold text-slate-900"><span className="rounded bg-purple-600 px-1.5 py-0.5 text-xs font-extrabold tracking-wide text-white">VOCE</span> Your account</h2></div>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</dt><dd><Pill tone="purple">{s.plan}</Pill></dd></div>
        <div className="flex items-center justify-between"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credits allocated</dt><dd className="font-semibold text-slate-900">{p.credits} / month</dd></div>
        <div className="flex items-center justify-between"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credits available</dt><dd className="font-semibold text-slate-900">{left}</dd></div>
      </dl>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Credits left" aria-valuenow={left} aria-valuemin={0} aria-valuemax={p.credits}><div className="h-full rounded-full bg-purple-500 transition-[width] duration-500" style={{ width: `${(left / p.credits) * 100}%` }} /></div>
      <p className="mt-2 text-xs text-slate-500">Each AI draft costs {DRAFT_COST} credits. Publishing is free.</p>
      <button onClick={() => setOpen(true)} className={`${BTN_OUTLINE} mt-4`}><Zap size={15} /> Upgrade</button>
      {open && <UpgradeModal onClose={() => setOpen(false)} />}
    </section>
  )
}

export function AnalyticsCard() {
  const s = voceStore.use()
  const a = contentAnalytics(s)
  const cells: [string, string | number][] = [['Views', a.views], ['Engaged reads', a.engaged], ['Top source', a.topSource], ['Shares', a.shares]]
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="border-b border-slate-100 pb-3"><h2 className="flex items-center gap-2 text-[17px] font-semibold text-slate-900"><BarChart3 size={19} className="text-slate-500" /> Content Analytics</h2><p className="mt-0.5 text-xs text-slate-500">How your published articles performed in the last 30 days (demo data).</p></div>
      <div className="mt-4 grid flex-1 auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map(([l, v]) => <div key={l} className="flex flex-col justify-center rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{l}</div><div className="mt-1 text-xl font-semibold text-slate-900">{v}</div></div>)}
      </div>
      {publishedCount(s) === 0 && <p className="mt-3 text-xs text-slate-500">Nothing yet. Publish an article to start collecting numbers.</p>}
    </section>
  )
}

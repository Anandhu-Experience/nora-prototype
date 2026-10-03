import { Building2, CheckCircle2, Lock, MapPin, Pencil, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { FIELD_LABEL, LOCK_MESSAGE, applyFix, dataIssues, knownCities, listingsStore, proposeFix, saveInfo, setLocked, validateInfo, type BusinessInfo, type FixProposal, type InfoField } from '../../../presence/listings'
import { Field } from '../bits'
import { Pill } from '../kit'
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, INPUT, Modal } from '../Modal'
import { Card } from '../PageBits'
import { useToast } from '../Toast'

const ROWS: InfoField[] = ['name', 'address', 'phone', 'category', 'website', 'hours', 'serviceArea', 'placeId']

export function EditInfoModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [v, setV] = useState<BusinessInfo>(() => ({ ...listingsStore.get().info }))
  const [errs, setErrs] = useState<Partial<Record<InfoField, string>>>({})
  const save = () => {
    const e = validateInfo(v, knownCities())
    // a bad place ID is a data issue to fix with AI, not a blocker for saving the rest
    const blocking = { ...e }
    delete blocking.placeId
    setErrs(e)
    if (Object.keys(blocking).length) return
    saveInfo(v)
    toast('Business info saved')
    onClose()
  }
  const set = (f: InfoField, val: string) => { setV((p) => ({ ...p, [f]: val })); setErrs((p) => ({ ...p, [f]: undefined })) }
  return (
    <Modal title="Edit business info" onClose={onClose} width="max-w-xl" footer={<><button className={BTN_GHOST} onClick={onClose}>Cancel</button><button className={BTN_PRIMARY} onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {ROWS.map((f) => (
          <div key={f} className={f === 'name' || f === 'address' || f === 'hours' ? 'sm:col-span-2' : ''}>
            <Field label={`${FIELD_LABEL[f]}${['name', 'address', 'phone', 'category', 'serviceArea'].includes(f) ? ' *' : ''}`} error={errs[f]} hint={f === 'serviceArea' ? 'A city such as Birmingham, or "City, Region"' : f === 'placeId' ? 'Starts with ChIJ. Leave to fix with AI.' : undefined}>
              <input className={INPUT} value={v[f]} onChange={(e) => set(f, e.target.value)} />
            </Field>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function FixModal({ proposal, onClose }: { proposal: FixProposal; onClose: () => void }) {
  const toast = useToast()
  const info = listingsStore.get().info
  return (
    <Modal title={`Fix ${FIELD_LABEL[proposal.field].toLowerCase()} with AI`} onClose={onClose} footer={<><button className={BTN_GHOST} onClick={onClose}>Cancel</button><button className={BTN_PRIMARY} onClick={() => { applyFix(proposal); toast(`${FIELD_LABEL[proposal.field]} updated`); onClose() }}>Apply</button></>}>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-purple-700"><Sparkles size={13} /> NORA proposal. Nothing changes until you apply it.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3"><div className="text-[11px] font-medium uppercase text-slate-500">Current</div><div className="mt-1 break-words text-sm text-rose-700">{info[proposal.field] || 'Empty'}</div></div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="text-[11px] font-medium uppercase text-emerald-700">Proposed</div><div className="mt-1 break-words text-sm font-medium text-slate-900">{proposal.value}</div></div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{proposal.reason}</p>
    </Modal>
  )
}

export function BusinessInfoTab({ onEdit }: { onEdit: () => void }) {
  const s = listingsStore.use()
  const [fix, setFix] = useState<FixProposal | null>(null)
  const issues = dataIssues(s.info, knownCities())
  return (
    <div className="space-y-5">
      {s.locked && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><Lock size={18} className="mt-0.5 shrink-0" />{LOCK_MESSAGE}</div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card icon={Building2} title="Business listing" right={<button className={BTN_OUTLINE} onClick={onEdit}><Pencil size={14} /> Edit</button>}>
          <dl className="divide-y divide-slate-100">
            {ROWS.map((f) => {
              const bad = issues.some((i) => i.id === f)
              return (
                <div key={f} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 py-2.5 text-sm sm:grid-cols-[140px_minmax(0,1fr)]">
                  <dt className="text-slate-500">{FIELD_LABEL[f]}</dt>
                  <dd className={`break-words ${bad ? 'text-rose-700' : 'text-slate-900'}`}>{s.info[f] || <span className="text-slate-400">Not set</span>}{bad && <Pill tone="red">Needs fixing</Pill>}</dd>
                </div>
              )
            })}
          </dl>
        </Card>
        <div className="space-y-5">
          <Card icon={MapPin} title="Take action">
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={17} /> No data issues. Your details are consistent everywhere.</p>
            ) : (
              <ul className="space-y-3">
                {issues.map((i) => (
                  <li key={i.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-sm text-slate-800">{i.message}</p>
                    <button className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:underline" onClick={() => setFix(proposeFix(i.id, s.info))}><Sparkles size={13} /> Fix with AI · +{i.points} pts</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Publishing control">
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-700">
              <span>Manager lock (demo)<span className="block text-xs text-slate-500">Simulates a manager disabling "Push to publish".</span></span>
              <input type="checkbox" role="switch" checked={s.locked} onChange={(e) => setLocked(e.target.checked)} className="h-5 w-9 shrink-0 cursor-pointer accent-blue-600" />
            </label>
          </Card>
        </div>
      </div>
      {fix && <FixModal proposal={fix} onClose={() => setFix(null)} />}
    </div>
  )
}

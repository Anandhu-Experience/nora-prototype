import { Camera, Loader2, Lock, Plus, ShieldCheck, Sparkles, Trash2, Undo2, Unlock, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { draftServiceCopy, type ServiceCopyDraft } from '../aiDrafts'
import { AMENITIES, DAY_NAMES, LOCK_LABEL, TIME_ZONES, agentAddresses, agentHours, validateHours } from '../details'
import { actions } from '../store'
import { COVERS, PRESET_COVERS, coverStyle } from '../selectors'
import type { Address, Agent, Award, LockField, Service } from '../types'
import { Avatar, Field, readImage } from './bits'
import { BTN_GHOST, BTN_PRIMARY, INPUT, Modal } from './Modal'
import { useToast } from './Toast'

export const SECTIONS = ['Basic Info', 'About', 'Services', 'Awards', 'Location', 'Hours', 'Photos', 'Social Links'] as const
export type EditSection = (typeof SECTIONS)[number]
type Section = EditSection
type Errors = Partial<Record<string, string>>

const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(d: Agent): Errors {
  const e: Errors = {}
  if (!d.name.trim()) e.name = 'Name is required.'
  if (!d.title.trim()) e.title = 'Title is required.'
  if (!/^\d{4,10}$/.test(d.nmls)) e.nmls = 'NMLS must be 4 to 10 digits.'
  if (!Number.isInteger(d.yearsExperience) || d.yearsExperience < 0 || d.yearsExperience > 60) e.years = 'Enter 0 to 60.'
  if (!Number.isInteger(d.completedLoans) || d.completedLoans < 0) e.loans = 'Enter a whole number.'
  if (d.about.length > 600) e.about = 'Keep it under 600 characters.'
  if (!d.city.trim()) e.city = 'City is required.'
  if (d.email && !EMAIL_RE.test(d.email)) e.email = 'Enter a valid email.'
  for (const k of ['linkedin', 'twitter', 'facebook', 'website'] as const) {
    if (d.social[k] && !URL_RE.test(d.social[k])) e[k] = 'Enter a valid URL.'
  }
  if (d.services.some((s) => !s.name.trim())) e.services = 'Every service needs a name.'
  if (agentAddresses(d).some((a) => !a.city.trim() || !a.label.trim())) e.addresses = 'Every address needs a label and a city.'
  if (Object.keys(validateHours(agentHours(d))).length) e.hours = 'Fix the highlighted opening hours.'
  if (d.awards.some((a) => !a.title.trim())) e.awards = 'Every award needs a title.'
  if (d.awards.some((a) => !Number.isInteger(a.year) || a.year < 1950 || a.year > new Date().getFullYear() + 1)) e.awards = 'Enter a valid year for every award.'
  return e
}

/** Which section each error belongs to, so Save can jump to the first problem. */
const SECTION_OF: Record<string, Section> = {
  name: 'Basic Info', title: 'Basic Info', nmls: 'Basic Info', years: 'Basic Info', loans: 'Basic Info',
  about: 'About', services: 'Services', awards: 'Awards', city: 'Location', addresses: 'Location', hours: 'Hours',
  email: 'Social Links', linkedin: 'Social Links', twitter: 'Social Links', facebook: 'Social Links', website: 'Social Links',
}

export function EditProfileModal({ agent, onClose, initialSection = 'Basic Info' }: { agent: Agent; onClose: () => void; initialSection?: EditSection }) {
  const toast = useToast()
  const [draft, setDraft] = useState<Agent>(() => structuredClone(agent))
  const [section, setSection] = useState<Section>(initialSection)
  const [errors, setErrors] = useState<Errors>({})
  const [tag, setTag] = useState('')
  const [area, setArea] = useState('')
  const [photoError, setPhotoError] = useState('')
  // AI drafting for a service's tagline and description: which one is in flight, and what each draft replaced (for Undo)
  const [drafting, setDrafting] = useState<string | null>(null)
  const [drafted, setDrafted] = useState<Record<string, { draft: ServiceCopyDraft; previous: { blurb: string; description: string } }>>({})
  // Manager view (demo): a manager can lock fields so the agent cannot edit them, and can edit locked fields.
  const [manager, setManager] = useState(false)
  const locks = draft.lockedFields ?? []
  const ro = (f: LockField) => !manager && locks.includes(f)
  const toggleLock = (f: LockField) => set('lockedFields', locks.includes(f) ? locks.filter((x) => x !== f) : [...locks, f])
  const lockTag = (f: LockField) =>
    manager ? (
      <button type="button" onClick={() => toggleLock(f)} aria-pressed={locks.includes(f)} aria-label={`${locks.includes(f) ? 'Unlock' : 'Lock'} ${LOCK_LABEL[f]}`}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${locks.includes(f) ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
        {locks.includes(f) ? <Lock size={11} /> : <Unlock size={11} />}{locks.includes(f) ? 'Locked' : 'Lock'}
      </button>
    ) : locks.includes(f) ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700" title="Locked by your manager"><Lock size={11} /> Locked by manager</span> : null
  const avatarFile = useRef<HTMLInputElement>(null)
  const coverFile = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Agent>(k: K, v: Agent[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setSocial = (k: keyof Agent['social'], v: string) => setDraft((d) => ({ ...d, social: { ...d.social, [k]: v } }))
  const setService = (id: string, patch: Partial<Service>) => set('services', draft.services.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const dirty = JSON.stringify(draft) !== JSON.stringify(agent)

  // Fills the two fields from the AI (or the labelled template). Nothing is saved until Save Changes.
  const draftService = async (svc: Service) => {
    setDrafting(svc.id)
    const previous = { blurb: svc.blurb, description: svc.description }
    const d = await draftServiceCopy(draft, svc)
    setService(svc.id, { blurb: d.blurb, description: d.description })
    setDrafted((m) => ({ ...m, [svc.id]: { draft: d, previous } }))
    setDrafting(null)
  }
  const undoDraft = (id: string) => {
    const entry = drafted[id]
    if (!entry) return
    setService(id, entry.previous)
    setDrafted(({ [id]: _gone, ...rest }) => rest)
  }

  const save = () => {
    const errs = validate(draft)
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      setSection(SECTION_OF[first] ?? 'Basic Info')
      return
    }
    actions.saveProfile(agent.id, {
      ...draft,
      name: draft.name.trim(), title: draft.title.trim(), company: draft.company.trim(),
      specialties: draft.specialties.map((s) => s.trim()).filter(Boolean),
    }, { manager })
    toast('Profile saved')
    onClose()
  }

  const setAddresses = (list: Address[]) => set('addresses', list)
  const setAddress = (id: string, patch: Partial<Address>) => setAddresses(agentAddresses(draft).map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const addAddress = () => setAddresses([...agentAddresses(draft), { id: `addr-${Date.now().toString(36)}`, label: 'New address', street: '', city: draft.city, region: '', postal: '', amenities: [] }])
  const makePrimary = (id: string) => { const l = agentAddresses(draft); setAddresses([l.find((x) => x.id === id)!, ...l.filter((x) => x.id !== id)]) }
  const setHours = (h: ReturnType<typeof agentHours>) => set('hours', h)
  const setDay = (i: number, patch: Partial<ReturnType<typeof agentHours>['days'][number]>) => { const h = agentHours(draft); setHours({ ...h, days: h.days.map((d, k) => (k === i ? { ...d, ...patch } : d)) }) }
  const copyMonday = () => { const h = agentHours(draft); setHours({ ...h, days: h.days.map((d, k) => (k > 0 && k < 5 ? { ...h.days[0]! } : d)) }) }

  const addArea = () => {
    const t = area.trim()
    if (t && !draft.serviceAreas.some((x) => x.toLowerCase() === t.toLowerCase())) set('serviceAreas', [...draft.serviceAreas, t])
    setArea('')
  }
  const setAward = (id: string, patch: Partial<Award>) => set('awards', draft.awards.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  const addTag = () => {
    const t = tag.trim()
    if (t && !draft.specialties.some((s) => s.toLowerCase() === t.toLowerCase())) set('specialties', [...draft.specialties, t])
    setTag('')
  }

  const pickImage = async (f: File | undefined, apply: (url: string) => void, maxBytes = 1_500_000) => {
    if (!f) return
    try {
      apply(await readImage(f, maxBytes))
      setPhotoError('')
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  return (
    <Modal
      title="Edit Profile"
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} onClick={save} disabled={!dirty}>Save Changes</button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="flex items-center gap-2 text-xs text-slate-600"><ShieldCheck size={15} className="text-slate-500" />{manager ? 'Manager view: you can lock fields and edit locked ones.' : locks.length ? `${locks.length} field${locks.length === 1 ? ' is' : 's are'} locked by your manager.` : 'No fields are locked.'}</span>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" role="switch" checked={manager} onChange={(e) => setManager(e.target.checked)} /> Manager view (demo)</label>
      </div>
      <div className="flex min-h-[380px] flex-col gap-5 sm:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-40 sm:flex-col" aria-label="Edit sections">
          {SECTIONS.map((s) => {
            const bad = Object.keys(errors).some((k) => SECTION_OF[k] === s)
            return (
              <button key={s} onClick={() => setSection(s)} aria-current={section === s} className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${section === s ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                {s}
                {bad && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {section === 'Basic Info' && (
            <>
              <h3 className="text-sm font-semibold text-slate-900">Basic Information</h3>
              <div className="flex items-center gap-4">
                <Avatar agent={draft} size={72} />
                <div>
                  <input ref={avatarFile} type="file" accept="image/*" hidden onChange={(e) => void pickImage(e.target.files?.[0], (u) => set('photoUrl', u))} />
                  <button className="text-sm font-medium text-blue-600 hover:underline" onClick={() => avatarFile.current?.click()}>Change Photo</button>
                  {draft.photoUrl && <button className="ml-3 text-sm text-slate-500 hover:underline" onClick={() => set('photoUrl', '')}>Remove</button>}
                  {photoError && <p className="text-xs text-rose-600">{photoError}</p>}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" error={errors.name} adornment={lockTag('name')}><input className={INPUT} disabled={ro('name')} value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
                <Field label="Title" error={errors.title} adornment={lockTag('title')}><input className={INPUT} disabled={ro('title')} value={draft.title} onChange={(e) => set('title', e.target.value)} /></Field>
                <Field label="NMLS #" error={errors.nmls} adornment={lockTag('nmls')}><input className={INPUT} disabled={ro('nmls')} inputMode="numeric" value={draft.nmls} onChange={(e) => set('nmls', e.target.value)} /></Field>
                <Field label="Company" adornment={lockTag('company')}><input className={INPUT} disabled={ro('company')} value={draft.company} onChange={(e) => set('company', e.target.value)} /></Field>
                <Field label="Years of experience" error={errors.years}><input className={INPUT} type="number" min={0} value={draft.yearsExperience} onChange={(e) => set('yearsExperience', Number(e.target.value))} /></Field>
                <Field label="Completed loans" error={errors.loans}><input className={INPUT} type="number" min={0} value={draft.completedLoans} onChange={(e) => set('completedLoans', Number(e.target.value))} /></Field>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input type="checkbox" className="mt-1" checked={draft.published !== false} onChange={(e) => set('published', e.target.checked)} />
                <span><span className="block text-sm font-medium text-slate-900">Published</span><span className="text-xs text-slate-500">Your profile is live and visible on Experience.com. Untick to take it offline.</span></span>
              </label>
            </>
          )}

          {section === 'About' && (
            <>
              <Field label="About" error={errors.about} hint={`${draft.about.length}/600`} adornment={lockTag('about')}>
                <textarea className={`${INPUT} h-40 resize-none`} disabled={ro('about')} value={draft.about} onChange={(e) => set('about', e.target.value)} />
              </Field>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600"><span>Specialties</span>{lockTag('specialties')}</div>
                <div className="flex flex-wrap gap-2">
                  {draft.specialties.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-sm text-blue-700">
                      {s}
                      <button aria-label={`Remove ${s}`} disabled={ro('specialties')} onClick={() => set('specialties', draft.specialties.filter((x) => x !== s))}><X size={13} /></button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input className={INPUT} disabled={ro('specialties')} placeholder="Add a specialty" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                  <button className={BTN_GHOST} disabled={ro('specialties')} onClick={addTag}>Add</button>
                </div>
              </div>
            </>
          )}

          {section === 'Services' && (
            <>
              {errors.services && <p className="text-xs text-rose-600">{errors.services}</p>}
              {draft.services.map((s) => (
                <div key={s.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="flex gap-2">
                    <input className={INPUT} placeholder="Service name" value={s.name} onChange={(e) => setService(s.id, { name: e.target.value })} />
                    <button aria-label={`Remove ${s.name || 'service'}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => set('services', draft.services.filter((x) => x.id !== s.id))}><Trash2 size={16} /></button>
                  </div>
                  <input className={INPUT} placeholder="Short tagline" value={s.blurb} disabled={drafting === s.id} onChange={(e) => { setService(s.id, { blurb: e.target.value }); setDrafted(({ [s.id]: _x, ...rest }) => rest) }} />
                  <textarea className={`${INPUT} h-16 resize-none`} placeholder="Description" value={s.description} disabled={drafting === s.id} onChange={(e) => { setService(s.id, { description: e.target.value }); setDrafted(({ [s.id]: _x, ...rest }) => rest) }} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button type="button" onClick={() => void draftService(s)} disabled={!s.name.trim() || drafting === s.id} aria-label={`Draft ${s.name || 'service'} copy with AI`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      {drafting === s.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-purple-500" />} {drafting === s.id ? 'Drafting…' : s.description || s.blurb ? 'Rewrite with AI' : 'Draft with AI'}
                    </button>
                    {!s.name.trim() && <span className="text-xs text-slate-400">Name the service first.</span>}
                    {drafted[s.id] && (
                      <>
                        <span className="text-xs text-slate-500">
                          {drafted[s.id]!.draft.source === 'ai'
                            ? `Drafted by ${drafted[s.id]!.draft.model ?? 'AI'}. Read and edit it before saving.`
                            : `Template draft${drafted[s.id]!.draft.note ? ` (${drafted[s.id]!.draft.note!.replace(/\.$/, '')})` : ''}. Read and edit it before saving.`}
                        </span>
                        {(drafted[s.id]!.previous.blurb || drafted[s.id]!.previous.description) && (
                          <button type="button" onClick={() => undoDraft(s.id)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"><Undo2 size={12} /> Undo</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button className={BTN_GHOST} onClick={() => set('services', [...draft.services, { id: `s-${Date.now()}`, name: '', blurb: '', description: '', icon: 'briefcase' }])}><Plus size={14} /> Add service</button>
            </>
          )}

          {section === 'Awards' && (
            <>
              {errors.awards && <p className="text-xs text-rose-600">{errors.awards}</p>}
              {draft.awards.length === 0 && <p className="text-sm text-slate-500">No awards or certifications yet.</p>}
              {draft.awards.map((a) => (
                <div key={a.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_90px_auto]">
                  <input className={INPUT} placeholder="Award or certification" aria-label="Award title" value={a.title} onChange={(e) => setAward(a.id, { title: e.target.value })} />
                  <input className={INPUT} placeholder="Issued by" aria-label="Issued by" value={a.issuer} onChange={(e) => setAward(a.id, { issuer: e.target.value })} />
                  <input className={INPUT} type="number" placeholder="Year" aria-label="Year" value={a.year || ''} onChange={(e) => setAward(a.id, { year: Number(e.target.value) })} />
                  <button aria-label={`Remove ${a.title || 'award'}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => set('awards', draft.awards.filter((x) => x.id !== a.id))}><Trash2 size={16} /></button>
                </div>
              ))}
              <button className={BTN_GHOST} onClick={() => set('awards', [...draft.awards, { id: `a-${Date.now()}`, title: '', issuer: '', year: new Date().getFullYear() }])}><Plus size={14} /> Add award or certification</button>
            </>
          )}

          {section === 'Location' && (
            <fieldset disabled={ro('location')} className="min-w-0 space-y-4 disabled:opacity-70">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Location</h3>{lockTag('location')}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="City" error={errors.city}><input className={INPUT} value={draft.city} onChange={(e) => set('city', e.target.value)} /></Field>
                <Field label="Display location" hint="Shown under your name, e.g. Birmingham, UK"><input className={INPUT} value={draft.location} onChange={(e) => set('location', e.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <div className="mb-1 text-xs font-medium text-slate-600">Service areas</div>
                  <div className="flex flex-wrap gap-2">
                    {draft.serviceAreas.map((x) => (
                      <span key={x} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-sm text-blue-700">
                        {x}
                        <button aria-label={`Remove ${x}`} onClick={() => set('serviceAreas', draft.serviceAreas.filter((y) => y !== x))}><X size={13} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input className={INPUT} placeholder="Add a city you serve" value={area} onChange={(e) => setArea(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addArea())} />
                    <button className={BTN_GHOST} onClick={addArea}>Add</button>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Addresses</h3><button className={BTN_GHOST} onClick={addAddress}><Plus size={14} /> Add address</button></div>
                {errors.addresses && <p className="mb-2 text-xs text-rose-600">{errors.addresses}</p>}
                <div className="space-y-3">
                  {agentAddresses(draft).map((ad, i) => (
                    <div key={ad.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{i === 0 ? 'Primary address' : `Address ${i + 1}`}</span>
                        <span className="flex items-center gap-2">
                          {i > 0 && <button className="text-xs font-medium text-blue-600 hover:underline" onClick={() => makePrimary(ad.id)}>Make primary</button>}
                          {i > 0 && <button aria-label={`Remove ${ad.label}`} className="text-slate-400 hover:text-rose-600" onClick={() => setAddresses(agentAddresses(draft).filter((x) => x.id !== ad.id))}><Trash2 size={15} /></button>}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field label="Label"><input className={INPUT} value={ad.label} onChange={(e) => setAddress(ad.id, { label: e.target.value })} /></Field>
                        <Field label="Street"><input className={INPUT} value={ad.street} onChange={(e) => setAddress(ad.id, { street: e.target.value })} /></Field>
                        <Field label="City"><input className={INPUT} value={ad.city} onChange={(e) => setAddress(ad.id, { city: e.target.value })} /></Field>
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Region"><input className={INPUT} value={ad.region} onChange={(e) => setAddress(ad.id, { region: e.target.value })} /></Field>
                          <Field label="Postcode"><input className={INPUT} value={ad.postal} onChange={(e) => setAddress(ad.id, { postal: e.target.value })} /></Field>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-600">Amenities</div>
                        <div className="flex flex-wrap gap-1.5">
                          {AMENITIES.map((am) => {
                            const on = ad.amenities.includes(am.id)
                            return <button key={am.id} type="button" aria-pressed={on} onClick={() => setAddress(ad.id, { amenities: on ? ad.amenities.filter((x) => x !== am.id) : [...ad.amenities, am.id] })} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{am.label}</button>
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </fieldset>
          )}

          {section === 'Hours' && (
            <fieldset disabled={ro('hours')} className="min-w-0 space-y-3 disabled:opacity-70">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Business hours</h3>{lockTag('hours')}</div>
              {errors.hours && <p className="text-xs text-rose-600">{errors.hours}</p>}
              <Field label="Time zone"><select className={INPUT} value={agentHours(draft).timeZone} onChange={(e) => setHours({ ...agentHours(draft), timeZone: e.target.value })}>{TIME_ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}</select></Field>
              <ul className="space-y-2">
                {agentHours(draft).days.map((d, i) => {
                  const bad = validateHours(agentHours(draft))[i]
                  return (
                    <li key={i} className="rounded-xl border border-slate-200 p-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex w-32 cursor-pointer items-center gap-2 text-sm font-medium text-slate-800"><input type="checkbox" checked={d.open} onChange={(e) => setDay(i, { open: e.target.checked })} />{DAY_NAMES[i]}</label>
                        {d.open ? (
                          <span className="flex items-center gap-2 text-sm text-slate-600">
                            <input aria-label={`${DAY_NAMES[i]} opens`} type="time" className={`${INPUT} !w-36`} value={d.from} onChange={(e) => setDay(i, { from: e.target.value })} />to
                            <input aria-label={`${DAY_NAMES[i]} closes`} type="time" className={`${INPUT} !w-36`} value={d.to} onChange={(e) => setDay(i, { to: e.target.value })} />
                          </span>
                        ) : <span className="text-sm text-slate-400">Closed</span>}
                        {i === 0 && <button type="button" className="ml-auto text-xs font-medium text-blue-600 hover:underline" onClick={copyMonday}>Copy Monday to weekdays</button>}
                      </div>
                      {bad && <p className="mt-1 text-xs text-rose-600">{bad}</p>}
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )}

          {section === 'Photos' && (
            <>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">Profile photo</div>
                <div className="flex items-center gap-3">
                  <Avatar agent={draft} size={64} />
                  <button className={BTN_GHOST} onClick={() => avatarFile.current?.click()}><Camera size={14} /> Upload</button>
                  {draft.photoUrl && <button className="text-sm text-slate-500 hover:underline" onClick={() => set('photoUrl', '')}>Remove</button>}
                </div>
                <input ref={avatarFile} type="file" accept="image/*" hidden onChange={(e) => void pickImage(e.target.files?.[0], (u) => set('photoUrl', u))} />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-600">Cover</div>
                <div className="h-20 rounded-xl" style={coverStyle(draft.cover)} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {PRESET_COVERS.map((id) => (
                    <button key={id} aria-label={COVERS[id]!.label} aria-pressed={draft.cover === id} onClick={() => set('cover', id)} className={`h-8 w-12 rounded-md ${draft.cover === id ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`} style={coverStyle(id)} />
                  ))}
                  <button className={BTN_GHOST} onClick={() => coverFile.current?.click()}>Upload</button>
                  <input ref={coverFile} type="file" accept="image/*" hidden onChange={(e) => void pickImage(e.target.files?.[0], (u) => set('cover', u), 3_000_000)} />
                </div>
              </div>
              {photoError && <p className="text-xs text-rose-600">{photoError}</p>}
            </>
          )}

          {section === 'Social Links' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone" adornment={lockTag('phone')}><input className={INPUT} disabled={ro('phone')} value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="Email" error={errors.email} adornment={lockTag('email')}><input className={INPUT} disabled={ro('email')} value={draft.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Website" error={errors.website}><input className={INPUT} value={draft.social.website} onChange={(e) => setSocial('website', e.target.value)} /></Field>
              <Field label="LinkedIn" error={errors.linkedin}><input className={INPUT} value={draft.social.linkedin} onChange={(e) => setSocial('linkedin', e.target.value)} /></Field>
              <Field label="X / Twitter" error={errors.twitter}><input className={INPUT} value={draft.social.twitter} onChange={(e) => setSocial('twitter', e.target.value)} /></Field>
              <Field label="Facebook" error={errors.facebook}><input className={INPUT} value={draft.social.facebook} onChange={(e) => setSocial('facebook', e.target.value)} /></Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

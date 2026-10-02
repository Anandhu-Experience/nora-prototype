import { Camera, Loader2, Plus, Sparkles, Trash2, Undo2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { draftServiceCopy, type ServiceCopyDraft } from '../aiDrafts'
import { actions } from '../store'
import { COVERS, PRESET_COVERS, coverStyle } from '../selectors'
import type { Agent, Service } from '../types'
import { Avatar, Field, readImage } from './bits'
import { BTN_GHOST, BTN_PRIMARY, INPUT, Modal } from './Modal'
import { useToast } from './Toast'

const SECTIONS = ['Basic Info', 'About', 'Services', 'Location', 'Photos', 'Social Links'] as const
type Section = (typeof SECTIONS)[number]
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
  return e
}

/** Which section each error belongs to, so Save can jump to the first problem. */
const SECTION_OF: Record<string, Section> = {
  name: 'Basic Info', title: 'Basic Info', nmls: 'Basic Info', years: 'Basic Info', loans: 'Basic Info',
  about: 'About', services: 'Services', city: 'Location',
  email: 'Social Links', linkedin: 'Social Links', twitter: 'Social Links', facebook: 'Social Links', website: 'Social Links',
}

export function EditProfileModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const toast = useToast()
  const [draft, setDraft] = useState<Agent>(() => structuredClone(agent))
  const [section, setSection] = useState<Section>('Basic Info')
  const [errors, setErrors] = useState<Errors>({})
  const [tag, setTag] = useState('')
  const [photoError, setPhotoError] = useState('')
  // AI drafting for a service's tagline and description: which one is in flight, and what each draft replaced (for Undo)
  const [drafting, setDrafting] = useState<string | null>(null)
  const [drafted, setDrafted] = useState<Record<string, { draft: ServiceCopyDraft; previous: { blurb: string; description: string } }>>({})
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
    })
    toast('Profile saved')
    onClose()
  }

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
                <Field label="Name" error={errors.name}><input className={INPUT} value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
                <Field label="Title" error={errors.title}><input className={INPUT} value={draft.title} onChange={(e) => set('title', e.target.value)} /></Field>
                <Field label="NMLS #" error={errors.nmls}><input className={INPUT} inputMode="numeric" value={draft.nmls} onChange={(e) => set('nmls', e.target.value)} /></Field>
                <Field label="Company"><input className={INPUT} value={draft.company} onChange={(e) => set('company', e.target.value)} /></Field>
                <Field label="Years of experience" error={errors.years}><input className={INPUT} type="number" min={0} value={draft.yearsExperience} onChange={(e) => set('yearsExperience', Number(e.target.value))} /></Field>
                <Field label="Completed loans" error={errors.loans}><input className={INPUT} type="number" min={0} value={draft.completedLoans} onChange={(e) => set('completedLoans', Number(e.target.value))} /></Field>
              </div>
            </>
          )}

          {section === 'About' && (
            <>
              <Field label="About" error={errors.about} hint={`${draft.about.length}/600`}>
                <textarea className={`${INPUT} h-40 resize-none`} value={draft.about} onChange={(e) => set('about', e.target.value)} />
              </Field>
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600">Specialties</div>
                <div className="flex flex-wrap gap-2">
                  {draft.specialties.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-sm text-blue-700">
                      {s}
                      <button aria-label={`Remove ${s}`} onClick={() => set('specialties', draft.specialties.filter((x) => x !== s))}><X size={13} /></button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input className={INPUT} placeholder="Add a specialty" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} />
                  <button className={BTN_GHOST} onClick={addTag}>Add</button>
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

          {section === 'Location' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City" error={errors.city}><input className={INPUT} value={draft.city} onChange={(e) => set('city', e.target.value)} /></Field>
              <Field label="Display location" hint="Shown under your name, e.g. Birmingham, UK"><input className={INPUT} value={draft.location} onChange={(e) => set('location', e.target.value)} /></Field>
            </div>
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
              <Field label="Phone"><input className={INPUT} value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="Email" error={errors.email}><input className={INPUT} value={draft.email} onChange={(e) => set('email', e.target.value)} /></Field>
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

import * as api from '../../mock/api'
import { completenessAfter, missingProfileFields, MIN_SPECIALTIES } from '../../mock/rules'
import type { Profile } from '../../mock/types'
import { AI_TASKS, type BioInput } from '../../profile/aiTasks'
import { isLocked } from '../../profile/details'
import { getState } from '../../profile/store'
import { defineSkill, type Draft, type Finding } from '../types'
import doc from './SKILL.md?raw'

const SPECIALTY_POOL = ['FHA', 'VA', 'Jumbo', 'Refinance', 'First-time buyers', 'USDA', 'Investment property']
const DRAFTABLE = ['bio', 'specialties'] as const
type Draftable = (typeof DRAFTABLE)[number]

const LABEL: Record<Draftable, string> = { bio: 'Bio', specialties: 'Specialties' }

const LOCK_OF = { bio: 'about', specialties: 'specialties' } as const

/** What NORA may draft: missing, and not locked by a manager (NORA can't change a locked field either). */
const draftableMissing = (missing: string[]): Draftable[] => {
  const s = getState()
  const me = s.agents[s.viewerId]!
  return DRAFTABLE.filter((f) => missing.includes(f) && !isLocked(me, LOCK_OF[f]))
}

/** What the skill reads: the profile NORA's rules see, plus the facts a bio may use. */
interface ProfileRead {
  profile: Profile
  facts: BioInput
}

export const profileSkill = defineSkill<ProfileRead>({
  id: 'profile-completion',
  name: 'Profile Completion',
  description: 'Detect missing profile information and propose fixes.',
  domain: 'profile',
  kind: 'action',
  priority: 90,
  allowedModel: AI_TASKS.bio.allowedModel,
  requiresApproval: true,
  whenToUse: ['Profile has meaningful missing information', 'User can edit profile'],
  whenNotToUse: ['Profile is already complete'],
  doc,

  evaluate(graph) {
    const gaps = draftableMissing(graph.profile.missing)
    if (gaps.length === 0) {
      return { applies: false, reason: `Nothing draftable missing (${graph.profile.completeness}% complete)`, relevance: 0 }
    }
    return {
      applies: true,
      reason: `${gaps.join(', ')} missing, profile ${graph.profile.completeness}% complete`,
      relevance: 100 - graph.profile.completeness,
    }
  },

  scoreChange(graph) {
    const gaps = draftableMissing(graph.profile.missing)
    if (!gaps.length) return null
    const s = getState()
    const me = s.agents[s.viewerId]!
    const patch: Partial<typeof me> = {}
    if (gaps.includes('bio')) patch.about = `${me.title} based in ${me.location}, helping clients find the right fit with clear, honest guidance.`
    if (gaps.includes('specialties')) patch.specialties = [...me.specialties, ...SPECIALTY_POOL.filter((x) => !me.specialties.includes(x))].slice(0, Math.max(MIN_SPECIALTIES, me.specialties.length))
    return { profile: patch }
  },

  expectedOutcome(graph) {
    const gaps = draftableMissing(graph.profile.missing)
    if (!gaps.length) return null
    const c = graph.profile.completeness
    return { label: 'Profile completeness', before: `${c}%`, after: `${completenessAfter(c, graph.profile.missing, gaps)}%` }
  },

  proposal(graph) {
    const n = draftableMissing(graph.profile.missing).length
    return {
      message: `I found ${n} thing${n === 1 ? '' : 's'} missing from your profile. Shall I review ${n === 1 ? 'it' : 'them'}?`,
      cta: 'Review with NORA',
    }
  },

  read: async () => ({ profile: await api.getProfile(), facts: await api.getProfileFacts() }),

  validate(data) {
    const { profile } = data
    const findings: Finding[] = draftableMissing(missingProfileFields(profile)).map((f) => ({
      id: f,
      label: LABEL[f],
      detail: f === 'bio' ? 'Bio is empty' : `Only ${profile.specialties.length} of ${MIN_SPECIALTIES} specialties`,
    }))
    return { findings, context: data }
  },

  buildDraftRequest({ findings, context }) {
    const { profile, facts } = context as ProfileRead
    const fixing = new Set(findings.map((f) => f.id))
    const patch: Partial<Profile> = {}
    const changes: Draft['changes'] = []

    if (fixing.has('bio')) {
      patch.bio = `${profile.headline} based in ${profile.location}, helping clients find the right fit with clear, honest guidance.`
      changes.push({ label: 'Bio', before: 'Empty', after: patch.bio })
    }
    if (fixing.has('specialties')) {
      const extra = SPECIALTY_POOL.filter((s) => !profile.specialties.includes(s))
      patch.specialties = [...profile.specialties, ...extra].slice(0, Math.max(MIN_SPECIALTIES, profile.specialties.length))
      changes.push({
        label: 'Specialties',
        before: `${profile.specialties.length}: ${profile.specialties.join(', ') || 'none'}`,
        after: `${patch.specialties.length}: ${patch.specialties.join(', ')}`,
      })
    }

    return {
      skillId: 'profile-completion',
      model: AI_TASKS.bio.allowedModel,
      instruction: `Write the profile bio from the facts (server-side prompt). Fix only: ${[...fixing].join(', ')}.`,
      mockDraft: { summary: `Complete ${changes.length} profile field${changes.length === 1 ? '' : 's'}`, changes, payload: patch },
      // Only the bio is AI-written; specialties stay deterministic. The bio mentions the specialties it will end up with.
      ai: fixing.has('bio')
        ? {
            kind: 'bio',
            input: { ...facts, specialties: patch.specialties ?? facts.specialties },
            apply: (text, draft) => {
              const change = draft.changes.find((c) => c.label === 'Bio')
              if (change) change.after = text
              ;(draft.payload as Partial<Profile>).bio = text
              return draft
            },
          }
        : undefined,
    }
  },

  async write(draft) {
    await api.updateProfile(draft.payload as Partial<Profile>)
  },
})

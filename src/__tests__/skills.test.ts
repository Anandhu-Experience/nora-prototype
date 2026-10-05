import { beforeEach, describe, expect, it } from 'vitest'
import * as api from '../mock/api'
import { resetDatabase } from '../mock/database'
import { buildGraph } from '../mock/graph'
import { skillRegistry, getSkill } from '../nora/skillRegistry'
import type { Skill } from '../skills/types'

beforeEach(() => {
  api.setApiLatency(0)
  resetDatabase('profile-needed')
})

const applying = () => {
  const g = buildGraph()
  return skillRegistry.filter((s) => s.evaluate(g).applies).map((s) => s.id)
}

async function run(skill: Skill) {
  const validation = skill.validate!(await skill.read!())
  const draft = skill.buildDraftRequest!(validation).mockDraft
  return { validation, draft }
}

describe('registry', () => {
  it('has the five skills with unique ids and docs', () => {
    expect(skillRegistry.map((s) => s.id)).toEqual(['profile-completion', 'connection-setup', 'listing-optimization', 'web-analytics-insight', 'voce-explore'])
    expect(new Set(skillRegistry.map((s) => s.id)).size).toBe(5)
    for (const s of skillRegistry) expect(s.doc).toContain('## When to use')
  })

  it('explore skills rank below every other kind', () => {
    const lowestOther = Math.min(...skillRegistry.filter((s) => s.kind !== 'explore').map((s) => s.priority))
    for (const s of skillRegistry.filter((s) => s.kind === 'explore')) expect(s.priority).toBeLessThan(lowestOther)
  })
})

describe('applicability by scenario', () => {
  it('A: profile (+ voce)', () => expect(applying()).toEqual(['profile-completion', 'voce-explore']))
  it('B: only voce', () => {
    resetDatabase('all-complete')
    expect(applying()).toEqual(['voce-explore'])
  })
  it('D: profile, listings, analytics, voce', () => {
    resetDatabase('multi-action')
    expect(applying()).toEqual(['profile-completion', 'listing-optimization', 'web-analytics-insight', 'voce-explore'])
  })
})

describe('profile skill', () => {
  it('proposal wording matches the spec', () => {
    expect(getSkill('profile-completion')!.proposal(buildGraph()).message).toBe(
      'I found 2 things missing from your profile. Shall I review them?',
    )
  })

  it('read/validate/draft never write; write fixes the graph', async () => {
    const skill = getSkill('profile-completion')!
    const { validation, draft } = await run(skill)
    expect(validation.findings.map((f) => f.id)).toEqual(['bio', 'specialties'])
    expect(draft.changes.map((c) => c.label)).toEqual(['Bio', 'Specialties'])
    expect(draft.changes[0].before).toBe('Empty')
    expect(buildGraph().profile.missing).toEqual(['bio', 'specialties'])

    await skill.write!(draft)
    const g = buildGraph()
    expect(g.profile).toEqual({ completeness: 100, missing: [] })
    expect(skill.evaluate(g).applies).toBe(false)
  })
})

describe('listings skill', () => {
  it('drafts a description for the incomplete listing and write removes it from the graph', async () => {
    resetDatabase('multi-action')
    const skill = getSkill('listing-optimization')!
    const { validation, draft } = await run(skill)
    expect(validation.findings.map((f) => f.id)).toEqual(['L3'])
    await skill.write!(draft)
    const g = buildGraph()
    expect(g.listings.incomplete).toBe(0)
    expect(skill.evaluate(g).applies).toBe(false)
  })
})

describe('analytics skill', () => {
  it('is read-only and produces an insight', async () => {
    resetDatabase('multi-action')
    const skill = getSkill('web-analytics-insight')!
    expect(skill.write).toBeUndefined()
    const { validation } = await run({ ...skill, buildDraftRequest: () => ({ mockDraft: {} }) } as unknown as Skill)
    expect(skill.insight!(validation).title).toBe('Traffic is up 38%')
  })
})

describe('voce skill', () => {
  it('no profile: create state', () => {
    const card = getSkill('voce-explore')!.explore!(buildGraph())
    expect(card.headline).toContain('Create your VOCE profile')
    expect(card.actions.map((a) => a.label)).toEqual(['Preview VOCE', 'Create VOCE Profile'])
  })
  it('has profile: stats + open state', () => {
    resetDatabase('voce-exists')
    const card = getSkill('voce-explore')!.explore!(buildGraph())
    expect(card.headline).toBe('Your VOCE profile is ready.')
    expect(card.stats).toEqual([
      { label: 'AI Authority Score', value: '78' },
      { label: 'Articles', value: '12' },
      { label: 'Questions answered', value: '18' },
    ])
    expect(card.actions.map((a) => a.label)).toEqual(['Preview VOCE', 'Open VOCE'])
  })
})

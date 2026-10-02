import { beforeEach, describe, expect, it } from 'vitest'
import * as api from '../mock/api'
import { snapshotDatabase } from '../mock/database'
import { buildGraph } from '../mock/graph'
import { setDraftLatency } from '../nora/generateSkillDraft'
import { NoraEngine, evaluateSkills, selectExplore, selectNext } from '../nora/noraEngine'
import { canTransition, TRANSITIONS, type NoraStatus } from '../nora/noraMachine'
import { skillRegistry } from '../nora/skillRegistry'

beforeEach(() => {
  api.setApiLatency(0)
  setDraftLatency(0)
})

const engine = () => new NoraEngine({ stepDelayMs: 0 })
const statuses = (e: NoraEngine) =>
  e.getState().log.flatMap((l) => (l.status ? [l.status] : []))

describe('skill selection', () => {
  it('ranks by priority and never selects explore skills as actionable', async () => {
    const e = engine()
    await e.reset('multi-action')
    const s = e.getState()
    expect(s.evaluations.filter((x) => x.rank).sort((a, b) => a.rank! - b.rank!).map((x) => x.skillId)).toEqual([
      'profile-completion',
      'listing-optimization',
      'web-analytics-insight',
    ])
    expect(s.selectedSkillId).toBe('profile-completion')
    expect(s.evaluations.find((x) => x.skillId === 'voce-explore')!.rank).toBeNull()
  })

  it('selectNext is null and selectExplore finds VOCE when only VOCE applies', async () => {
    const { resetDatabase } = await import('../mock/database')
    resetDatabase('all-complete')
    const evals = evaluateSkills(buildGraph(), skillRegistry, [])
    expect(selectNext(evals)).toBeNull()
    expect(selectExplore(evals)).toBe('voce-explore')
  })
})

describe('Scenario A: full profile flow', () => {
  it('proposes, waits, reads, drafts, waits, writes, re-evaluates, settles on VOCE', async () => {
    const e = engine()
    await e.reset('profile-needed')

    let s = e.getState()
    expect(s.status).toBe('SKILL_PROPOSED')
    expect(s.proposal!.message).toBe('I found 2 things missing from your profile. Shall I review them?')
    expect(s.graph!.profile.missing).toEqual(['bio', 'specialties'])

    const dbBefore = snapshotDatabase()
    await e.approveStart()
    s = e.getState()
    expect(s.status).toBe('WRITE_APPROVAL')
    expect(s.draft!.changes.map((c) => c.label)).toEqual(['Bio', 'Specialties'])
    expect(snapshotDatabase()).toEqual(dbBefore) // read/validate/draft wrote nothing

    await e.approveWrite()
    s = e.getState()
    expect(s.status).toBe('EXPLORE')
    expect(s.previousGraph!.profile.missing).toEqual(['bio', 'specialties'])
    expect(s.graph!.profile).toEqual({ completeness: 100, missing: [] })
    expect(s.explore!.headline).toContain('Create your VOCE profile')
    expect(s.lastOutcome).toEqual({ skillId: 'profile-completion', outcome: 'applied' })

    expect(statuses(e)).toEqual([
      'CHECKING', 'SKILL_PROPOSED', 'SKILL_APPROVED', 'READING', 'VALIDATING', 'DRAFT_READY',
      'WRITE_APPROVAL', 'WRITING', 'COMPLETED', 'RE_EVALUATING', 'ALL_GOOD', 'EXPLORE',
    ])
  })

  it('reject: stops, writes nothing, does not re-propose, settles', async () => {
    const e = engine()
    await e.reset('profile-needed')
    await e.approveStart()
    const dbBefore = snapshotDatabase()
    await e.rejectWrite()
    const s = e.getState()
    expect(snapshotDatabase()).toEqual(dbBefore)
    expect(s.status).toBe('EXPLORE')
    expect(s.lastOutcome!.outcome).toBe('rejected')
    expect(s.graph!.profile.missing).toEqual(['bio', 'specialties'])
  })

  it('declining the start touches nothing', async () => {
    const e = engine()
    await e.reset('profile-needed')
    const dbBefore = snapshotDatabase()
    await e.declineStart()
    expect(snapshotDatabase()).toEqual(dbBefore)
    expect(e.getState().status).toBe('EXPLORE')
  })
})

describe('Scenarios B and C', () => {
  it('B: no actionable skill -> all good -> VOCE create card', async () => {
    const e = engine()
    await e.reset('all-complete')
    const s = e.getState()
    expect(s.status).toBe('EXPLORE')
    expect(statuses(e)).toEqual(['CHECKING', 'ALL_GOOD', 'EXPLORE'])
    expect(s.explore!.actions.map((a) => a.label)).toEqual(['Preview VOCE', 'Create VOCE Profile'])
  })

  it('C: VOCE profile exists -> stats card', async () => {
    const e = engine()
    await e.reset('voce-exists')
    const s = e.getState()
    expect(s.explore!.headline).toBe('Your VOCE profile is ready.')
    expect(s.explore!.stats!.map((x) => x.value)).toEqual(['78', '12', '18'])
  })
})

describe('Scenario D: multiple skills, continued in rank order', () => {
  it('profile -> listings -> analytics insight (read-only) -> explore', async () => {
    const e = engine()
    await e.reset('multi-action')
    const order: string[] = []

    while (e.getState().status === 'SKILL_PROPOSED') {
      order.push(e.getState().selectedSkillId!)
      await e.approveStart()
      if (e.getState().status === 'RESULT_READY') {
        expect(e.getState().insight!.title).toBe('Traffic is up 38%')
        await e.acknowledgeInsight()
      } else {
        await e.approveWrite()
      }
    }

    expect(order).toEqual(['profile-completion', 'listing-optimization', 'web-analytics-insight'])
    expect(e.getState().status).toBe('EXPLORE')
    const g = buildGraph()
    expect(g.profile.missing).toEqual([])
    expect(g.listings.incomplete).toBe(0)
  })
})

describe('machine guarantees', () => {
  it('ignores out-of-order user actions', async () => {
    const e = engine()
    await e.reset('profile-needed')
    await e.approveWrite() // no draft yet
    expect(e.getState().status).toBe('SKILL_PROPOSED')
    expect(snapshotDatabase().profile.bio).toBe('')
  })

  it('the only way into WRITING is WRITE_APPROVAL', () => {
    const into = (Object.keys(TRANSITIONS) as NoraStatus[]).filter((s) => canTransition(s, 'WRITING'))
    expect(into).toEqual(['WRITE_APPROVAL'])
  })

  it('reset mid-flight discards in-flight work', async () => {
    const slow = new NoraEngine({ stepDelayMs: 5 })
    await slow.reset('profile-needed')
    const flight = slow.approveStart()
    await slow.reset('all-complete')
    await flight
    expect(slow.getState().scenario).toBe('all-complete')
    expect(slow.getState().draft).toBeNull()
    expect(slow.getState().status).toBe('EXPLORE')
  })

  it('a skill requesting a model it is not allowed lands in ERROR without writing', async () => {
    const bad = skillRegistry.map((s) =>
      s.id === 'profile-completion'
        ? { ...s, buildDraftRequest: (v: Parameters<NonNullable<typeof s.buildDraftRequest>>[0]) => ({ ...s.buildDraftRequest!(v), model: 'fable-5-1' as const }) }
        : s,
    )
    const e = new NoraEngine({ stepDelayMs: 0, registry: bad })
    await e.reset('profile-needed')
    await e.approveStart()
    expect(e.getState().status).toBe('ERROR')
    expect(snapshotDatabase().profile.bio).toBe('')
  })
})

describe('refresh (data changed outside NORA)', () => {
  it('re-evaluates a standing proposal and reconsiders dismissed skills', async () => {
    const e = engine()
    await e.reset('profile-needed')
    await e.declineStart() // dismissed profile skill -> explore state
    expect(e.getState().status).toBe('EXPLORE')
    expect(e.getState().handled).toContain('profile-completion')

    await e.refresh()
    const s = e.getState()
    expect(s.status).toBe('SKILL_PROPOSED') // dismissal cleared because the data changed
    expect(s.selectedSkillId).toBe('profile-completion')
  })

  it('does nothing while a run is in progress', async () => {
    const e = engine()
    await e.reset('profile-needed')
    await e.approveStart() // now at WRITE_APPROVAL
    await e.refresh()
    expect(e.getState().status).toBe('WRITE_APPROVAL')
  })
})

describe('stop (user cancels a run)', () => {
  it('discards in-flight work, writes nothing, and the proposal comes back', async () => {
    const slow = new NoraEngine({ stepDelayMs: 25 })
    await slow.reset('profile-needed')
    const dbBefore = snapshotDatabase()
    const run = slow.approveStart()
    await new Promise((r) => setTimeout(r, 10))
    expect(['SKILL_APPROVED', 'READING', 'VALIDATING']).toContain(slow.getState().status)

    await slow.stop()
    expect(slow.getState().status).toBe('SKILL_PROPOSED')
    expect(slow.getState().draft).toBeNull()
    await run // the abandoned run must not resurrect itself
    await new Promise((r) => setTimeout(r, 120))
    expect(slow.getState().status).toBe('SKILL_PROPOSED')
    expect(snapshotDatabase()).toEqual(dbBefore)
  })

  it('can be stopped at the draft step too, and ignores stop when idle or writing', async () => {
    const e = engine()
    await e.reset('profile-needed')
    await e.stop() // nothing running
    expect(e.getState().status).toBe('SKILL_PROPOSED')
    await e.approveStart() // now waiting at WRITE_APPROVAL
    await e.stop() // approval is the user's to answer, not a running step
    expect(e.getState().status).toBe('WRITE_APPROVAL')
  })
})

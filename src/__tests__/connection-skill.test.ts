import { beforeEach, describe, expect, it } from 'vitest'
import * as api from '../mock/api'
import { resetDatabase } from '../mock/database'
import { buildGraph } from '../mock/graph'
import { setDraftLatency } from '../nora/generateSkillDraft'
import { NoraEngine } from '../nora/noraEngine'
import { getSkill, skillRegistry } from '../nora/skillRegistry'
import { connectionsPoints, connectionsStore, isConnected } from '../presence/connections'
import { setLatency } from '../presence/persist'
import { traceStore } from '../guardrails/trace'

beforeEach(() => {
  api.setApiLatency(0)
  setDraftLatency(0)
  setLatency(0)
  connectionsStore.reset()
  traceStore.clear()
})

const engine = () => new NoraEngine({ stepDelayMs: 0 })

describe('connection-setup skill', () => {
  it('applies only while Google is not connected', () => {
    const skill = getSkill('connection-setup')!
    resetDatabase('google-needed')
    expect(skill.evaluate(buildGraph())).toMatchObject({ applies: true })
    expect(skill.expectedOutcome!(buildGraph())).toEqual({ label: 'Connection points', before: '25 of 100', after: '55 of 100' })
    resetDatabase('all-complete')
    expect(skill.evaluate(buildGraph()).applies).toBe(false)
  })

  it('runs ahead of Profile Completion, and declares no model', () => {
    const skill = getSkill('connection-setup')!
    expect(skill.allowedModel).toBe('none')
    expect(skill.priority).toBeGreaterThan(getSkill('profile-completion')!.priority)
    expect(skillRegistry.map((s) => s.id)).toContain('connection-setup')
  })

  it('live scenario reads the Connections page', async () => {
    resetDatabase('live')
    expect(buildGraph().accounts).toEqual({ google: false, points: 25 })
    await api.connectGoogle()
    expect(buildGraph().accounts).toEqual({ google: true, points: 55 })
  })
})

describe('guided Google connection through NORA', () => {
  it('suggests it first, waits for approval, then asks for consent before connecting', async () => {
    const e = engine()
    await e.reset('google-needed')
    let s = e.getState()
    expect(s.status).toBe('SKILL_PROPOSED')
    expect(s.selectedSkillId).toBe('connection-setup')
    expect(s.proposal).toEqual({ message: 'Connect Google to unlock Insights. Shall I start?', cta: 'Connect Google' })

    await e.approveStart()
    s = e.getState()
    expect(s.status).toBe('WRITE_APPROVAL')
    expect(s.draft!.changes.map((c) => c.label)).toEqual(['Google Business Profile', 'What Google will ask you to allow'])
    expect(s.draft!.changes[0]!.before).toContain('Not connected')
    expect(isConnected(connectionsStore.get(), 'google')).toBe(false) // drafting connected nothing
    expect(getSkill('connection-setup')!.consent!.permissions).toHaveLength(3)

    await e.approveWrite() // the user pressed Allow on Google's screen
    expect(isConnected(connectionsStore.get(), 'google')).toBe(true)
    expect(connectionsPoints(connectionsStore.get())).toBe(55)
    s = e.getState()
    expect(s.lastOutcome).toEqual({ skillId: 'connection-setup', outcome: 'applied' })
    expect(s.previousGraph!.accounts).toEqual({ google: false, points: 25 })
    expect(buildGraph().accounts).toEqual({ google: true, points: 55 })
    expect(s.status).toBe('EXPLORE') // nothing else needs attention in this scenario
  })

  it('tags the log with the skill, so one skill\'s activity can be shown on its own', async () => {
    const e = engine()
    await e.reset('multi-action')
    await e.approveStart() // profile-completion first
    await e.approveWrite()
    const mine = e.getState().log.filter((l) => l.skillId === 'profile-completion').map((l) => l.message)
    expect(mine.some((m) => m.startsWith('Approved start: Profile Completion'))).toBe(true)
    expect(mine.some((m) => m.startsWith('Approved write'))).toBe(true)
    expect(e.getState().log.filter((l) => l.skillId === 'listing-optimization').some((l) => /Profile Completion/.test(l.message) && /Approved/.test(l.message))).toBe(false)
  })

  it('declining the suggestion connects nothing and does not ask again', async () => {
    const e = engine()
    await e.reset('google-needed')
    await e.declineStart()
    expect(isConnected(connectionsStore.get(), 'google')).toBe(false)
    expect(e.getState().handled).toContain('connection-setup')
  })

  it('rejecting at the write step connects nothing', async () => {
    const e = engine()
    await e.reset('google-needed')
    await e.approveStart()
    await e.rejectWrite()
    expect(isConnected(connectionsStore.get(), 'google')).toBe(false)
  })

  it('leaves no trace until the user picks an action, then records the run from the issue to the evals', async () => {
    const e = engine()
    await e.reset('google-needed')
    expect(e.getState().status).toBe('SKILL_PROPOSED')
    expect(traceStore.get().traces).toHaveLength(0) // a proposal on its own is not a run

    await e.approveStart()
    let t = traceStore.get().traces[0]!
    expect(traceStore.get().traces).toHaveLength(1)
    expect(t).toMatchObject({ source: 'run', title: 'Connection Setup', done: false })
    expect(t.steps.slice(0, 4).map((x) => x.id)).toEqual(['graph', 'analyze', 'prioritize', 'select'])
    expect(t.steps.find((x) => x.id === 'select')).toMatchObject({ status: 'pass' })
    expect(t.steps.find((x) => x.id === 'routing')!.detail).toMatch(/No model needed/)
    expect(t.steps.find((x) => x.id === 'approval')).toMatchObject({ status: 'pending' }) // waiting for Approval 2

    await e.approveWrite()
    t = traceStore.get().traces[0]!
    expect(t).toMatchObject({ done: true, outcome: 'completed' })
    expect(t.steps.find((x) => x.id === 'approval')).toMatchObject({ status: 'pass' })
    expect(t.steps.find((x) => x.id === 'graph-update')!.detail).toMatch(/accounts\.points 25 → 55/)
    expect(t.steps.find((x) => x.id === 'eval-quality')).toMatchObject({ status: 'pass' })
    const stages = t.steps.map((x) => x.stage)
    expect(stages.indexOf('graph')).toBeLessThan(stages.indexOf('select'))
    expect(stages.indexOf('execute')).toBeLessThan(stages.indexOf('update'))
    expect(stages.indexOf('update')).toBeLessThan(stages.indexOf('eval'))
  })

  it('"Not now" leaves no trace; rejecting the draft closes the run as declined with its eval', async () => {
    const e = engine()
    await e.reset('google-needed')
    await e.declineStart()
    expect(traceStore.get().traces).toHaveLength(0)

    const e2 = engine()
    await e2.reset('google-needed')
    await e2.approveStart()
    await e2.rejectWrite()
    const t = traceStore.get().traces[0]!
    expect(t).toMatchObject({ done: true, outcome: 'declined' })
    expect(t.steps.find((x) => x.id === 'approval')).toMatchObject({ status: 'block' })
    expect(t.steps.some((x) => x.id === 'eval-record')).toBe(true)
  })

  it('records a Flow trace that shows the allow-list pass and no model call', async () => {
    const e = engine()
    await e.reset('google-needed')
    await e.approveStart()
    const t = traceStore.get().traces[0]!
    expect(t.steps.find((s) => s.id === 'action')).toMatchObject({ status: 'pass' })
    expect(t.steps.find((s) => s.id === 'llm')).toMatchObject({ status: 'skip' })
  })
})

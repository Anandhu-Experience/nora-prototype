import { beforeEach, describe, expect, it } from 'vitest'
import * as api from '../../mock/api'
import { resetDatabase } from '../../mock/database'
import { buildGraph } from '../../mock/graph'
import { NoraEngine } from '../../nora/noraEngine'
import { setDraftLatency } from '../../nora/generateSkillDraft'
import { actions, getState } from '../store'

const arj = () => getState().agents.arjunan!

beforeEach(() => {
  api.setApiLatency(0)
  setDraftLatency(0)
  actions.reset()
  resetDatabase('live')
})

describe('NORA <-> Profile page', () => {
  it('live scenario reads the Profile page: its real gap (3 specialties) is what NORA finds', () => {
    expect(arj().specialties).toHaveLength(3)
    const g = buildGraph()
    expect(g.profile.missing).toEqual(['specialties'])
    expect(g.user.name).toBe('Matt Reeves')
  })

  it('live scenario never overwrites Profile page data', () => {
    actions.setAbout('arjunan', 'My hand-written bio')
    resetDatabase('live')
    expect(arj().about).toBe('My hand-written bio')
  })

  it('edits on the Profile page change what NORA sees', () => {
    actions.setAbout('arjunan', '')
    expect(buildGraph().profile.missing).toEqual(['bio', 'specialties'])
    actions.saveProfile('arjunan', { ...arj(), about: 'Back again', specialties: ['a', 'b', 'c', 'd', 'e'] })
    expect(buildGraph().profile).toEqual({ completeness: 100, missing: [] })
  })

  it('demo scenarios set the profile gaps on the Profile page', () => {
    resetDatabase('profile-needed')
    expect(arj().about).toBe('')
    expect(arj().specialties).toHaveLength(2)
    resetDatabase('all-complete')
    expect(arj().about).not.toBe('')
    expect(arj().specialties).toHaveLength(5)
    expect(buildGraph().profile.completeness).toBe(100)
  })

  it('a NORA write lands on the Profile page with activity and a notification', async () => {
    resetDatabase('profile-needed')
    const e = new NoraEngine({ stepDelayMs: 0 })
    await e.reset('profile-needed')
    await e.approveStart()
    const notifsBefore = getState().notifications.length
    expect(arj().about).toBe('') // draft is only a preview
    await e.approveWrite()

    expect(arj().about).toContain('Mortgage Loan Officer')
    expect(arj().specialties).toHaveLength(5)
    expect(arj().activity[0]!.text).toBe('NORA updated your bio and specialties')
    expect(getState().notifications).toHaveLength(notifsBefore + 1)
    expect(getState().notifications[0]!.text).toBe('NORA updated your bio and specialties')
    expect(getState().notifications[0]!.link).toBe('/profile/arjunan')
  })

  it('rejecting in NORA leaves the Profile page untouched', async () => {
    const e = new NoraEngine({ stepDelayMs: 0 })
    await e.reset('profile-needed')
    await e.approveStart()
    const before = structuredClone(arj())
    await e.rejectWrite()
    expect(arj()).toEqual(before)
  })
})

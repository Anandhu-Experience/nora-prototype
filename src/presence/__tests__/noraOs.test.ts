import { beforeEach, describe, expect, it } from 'vitest'
import { actions, getState } from '../../profile/store'
import { connect, connectionsStore } from '../connections'
import { collectIssues, collectTrackers, noraOsStore, reconcile, resolvedIssues, syncIssueHistory, type OsIssue } from '../noraOs'
import { resetPresence, setLatency } from '../persist'

beforeEach(() => { setLatency(0); actions.reset(); resetPresence() })
const me = () => getState().agents[getState().viewerId]!
const ids = () => collectIssues(me()).map((i) => i.id)

describe('NORA OS issues', () => {
  it('collects issues from every module, with Google first among the high-priority ones the user can hand to NORA', () => {
    const issues = collectIssues(me())
    const modules = new Set(issues.map((i) => i.module))
    for (const m of ['Profile', 'Connections', 'Reviews', 'AI Visibility', 'Network']) expect(modules.has(m as never), m).toBe(true)
    const google = issues.find((i) => i.id === 'conn:google')!
    expect(google).toMatchObject({ severity: 'high', nora: 'connections', impact: '+30 pts' })
    expect(issues.find((i) => i.id === 'profile:specialties')).toMatchObject({ nora: 'profile' })
    expect(issues[0]!.severity).toBe('high') // most important first
  })

  it('issues disappear on their own when the data is fixed, wherever it is fixed', async () => {
    expect(ids()).toContain('conn:google')
    await connect('google')
    expect(ids()).not.toContain('conn:google')
    const unreplied = me().reviews.filter((r) => !r.reply?.trim())
    expect(unreplied.length).toBeGreaterThan(0)
    expect(ids()).toContain(`review:${unreplied[0]!.id}`)
  })

  it('trackers cover each module with a 0 to 100 bar', () => {
    const t = collectTrackers(me())
    expect(t.map((x) => x.id)).toEqual(['profile', 'connections', 'listings', 'website', 'reviews', 'ai', 'network'])
    for (const x of t) expect(x.pct).toBeGreaterThanOrEqual(0), expect(x.pct).toBeLessThanOrEqual(100)
    expect(t.find((x) => x.id === 'connections')).toMatchObject({ value: '2 of 11', pct: 25 })
  })
})

describe('issue history', () => {
  const issue = (id: string): OsIssue => ({ id, module: 'Connections', capability: 'local', title: id, detail: '', severity: 'low', to: '/', cta: '' })

  it('stamps a new issue once, resolves it when it disappears, and re-opens it if it returns', () => {
    let s = reconcile({ seen: {} }, [issue('a'), issue('b')], '2026-10-05T10:00:00Z')
    expect(Object.keys(s.seen)).toEqual(['a', 'b'])
    expect(reconcile(s, [issue('a'), issue('b')], '2026-10-05T11:00:00Z')).toBe(s) // nothing changed: same object, no write
    s = reconcile(s, [issue('a')], '2026-10-05T12:00:00Z')
    expect(s.seen.b!.resolvedAt).toBe('2026-10-05T12:00:00Z')
    expect(s.seen.a!.firstSeen).toBe('2026-10-05T10:00:00Z')
    s = reconcile(s, [issue('a'), issue('b')], '2026-10-05T13:00:00Z')
    expect(s.seen.b).toEqual({ title: 'b', module: 'Connections', firstSeen: '2026-10-05T13:00:00Z' })
  })

  it('records a resolved Google connection in the store', async () => {
    syncIssueHistory(collectIssues(me()))
    expect(resolvedIssues(noraOsStore.get())).toHaveLength(0)
    await connect('google')
    syncIssueHistory(collectIssues(me()))
    expect(resolvedIssues(noraOsStore.get()).map((r) => r.id)).toContain('conn:google')
    expect(connectionsStore.get().conns.google.connected).toBe(true)
  })

  it('Reset demo clears the history with the other modules', async () => {
    syncIssueHistory(collectIssues(me()))
    resetPresence()
    expect(noraOsStore.get().seen).toEqual({})
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { applyLocks, buildSchema, agentAddresses, agentHours, defaultHours, embedCode, geoFor, hoursSummary, isLocked, isOpenNow, schemaChecklist, schemaScore, validateHours } from '../details'
import { recommendedActions } from '../selectors'
import { actions, getState } from '../store'
import { profileSkill } from '../../skills/profile/actions'
import { buildGraph } from '../../mock/graph'

beforeEach(() => actions.reset())
const arj = () => getState().agents.arjunan!

describe('addresses', () => {
  it('seed has a primary and a second address; an older profile gets one derived from its location', () => {
    expect(agentAddresses(arj()).map((a) => a.label)).toEqual(['Main office', 'Solihull branch'])
    const old = { ...arj(), addresses: undefined }
    const [only] = agentAddresses(old)
    expect(only!.city).toBe('Birmingham')
    expect(only!.region).toBe('UK')
  })
  it('puts the demo pin at the same place every time, near the city', () => {
    const a = agentAddresses(arj())[0]!
    expect(geoFor(a)).toEqual(geoFor(a))
    expect(Math.abs(geoFor(a).lat - 52.4862)).toBeLessThan(0.03)
  })
})

describe('business hours', () => {
  it('validates times and summarises grouped days', () => {
    const h = defaultHours()
    expect(validateHours(h)).toEqual({})
    const bad = { ...h, days: h.days.map((d, i) => (i === 2 ? { ...d, from: '18:00', to: '09:00' } : d)) }
    expect(validateHours(bad)[2]).toMatch(/after/)
    expect(hoursSummary(h)).toBe('Mon to Fri 9:00 am to 5:30 pm; Sat 10:00 am to 2:00 pm')
    expect(hoursSummary({ ...h, days: h.days.map((d) => ({ ...d, open: false })) })).toBe('By appointment')
  })
  it('is open or closed according to the agent’s own time zone', () => {
    const h = agentHours(arj()) // Europe/London
    expect(isOpenNow(h, new Date('2026-10-05T11:00:00Z'))).toBe(true) // Monday 12:00 BST
    expect(isOpenNow(h, new Date('2026-10-05T20:00:00Z'))).toBe(false) // Monday 21:00 BST
    expect(isOpenNow(h, new Date('2026-10-04T11:00:00Z'))).toBe(false) // Sunday closed
    expect(isOpenNow({ ...h, timeZone: 'Asia/Kolkata' }, new Date('2026-10-05T04:00:00Z'))).toBe(true) // 09:30 IST
  })
})

describe('manager locks', () => {
  it('seed locks NMLS and company', () => {
    expect(isLocked(arj(), 'nmls')).toBe(true)
    expect(isLocked(arj(), 'about')).toBe(false)
  })
  it('an agent’s edit cannot change locked fields or the locks; a manager’s can', () => {
    const edit = { ...arj(), nmls: '999999', company: 'Other Co', title: 'Senior Loan Officer', lockedFields: [] }
    actions.saveProfile('arjunan', edit)
    expect(arj().nmls).toBe('1234567')
    expect(arj().company).toBe('New American Funding')
    expect(arj().title).toBe('Senior Loan Officer')
    expect(arj().lockedFields).toEqual(['nmls', 'company'])
    actions.saveProfile('arjunan', { ...arj(), nmls: '999999', lockedFields: ['nmls', 'about'] }, { manager: true })
    expect(arj().nmls).toBe('999999')
    expect(arj().lockedFields).toEqual(['nmls', 'about'])
  })
  it('locking a location field protects the address and the service areas', () => {
    const a = { ...arj(), lockedFields: ['location' as const] }
    const out = applyLocks(a, { ...a, city: 'Leeds', serviceAreas: [], addresses: [] }, false)
    expect(out.city).toBe('Birmingham')
    expect(out.serviceAreas).toEqual(['Birmingham', 'Solihull'])
  })
  it('NORA and recommendations leave locked fields alone', async () => {
    actions.patchAgent('arjunan', { about: '', specialties: ['Home Loans'] })
    const before = buildGraph()
    expect(profileSkill.evaluate(before).applies).toBe(true)
    actions.setLocks('arjunan', ['about', 'specialties'])
    expect(profileSkill.evaluate(buildGraph()).applies).toBe(false)
    expect(recommendedActions(arj()).map((x) => x.id)).not.toContain('bio')
    expect(recommendedActions(arj()).map((x) => x.id)).not.toContain('specialties')
    actions.patchAgent('arjunan', { about: 'NORA wrote this' })
    expect(arj().about).toBe('')
  })
})

describe('schema.org output', () => {
  it('describes the person and the business from the profile data', () => {
    const g = (buildSchema(arj(), 'https://x.test') as { '@graph': Record<string, unknown>[] })['@graph']
    const [person, biz] = g as [Record<string, any>, Record<string, any>]
    expect(person['@type']).toBe('Person')
    expect(person.name).toBe('Agent Arjunan')
    expect(person.aggregateRating.reviewCount).toBe(3)
    expect(person.url).toBe('https://x.test/profile/arjunan')
    expect(biz['@type']).toContain('LocalBusiness')
    expect(biz.address.streetAddress).toBe('45 Colmore Row')
    expect(biz.openingHoursSpecification[0].dayOfWeek.length).toBeGreaterThan(1)
    expect(biz.areaServed.map((c: { name: string }) => c.name)).toEqual(['Birmingham', 'Solihull'])
    expect(JSON.stringify(g)).not.toContain('undefined')
  })
  it('the checklist and score fall when data is missing', () => {
    const full = schemaScore(arj())
    expect(full).toBeGreaterThanOrEqual(80)
    const thin = { ...arj(), phone: '', reviews: [], addresses: undefined }
    expect(schemaScore(thin)).toBeLessThan(full)
    expect(schemaChecklist(thin).filter((c) => !c.ok).map((c) => c.id)).toEqual(expect.arrayContaining(['contact', 'address', 'rating']))
  })
})

describe('rank page formats', () => {
  it('each format makes an embed snippet that links to the rank page and escapes text', () => {
    const a = { ...arj(), name: 'A <b>' }
    for (const f of ['card', 'banner', 'reviews'] as const) {
      const code = embedCode(a, f, 'https://x.test')
      expect(code).toContain('href="https://x.test/rank/arjunan"')
      expect(code).not.toContain('<b>')
    }
    actions.setRankFormat('arjunan', 'banner')
    expect(arj().rankFormat).toBe('banner')
  })
})

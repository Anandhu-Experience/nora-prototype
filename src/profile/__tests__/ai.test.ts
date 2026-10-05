import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../mock/api'
import { resetDatabase, snapshotDatabase } from '../../mock/database'
import { generateSkillDraft, setDraftLatency } from '../../nora/generateSkillDraft'
import { NoraEngine } from '../../nora/noraEngine'
import { profileSkill } from '../../skills/profile/actions'
import type { DraftRequest } from '../../skills/types'
import { draftReviewReply, draftServiceCopy, templateReply, templateServiceCopy } from '../aiDrafts'
import { actions, getState } from '../store'

beforeEach(() => {
  api.setApiLatency(0)
  setDraftLatency(0)
  actions.reset()
  resetDatabase('profile-needed')
  vi.unstubAllGlobals()
})

const arj = () => getState().agents.arjunan!
const ok = (text: string, model = 'claude-opus-5-5') => vi.fn(async () => new Response(JSON.stringify({ text, model }), { status: 200 }))
const status = (code: number) => vi.fn(async () => new Response(JSON.stringify({ error: 'x' }), { status: code }))

const request = (): DraftRequest => ({
  skillId: 'profile-completion', model: 'opus-5-5', instruction: '',
  mockDraft: { summary: 's', changes: [{ label: 'Bio', before: 'Empty', after: 'TEMPLATE' }], payload: { bio: 'TEMPLATE' } },
  ai: { kind: 'bio', input: { x: 1 }, apply: (text, d) => { d.changes[0]!.after = text; (d.payload as { bio: string }).bio = text; return d } },
})

describe('generateSkillDraft', () => {
  it('uses the AI text, labelled with the model that wrote it, and posts only kind + input', async () => {
    const fetchImpl = ok('AI wrote this.')
    const d = await generateSkillDraft(request(), { fetchImpl })
    expect(d.source).toBe('ai')
    expect(d.model).toBe('claude-opus-5-5')
    expect(d.changes[0]!.after).toBe('AI wrote this.')
    expect((d.payload as { bio: string }).bio).toBe('AI wrote this.')
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/ai/draft')
    expect(JSON.parse(String(init.body))).toEqual({ kind: 'bio', input: { x: 1 }, skillId: 'profile-completion' }) // no prompt, no model, no key
  })

  it.each([
    [503, /No AI key/], [429, /busy/], [422, /declined/], [504, /timed out/], [500, /unavailable/],
  ])('falls back to the template on HTTP %i, and says why', async (code, why) => {
    const d = await generateSkillDraft(request(), { fetchImpl: status(code) })
    expect(d.source).toBe('mock')
    expect(d.note).toMatch(why)
    expect(d.changes[0]!.after).toBe('TEMPLATE')
  })

  it('falls back when the network fails, the body is junk, or the AI answers with nothing', async () => {
    expect((await generateSkillDraft(request(), { fetchImpl: vi.fn(async () => { throw new TypeError('offline') }) })).note).toMatch(/unreachable/)
    expect((await generateSkillDraft(request(), { fetchImpl: vi.fn(async () => new Response('not json', { status: 200 })) })).source).toBe('mock')
    expect((await generateSkillDraft(request(), { fetchImpl: ok('   ') })).source).toBe('mock')
  })

  it('gives up after the timeout instead of hanging the flow', async () => {
    const hang = vi.fn((_u: string, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
    const d = await generateSkillDraft(request(), { fetchImpl: hang as never, timeoutMs: 30 })
    expect(d.source).toBe('mock')
    expect(d.note).toMatch(/timed out/)
  })

  it('does not call the AI at all for requests without an ai block', async () => {
    const fetchImpl = ok('nope')
    const { ai: _ai, ...plain } = request()
    expect((await generateSkillDraft(plain, { fetchImpl })).source).toBe('mock')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('profile skill: the AI writes the bio, nothing else', () => {
  it('sends only profile facts (no contact details) and keeps specialties deterministic', async () => {
    const read = (await profileSkill.read!()) as never
    const v = profileSkill.validate!(read)
    const req = profileSkill.buildDraftRequest!(v)
    expect(req.ai!.kind).toBe('bio')
    const input = req.ai!.input as Record<string, unknown>
    expect(Object.keys(input).sort()).toEqual(['company', 'completedLoans', 'location', 'name', 'rating', 'reviewSnippets', 'services', 'specialties', 'title', 'yearsExperience'])
    expect(JSON.stringify(input)).not.toMatch(/@|\+44/) // email and phone are never included
    expect(JSON.stringify(input)).not.toContain('John Doe') // reviewer names are never included
    const draft = await generateSkillDraft(req, { fetchImpl: ok('AI bio about Birmingham mortgages.') })
    expect(draft.changes.map((c) => c.label)).toEqual(['Bio', 'Specialties'])
    expect(draft.changes[0]!.after).toBe('AI bio about Birmingham mortgages.')
    expect(draft.changes[1]!.after).toContain('FHA') // template specialties unchanged
    expect(draft.source).toBe('ai')
  })

  it('a bio is only requested when the bio is actually missing', async () => {
    actions.reset() // seed profile: it has a bio, and only specialties are short
    resetDatabase('live')
    const v = profileSkill.validate!((await profileSkill.read!()) as never)
    expect(profileSkill.buildDraftRequest!(v).ai).toBeUndefined()
  })
})

describe('NORA end to end with an AI-written bio', () => {
  it('shows the AI text for approval, writes nothing until approved, then saves it to the profile', async () => {
    vi.stubGlobal('fetch', ok('Warm, specific AI bio for Matt.'))
    const e = new NoraEngine({ stepDelayMs: 0 })
    await e.reset('profile-needed')
    const before = snapshotDatabase()
    await e.approveStart()
    const s = e.getState()
    expect(s.status).toBe('WRITE_APPROVAL')
    expect(s.draft!.source).toBe('ai')
    expect(s.draft!.changes[0]!.after).toBe('Warm, specific AI bio for Matt.')
    expect(snapshotDatabase()).toEqual(before) // the AI call changed nothing

    await e.approveWrite()
    expect(arj().about).toBe('Warm, specific AI bio for Matt.')
    expect(arj().activity[0]!.text).toBe('NORA updated your bio and specialties')
  })

  it('rejecting an AI draft leaves the profile untouched', async () => {
    vi.stubGlobal('fetch', ok('AI bio'))
    const e = new NoraEngine({ stepDelayMs: 0 })
    await e.reset('profile-needed')
    await e.approveStart()
    await e.rejectWrite()
    expect(arj().about).toBe('')
  })

  it('with the AI down the flow still works on the labelled template', async () => {
    vi.stubGlobal('fetch', status(503))
    const e = new NoraEngine({ stepDelayMs: 0 })
    await e.reset('profile-needed')
    await e.approveStart()
    expect(e.getState().draft!.source).toBe('mock')
    expect(e.getState().draft!.note).toMatch(/No AI key/)
    await e.approveWrite()
    expect(arj().about).toContain('Mortgage Loan Officer')
  })
})

describe('review reply drafts', () => {
  const review = () => arj().reviews[0]!

  it('sends the reviewer first name and rating, and returns the AI text', async () => {
    const fetchImpl = ok('Thank you John, glad it went smoothly.')
    const d = await draftReviewReply(arj(), review(), { fetchImpl })
    expect(d).toMatchObject({ text: 'Thank you John, glad it went smoothly.', source: 'ai', model: 'claude-opus-5-5' })
    const sent = JSON.parse(String(((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]).body))
    expect(sent.kind).toBe('review-reply')
    expect(sent.input).toMatchObject({ reviewerFirstName: 'John', rating: 5, agentFirstName: 'Matt' })
    expect(sent.input).not.toHaveProperty('reviewerFullName')
  })

  it('never posts anything by itself', async () => {
    const before = review().reply
    await draftReviewReply(arj(), review(), { fetchImpl: ok('Thanks!') })
    expect(arj().reviews[0]!.reply).toBe(before)
  })

  it('falls back to a rating-shaped template when AI is unavailable', async () => {
    const d = await draftReviewReply(arj(), review(), { fetchImpl: status(503) })
    expect(d.source).toBe('mock')
    expect(d.text).toBe(templateReply(review()))
    expect(templateReply({ ...review(), rating: 2 })).toMatch(/sorry|reach out/i)
    expect(templateReply({ ...review(), rating: 4 })).toMatch(/Thanks for the kind words/)
  })
})

describe('service copy drafts', () => {
  const svc = () => arj().services[1]! // Refinance
  const withFields = (blurb: string, description: string) =>
    vi.fn(async () => new Response(JSON.stringify({ text: description, model: 'claude-haiku-4-5-20251001', fields: { blurb, description } }), { status: 200 }))

  it('fills both fields from the AI and sends the service, the profile context and the existing copy', async () => {
    const fetchImpl = withFields('Lower your rate', 'I review your deal and handle the switch.')
    const d = await draftServiceCopy(arj(), svc(), { fetchImpl })
    expect(d).toMatchObject({ blurb: 'Lower your rate', description: 'I review your deal and handle the switch.', source: 'ai', model: 'claude-haiku-4-5-20251001' })
    const sent = JSON.parse(String(((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]).body))
    expect(sent.kind).toBe('service')
    expect(sent.input).toMatchObject({ serviceName: 'Refinance', agentFirstName: 'Matt', yearsExperience: 8 })
    expect(sent.input.existingTagline).toBe(svc().blurb)
    expect(JSON.stringify(sent)).not.toMatch(/@|\+44/) // no contact details
  })

  it('uses the profile as being edited, so unsaved changes count', async () => {
    const fetchImpl = withFields('x', 'y')
    await draftServiceCopy({ ...arj(), yearsExperience: 12, specialties: ['Jumbo'] }, svc(), { fetchImpl })
    const sent = JSON.parse(String(((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]).body))
    expect(sent.input).toMatchObject({ yearsExperience: 12, specialties: ['Jumbo'] })
  })

  it('falls back to a labelled generic template, never to invented specifics', async () => {
    const d = await draftServiceCopy(arj(), svc(), { fetchImpl: status(503) })
    expect(d.source).toBe('mock')
    expect(d.note).toMatch(/No AI key/)
    expect(d).toMatchObject(templateServiceCopy(svc()))
    expect(templateServiceCopy({ ...svc(), name: 'Bridging Loans' }).description).toBe('I help clients with bridging loans, explaining each option clearly and guiding you from the first conversation to completion.')
    expect(JSON.stringify(templateServiceCopy(svc()))).not.toMatch(/\d/) // no numbers it could not know
  })

  it('does not change the profile: the owner saves it themselves', async () => {
    const before = structuredClone(svc())
    await draftServiceCopy(arj(), svc(), { fetchImpl: withFields('a', 'b') })
    expect(arj().services[1]).toEqual(before)
  })
})

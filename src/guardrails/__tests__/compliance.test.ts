import { describe, expect, it, vi } from 'vitest'
import { createAiDraftHandler } from '../../../server/aiDraft.ts'
import { generateSkillDraft } from '../../nora/generateSkillDraft'
import { traceStore } from '../trace'
import { checkCompliance, complianceSummary } from '../compliance.ts'

describe('output compliance rules (mortgage profile)', () => {
  it('lets ordinary, warm replies through', () => {
    for (const t of [
      'Thank you so much, John! I truly appreciate your kind words about our communication.',
      'Thanks for the feedback, Tom. I am glad the refinance went smoothly and I am here if you need anything else.',
      'I help first-time buyers understand every option and stay with them until the keys are in their hands.',
    ]) expect(checkCompliance(t), t).toEqual({ status: 'pass', hits: [] })
  })

  it('blocks rate and APR claims, payment examples and guarantees', () => {
    const cases: [string, string][] = [
      ['Our rates start at 5.2% APR for everyone', 'rate-claim'],
      ['We offer rates as low as you will find', 'rate-claim'],
      ['A 30 year fixed mortgage at 6.1% interest', 'rate-claim'],
      ['Your monthly payment from $1,450 on a typical loan', 'payment-example'],
      ['Pay just £900 per month', 'payment-example'],
      ['We guarantee approval for every client', 'guarantee'],
      ['100% approval, no exceptions', 'guarantee'],
    ]
    for (const [text, rule] of cases) {
      const r = checkCompliance(text)
      expect(r.status, text).toBe('block')
      expect(r.hits.map((h) => h.rule), text).toContain(rule)
    }
  })

  it('blocks Fair Housing wording about areas and people', () => {
    for (const t of ['A family-friendly neighbourhood near the school', 'Perfect for young professionals', 'No children please', 'A safe neighborhood for you']) {
      expect(checkCompliance(t).status, t).toBe('block')
    }
  })

  it('warns, without blocking, on unproven "best" claims and client deal details', () => {
    const a = checkCompliance('We have the best rates in town')
    expect(a.status).toBe('warn')
    const b = checkCompliance('Glad the loan of $350,000 worked out for you')
    expect(b.status).toBe('warn')
    expect(b.hits[0]!.rule).toBe('client-details')
    expect(complianceSummary(b)).toMatch(/client/i)
  })
})

describe('the draft handler checks what the model wrote', () => {
  const fake = (text: string) => ({ client: { beta: { messages: { create: vi.fn(async (req: { model: string }) => ({ stop_reason: 'end_turn', model: req.model, content: [{ type: 'text', text }] })) } } } as never })
  const reply = { agentFirstName: 'Matt', agentTitle: 'Loan Officer', reviewerFirstName: 'Dana', rating: 5, reviewText: 'Great service' }

  it('answers 422 output_blocked for a draft that quotes a rate, and never returns the text', async () => {
    const r = await createAiDraftHandler(fake('Thanks Dana! Our rates start at 5.2% APR, call me.'))({ kind: 'review-reply', input: reply })
    expect(r.status).toBe(422)
    expect(r.body.error).toBe('output_blocked')
    expect(r.body.guardrail).toMatchObject({ method: 'compliance', code: 'rate-claim' })
    expect(r.body.text).toBeUndefined()
  })

  it('returns a flagged draft with its warnings when the rule only warns', async () => {
    const r = await createAiDraftHandler(fake('Thanks Dana! We always aim for the best rates for clients.'))({ kind: 'review-reply', input: reply })
    expect(r.status).toBe(200)
    expect(r.body.compliance?.status).toBe('warn')
  })
})

describe('the browser draft path', () => {
  const request = (fetchImpl: unknown) => ({
    request: { skillId: 'review-reply', model: 'haiku-4-5' as const, instruction: '', mockDraft: { summary: 's', changes: [], payload: { text: 'TEMPLATE' } }, ai: { kind: 'review-reply' as const, input: { agentFirstName: 'Matt', agentTitle: 'LO', reviewerFirstName: 'Dana', rating: 5, reviewText: 'Great' }, apply: (_t: string, d: never) => d } },
    opts: { fetchImpl: fetchImpl as never },
  })

  it('shows the template with the compliance reason and marks the trace step as blocked', async () => {
    traceStore.clear()
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: 'output_blocked', guardrail: { method: 'compliance', code: 'rate-claim', message: 'States an interest rate or APR.' } }), { status: 422 }))
    const { request: r, opts } = request(fetchImpl)
    const d = await generateSkillDraft(r as never, opts)
    expect(d.source).toBe('mock')
    expect(d.note).toMatch(/Blocked by compliance: States an interest rate/)
    const t = traceStore.get().traces[0]!
    expect(t.steps.find((s) => s.id === 'compliance')).toMatchObject({ status: 'block' })
    expect(t.outcome).toBe('blocked')
  })

  it('records a pass, or a flag, for a draft that reaches the user', async () => {
    traceStore.clear()
    const ok = vi.fn(async () => new Response(JSON.stringify({ text: 'Thank you Dana', model: 'claude-haiku-4-5', compliance: { status: 'pass', hits: [] } }), { status: 200 }))
    const { request: r, opts } = request(ok)
    await generateSkillDraft({ ...r, ai: { ...r.ai, apply: (_t: string, d: unknown) => d } } as never, opts)
    expect(traceStore.get().traces[0]!.steps.find((s) => s.id === 'compliance')).toMatchObject({ status: 'pass' })
  })
})

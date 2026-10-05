import { guardInput, validateAction, validateSkill } from '../guardrails'
import { startTrace, type Stage, type TraceHandle } from '../guardrails/trace'
import { AI_TASKS } from '../profile/aiTasks'
import type { Draft, DraftRequest } from '../skills/types'

/**
 * The single LLM abstraction. The model comes from the skill (request.model); NORA never picks one.
 *
 * With `request.ai`, it asks the server (POST /api/ai/draft, which holds the API key, the prompts and the
 * model) for the text. If that is unavailable for any reason (no key, rate limit, refusal, timeout,
 * offline), it returns the skill's template draft instead, labelled `source: 'mock'` with a reason, so the
 * approval flow never breaks and the UI never presents a template as AI output.
 */
let latencyMs = 600
export function setDraftLatency(ms: number): void {
  latencyMs = ms
}

export interface GenerateOptions {
  fetchImpl?: typeof fetch
  /** Give up on the AI service after this long. */
  timeoutMs?: number
  /** Add the steps to this run's trace instead of starting a new one (used by NORA's skill runs). */
  trace?: TraceHandle
}

const REASONS: Record<number, string> = {
  400: 'The request could not be built from your data.',
  422: 'The model declined this request.',
  429: 'The AI service is busy. Try again in a moment.',
  503: 'No AI key is configured.',
  504: 'The AI service timed out.',
}

async function askServer(request: DraftRequest, opts: GenerateOptions, tr: TraceHandle): Promise<Draft | string> {
  const ai = request.ai!
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000)
  try {
    const res = await fetchImpl('/api/ai/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: ai.kind, input: ai.input, skillId: request.skillId }),
      signal: controller.signal,
    })
    if (!res.ok) {
      if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as { error?: string; guardrail?: { method?: string; message?: string } } | null
        if (body?.error === 'guardrail_blocked') {
          tr.update('server', { status: 'block', detail: `Server guardrails blocked it (${body.guardrail?.method ?? 'check'})` })
          tr.update('llm', { status: 'skip', detail: 'Not called: blocked by the server guardrails' })
          return `Blocked by guardrails: ${body.guardrail?.message ?? 'this input cannot be used.'}`
        }
      }
      const reason = REASONS[res.status] ?? 'The AI service is unavailable.'
      tr.update('server', { status: 'pass', detail: 'Server guardrails passed' })
      tr.update('llm', { status: 'warn', detail: `Failed (HTTP ${res.status}). ${reason}` })
      return reason
    }
    const data = (await res.json()) as { text?: unknown; model?: unknown; fields?: unknown; guardrails?: { masked?: Record<string, number>; warnings?: string[] } }
    const m = data.guardrails?.masked ? Object.entries(data.guardrails.masked).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ') : ''
    tr.update('server', { status: 'pass', detail: m ? `Server guardrails passed. Masked ${m}` : 'Server guardrails passed' })
    if (typeof data.text !== 'string' || !data.text.trim()) return 'The AI service returned nothing usable.'
    const fields =
      typeof data.fields === 'object' && data.fields !== null && Object.values(data.fields).every((v) => typeof v === 'string')
        ? (data.fields as Record<string, string>)
        : undefined
    const draft = ai.apply(data.text, structuredClone(request.mockDraft), fields)
    tr.update('llm', { status: 'pass', detail: `${typeof data.model === 'string' ? data.model : 'model'} returned ${data.text.length} characters` })
    return { ...draft, source: 'ai', model: typeof data.model === 'string' ? data.model : undefined }
  } catch (e) {
    const why = (e as Error)?.name === 'AbortError' ? REASONS[504]! : 'The AI service is unreachable.'
    tr.update('server', { status: 'warn', detail: 'No answer from the server' })
    tr.update('llm', { status: 'warn', detail: why })
    return why
  } finally {
    clearTimeout(timer)
  }
}

export async function generateSkillDraft(request: DraftRequest, opts: GenerateOptions = {}): Promise<Draft> {
  if (request.model === 'none' && request.ai) {
    throw new Error(`Skill ${request.skillId} declares no model, so it cannot ask the AI for a draft`)
  }
  let note: string | undefined
  // inside a NORA run the steps join that run's trace (and its Guardrails + execute stage) instead of starting their own
  const nested = !!opts.trace
  const st = (s: Stage): Stage => (nested ? 'execute' : s)
  const fin = (t: TraceHandle, o: Parameters<TraceHandle['finish']>[0]) => { if (!nested) t.finish(o) }
  if (request.ai) {
    // flow trace: input -> input guardrails (browser) -> agent -> server guardrails -> LLM -> output
    const label = AI_TASKS[request.ai.kind].label
    const tr = opts.trace ?? startTrace('draft', label)
    if (!nested) tr.add({ id: 'input', stage: st('input'), label: 'Input', status: 'pass', detail: `${label} requested from "${request.skillId}"` })
    // the same guardrails run here first, so a blocked input gets its message at once and never leaves the browser
    const action = validateAction(request.skillId, request.ai.kind)
    tr.add({ id: 'action', stage: st('guardrails'), label: 'Action allow-list (browser)', status: action.ok ? 'pass' : 'block', detail: action.ok ? `${request.skillId} may request a ${request.ai.kind} draft` : action.message })
    if (!action.ok) {
      tr.add({ id: 'llm', stage: st('llm'), label: 'LLM', status: 'skip', detail: 'Not called: the action is not allowed' })
      tr.add({ id: 'output', stage: st('output'), label: 'Output', status: 'block', detail: action.message })
      fin(tr, 'blocked')
      return { ...structuredClone(request.mockDraft), source: 'mock', note: `Blocked by guardrails: ${action.message}` }
    }
    const guard = guardInput(request.ai.kind, request.ai.input)
    for (const c of guard.checks) tr.add({ id: c.id, stage: st('guardrails'), label: `${c.label} (browser)`, status: c.status, detail: c.detail })
    tr.add({ id: 'agent', stage: st('agent'), label: 'Agent builds the request', status: guard.allowed ? 'pass' : 'skip', detail: guard.allowed ? `Skill ${request.skillId}, model ${request.model}. Only the task kind and facts are sent` : 'Not run: blocked by the guardrails' })
    if (!guard.allowed) {
      tr.add({ id: 'server', stage: st('guardrails'), label: 'Server guardrails', status: 'skip', detail: 'Not reached' })
      tr.add({ id: 'llm', stage: st('llm'), label: 'LLM', status: 'skip', detail: 'Not called: nothing was sent' })
      tr.add({ id: 'output', stage: st('output'), label: 'Output', status: 'block', detail: `Template shown with the reason: ${guard.blocked!.message}` })
      fin(tr, 'blocked')
      await new Promise((r) => setTimeout(r, latencyMs))
      return { ...structuredClone(request.mockDraft), source: 'mock', note: `Blocked by guardrails: ${guard.blocked!.message}` }
    }
    request = { ...request, ai: { ...request.ai, input: guard.input } }
    tr.add({ id: 'server', stage: st('guardrails'), label: 'Server guardrails (second check)', status: 'pending', detail: 'Waiting for the server' })
    tr.add({ id: 'llm', stage: st('llm'), label: 'LLM', status: 'pending', detail: 'Waiting for the model…' })
    tr.add({ id: 'output', stage: st('output'), label: 'Output', status: 'pending', detail: '' })
    const result = await askServer(request, opts, tr)
    if (typeof result !== 'string') {
      tr.update('output', { status: 'info', detail: 'Length and format checks passed. Labelled "AI draft". Waits for your approval. No content-compliance check yet.' })
      fin(tr, 'ai')
      return result
    }
    note = result
    tr.update('output', { status: result.startsWith('Blocked') ? 'block' : 'info', detail: `Template shown, labelled with the reason: ${result}` })
    fin(tr, result.startsWith('Blocked') ? 'blocked' : 'template')
  }
  else {
    // a guided skill with no AI task still gets a trace, so the Flow panel shows what ran and what did not apply
    const tr = opts.trace ?? startTrace('draft', request.mockDraft.summary || request.skillId)
    if (!nested) tr.add({ id: 'input', stage: st('input'), label: 'Input', status: 'pass', detail: `Draft requested from "${request.skillId}" by a button, nothing typed` })
    const skill = validateSkill(request.skillId)
    tr.add({ id: 'action', stage: st('guardrails'), label: 'Action allow-list (browser)', status: skill.ok ? 'pass' : 'block', detail: skill.ok ? `${request.skillId} is a known skill` : skill.message })
    if (!skill.ok) {
      tr.add({ id: 'llm', stage: st('llm'), label: 'LLM', status: 'skip', detail: 'Not called: the action is not allowed' })
      tr.add({ id: 'output', stage: st('output'), label: 'Output', status: 'block', detail: skill.message })
      fin(tr, 'blocked')
      return { ...structuredClone(request.mockDraft), source: 'mock', note: `Blocked by guardrails: ${skill.message}` }
    }
    tr.add({ id: 'text', stage: st('guardrails'), label: 'Mask, injection, safety, scope', status: 'skip', detail: 'No typed text. The draft uses your saved profile fields and fixed rules, so there is nothing to check' })
    tr.add({ id: 'agent', stage: st('agent'), label: 'Agent builds the draft', status: 'pass', detail: `Skill ${request.skillId} fills the change from your profile data with fixed rules` })
    tr.add({ id: 'llm', stage: st('llm'), label: 'LLM', status: 'skip', detail: 'Not called: this skill uses a template, not the AI model' })
    tr.add({ id: 'output', stage: st('output'), label: 'Output', status: 'info', detail: 'Before and after shown. Nothing is saved until you approve' })
    fin(tr, 'template')
  }
  await new Promise((r) => setTimeout(r, latencyMs))
  return { ...structuredClone(request.mockDraft), source: 'mock', note }
}

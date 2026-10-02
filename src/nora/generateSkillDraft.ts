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
}

const REASONS: Record<number, string> = {
  400: 'The request could not be built from your data.',
  422: 'The model declined this request.',
  429: 'The AI service is busy. Try again in a moment.',
  503: 'No AI key is configured.',
  504: 'The AI service timed out.',
}

async function askServer(request: DraftRequest, opts: GenerateOptions): Promise<Draft | string> {
  const ai = request.ai!
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000)
  try {
    const res = await fetchImpl('/api/ai/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: ai.kind, input: ai.input }),
      signal: controller.signal,
    })
    if (!res.ok) return REASONS[res.status] ?? 'The AI service is unavailable.'
    const data = (await res.json()) as { text?: unknown; model?: unknown; fields?: unknown }
    if (typeof data.text !== 'string' || !data.text.trim()) return 'The AI service returned nothing usable.'
    const fields =
      typeof data.fields === 'object' && data.fields !== null && Object.values(data.fields).every((v) => typeof v === 'string')
        ? (data.fields as Record<string, string>)
        : undefined
    const draft = ai.apply(data.text, structuredClone(request.mockDraft), fields)
    return { ...draft, source: 'ai', model: typeof data.model === 'string' ? data.model : undefined }
  } catch (e) {
    return (e as Error)?.name === 'AbortError' ? REASONS[504]! : 'The AI service is unreachable.'
  } finally {
    clearTimeout(timer)
  }
}

export async function generateSkillDraft(request: DraftRequest, opts: GenerateOptions = {}): Promise<Draft> {
  if (request.model === 'none') {
    throw new Error(`Skill ${request.skillId} declares no model, so it cannot generate a draft`)
  }
  let note: string | undefined
  if (request.ai) {
    const result = await askServer(request, opts)
    if (typeof result !== 'string') return result
    note = result
  }
  await new Promise((r) => setTimeout(r, latencyMs))
  return { ...structuredClone(request.mockDraft), source: 'mock', note }
}

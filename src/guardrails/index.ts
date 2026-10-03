import type { AiTaskKind } from '../profile/aiTasks.ts'
import { detectInjection, neutralizeDelimiters } from './injection.ts'
import { maskText, maskTotal, mergeCounts, type MaskCounts } from './mask.ts'
import { checkSafety, SAFETY_MESSAGE } from './safety.ts'
import { checkScope, SCOPE_MESSAGE, type ScopeMode } from './scope.ts'

export { maskText, detectInjection, neutralizeDelimiters, checkSafety, checkScope }
export type { MaskCounts, ScopeMode }

/**
 * Input guardrails: mask sensitive information, detect prompt injection, check content safety, validate scope.
 * Plain TypeScript with no dependencies, so the server (authoritative) and the browser (instant feedback) share one copy.
 */
export type GuardMethod = 'injection' | 'safety' | 'scope'
export interface Blocked { method: GuardMethod; code: string; message: string }
export type CheckStatus = 'pass' | 'warn' | 'block' | 'skip'
/** One of the four checks, as shown in the flow trace. `warn` means it changed or flagged something without blocking. */
export interface GuardCheck { id: 'mask' | 'injection' | 'safety' | 'scope'; label: string; status: CheckStatus; detail: string }
export interface GuardResult<T> {
  allowed: boolean
  /** The four checks in pipeline order with what each found. */
  checks: GuardCheck[]
  /** A sanitized copy: masked, neutralized, profanity starred. */
  input: T
  /** Counts per type of what was masked. Never the values. */
  masked: MaskCounts
  warnings: string[]
  blocked?: Blocked
}

export type GuardKind = AiTaskKind | 'chat'

interface Spec {
  /** Top-level fields holding free text from people or from reviews: masked and safety-checked. */
  free: string[]
  /** Fields that must be in scope (the user's own request). */
  scope?: string[]
  /** Arrays whose bad items are dropped instead of blocking the whole request. */
  dropItems?: string[]
}
const SPEC: Record<AiTaskKind, Spec> = {
  bio: { free: ['reviewSnippets'], dropItems: ['reviewSnippets'] },
  'review-reply': { free: ['reviewText'] },
  service: { free: ['existingTagline', 'existingDescription'] },
  meta: { free: [] },
  article: { free: ['topic'], scope: ['topic'] },
  faq: { free: ['question'], scope: ['question'] },
}

const INJECTION_MESSAGE = 'That text looks like an attempt to change my instructions, so I did not use it.'
const SCOPE_BY_CODE: Record<string, string> = { no_domain_term: 'That topic is outside mortgage and home finance. Try a question about loans, buying, refinancing or your own services.' }
export const scopeMessage = (code: string): string => SCOPE_BY_CODE[code] ?? SCOPE_MESSAGE

const LABEL: Record<GuardCheck['id'], string> = { mask: 'Mask sensitive data', injection: 'Detect prompt injection', safety: 'Content safety', scope: 'Scope validation' }
const maskDetail = (c: MaskCounts): string => Object.entries(c).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ')

/** Checks one string in the documented order: mask, injection, safety, scope. Returns the cleaned text, or what blocked it. */
function checkOne(text: string, opts: { free: boolean; scope?: ScopeMode }): { text: string; masked: MaskCounts; warnings: string[]; blocked?: Blocked; checks: GuardCheck[] } {
  const warnings: string[] = []
  const checks: GuardCheck[] = []
  const add = (id: GuardCheck['id'], status: CheckStatus, detail: string) => checks.push({ id, label: LABEL[id], status, detail })
  const finish = (blocked: Blocked | undefined, out: string, masked: MaskCounts) => {
    for (const id of ['mask', 'injection', 'safety', 'scope'] as const) if (!checks.some((c) => c.id === id)) add(id, 'skip', blocked ? 'Not run: an earlier check blocked the input' : 'Not needed here')
    checks.sort((a, b) => ['mask', 'injection', 'safety', 'scope'].indexOf(a.id) - ['mask', 'injection', 'safety', 'scope'].indexOf(b.id))
    return { text: out, masked, warnings, blocked, checks }
  }

  let out = text
  let masked: MaskCounts = {}
  if (opts.free) {
    const m = maskText(out)
    out = m.text
    masked = m.counts
    add('mask', maskTotal(masked) ? 'warn' : 'pass', maskTotal(masked) ? `Masked ${maskDetail(masked)}` : 'No sensitive details found')
  }
  const inj = detectInjection(text) // on the original, so a fence break-out is still seen
  out = neutralizeDelimiters(out)
  if (inj.level === 'block') {
    add('injection', 'block', `Score ${inj.score}: ${inj.matches.map((x) => x.id).join(', ')}`)
    return finish({ method: 'injection', code: inj.matches[0]?.id ?? 'injection', message: INJECTION_MESSAGE }, out, masked)
  }
  if (inj.level === 'suspicious') {
    warnings.push('Part of the text looks like an instruction to the assistant and was treated as plain text.')
    add('injection', 'warn', `Score ${inj.score}: ${inj.matches.map((x) => x.id).join(', ')}. Treated as plain text`)
  } else add('injection', 'pass', 'No instruction-like text found')
  if (opts.free) {
    const s = checkSafety(out)
    if (s.category) {
      add('safety', 'block', `Category: ${s.category}`)
      return finish({ method: 'safety', code: s.category, message: SAFETY_MESSAGE[s.category] }, out, masked)
    }
    if (s.profanity) { warnings.push('Strong language was starred out.'); add('safety', 'warn', `Starred out ${s.profanity} strong word${s.profanity === 1 ? '' : 's'}`) } else add('safety', 'pass', 'No unsafe content found')
    out = s.text
  }
  if (opts.scope) {
    const sc = checkScope(out, opts.scope)
    if (!sc.ok) {
      add('scope', 'block', `${opts.scope} mode: ${sc.code}`)
      return finish({ method: 'scope', code: sc.code!, message: scopeMessage(sc.code!) }, out, masked)
    }
    add('scope', 'pass', `In scope (${opts.scope} mode)`)
  }
  return finish(undefined, out, masked)
}

const RANK: Record<CheckStatus, number> = { skip: 0, pass: 1, warn: 2, block: 3 }
/** Combines the per-field checks into one row per check, keeping the worst status. */
function mergeChecks(all: GuardCheck[][]): GuardCheck[] {
  return (['mask', 'injection', 'safety', 'scope'] as const).map((id) => {
    const rows = all.flat().filter((c) => c.id === id)
    if (!rows.length) return { id, label: LABEL[id], status: 'skip' as const, detail: 'Nothing to check in this request' }
    const worst = rows.reduce((a, b) => (RANK[b.status] > RANK[a.status] ? b : a))
    const details = [...new Set(rows.filter((r) => r.status === worst.status).map((r) => r.detail))]
    return { id, label: LABEL[id], status: worst.status, detail: details.slice(0, 3).join(' · ') }
  })
}

/** Guard the structured input of an AI draft request. Pure: the original is not modified. */
export function guardInput<T>(kind: AiTaskKind, input: T): GuardResult<T> {
  if (typeof input !== 'object' || input === null) return { allowed: true, checks: [], input, masked: {}, warnings: [] }
  const spec = SPEC[kind]
  const copy = structuredClone(input) as Record<string, unknown>
  let masked: MaskCounts = {}
  const warnings = new Set<string>()
  const rows: GuardCheck[][] = []
  let blocked: Blocked | undefined

  const visit = (key: string, value: unknown): unknown => {
    if (blocked) return value
    if (typeof value === 'string') {
      const r = checkOne(value, { free: spec.free.includes(key), scope: spec.scope?.includes(key) ? 'strict' : undefined })
      rows.push(r.checks.filter((c) => c.status !== 'skip' || r.blocked))
      masked = mergeCounts(masked, r.masked)
      r.warnings.forEach((w) => warnings.add(w))
      if (r.blocked) blocked = r.blocked
      return r.text
    }
    if (Array.isArray(value)) {
      const drop = spec.dropItems?.includes(key)
      const out: unknown[] = []
      for (const item of value) {
        const keep = visit(key, item)
        if (drop && blocked) {
          blocked = undefined
          warnings.add('One item was left out because it could not be used safely.')
          continue
        }
        out.push(keep)
      }
      return out
    }
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, visit(key, v) ?? v]))
    return value
  }
  for (const k of Object.keys(copy)) copy[k] = visit(k, copy[k])
  return { allowed: !blocked, checks: mergeChecks(rows), input: copy as T, masked, warnings: [...warnings], blocked }
}

/** Guard a NORA chat message. Scope is lenient: only clearly unrelated requests are refused. */
export function guardChat(text: string): GuardResult<string> {
  const r = checkOne(text, { free: true, scope: 'lenient' })
  return { allowed: !r.blocked, checks: r.checks, input: r.text, masked: r.masked, warnings: r.warnings, blocked: r.blocked }
}

export { maskTotal }

/** One short sentence about what was masked, for the notice under a draft or chat message. */
export function maskNotice(c: MaskCounts): string {
  const n = maskTotal(c)
  return n ? `I hid ${n} sensitive detail${n === 1 ? '' : 's'} (${Object.keys(c).join(', ').toLowerCase()}) before using your text.` : ''
}

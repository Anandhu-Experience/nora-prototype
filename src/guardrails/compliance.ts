/**
 * Output compliance: what the model (or the user, when editing) wrote is checked before it can be shown as ready to post.
 * Deterministic rules first, per the vertical's compliance profile (mortgage here). A block stops the text; a warning is
 * shown to the user and the human approval that every write already needs stays in place. A classifier pass for what the
 * rules cannot see is not built yet. These are planning rules for the prototype; legal must review them before launch.
 */
export type ComplianceStatus = 'pass' | 'warn' | 'block'
export interface ComplianceHit { rule: string; level: 'warn' | 'block'; message: string; match: string }
export interface ComplianceResult { status: ComplianceStatus; hits: ComplianceHit[] }

interface Rule { id: string; level: 'warn' | 'block'; message: string; re: RegExp }

/** Mortgage profile: advertising rules (Reg Z), Fair Housing wording, and customer privacy. */
const MORTGAGE: Rule[] = [
  { id: 'rate-claim', level: 'block', message: 'States an interest rate or APR. Rates need full disclosures and a human to write them.', re: /\b\d+(?:\.\d+)?\s?%\s*(?:apr|interest|rate|fixed|variable|mortgage)|\b(?:apr|interest rate|rate)\b[^.!?]{0,24}\d+(?:\.\d+)?\s?%|\brates?\s+(?:as low as|from|starting)/i },
  { id: 'payment-example', level: 'block', message: 'Gives a payment example. Payment figures need full disclosures.', re: /\b(?:monthly\s+)?payments?\s+(?:of|from|as low as)\s*[£$€]?\s?\d|[£$€]\s?\d[\d,]*\s*(?:a|per|\/)\s*month\b/i },
  { id: 'guarantee', level: 'block', message: 'Guarantees an approval, rate or saving.', re: /\bguarantee[sd]?\b[^.!?]{0,30}\b(?:approval|approved|rate|loan|mortgage|saving|savings)\b|\b100\s?%\s*(?:approval|approved)|\beveryone\s+(?:is\s+)?(?:approved|qualifies)/i },
  { id: 'fair-housing', level: 'block', message: 'Describes people or areas in a way Fair Housing rules do not allow.', re: /\bfamily[- ]friendly\s+(?:area|neighbou?rhood|community)|\bperfect\s+for\s+(?:young\s+)?(?:families|singles|couples|professionals|retirees)\b|\bno\s+(?:children|kids)\b|\b(?:christian|muslim|jewish|white|black|hispanic|asian)\s+(?:area|neighbou?rhood|community|clients?|buyers?)\b|\b(?:safe|exclusive|desirable)\s+neighbou?rhood\b|\b(?:young|elderly|senior)s?\s+only\b/i },
  { id: 'superlative', level: 'warn', message: 'Makes a "best" or "lowest" claim that needs proof.', re: /\b(?:best|lowest|cheapest)\s+(?:rates?|prices?|deals?|mortgages?|fees?)\b|\b(?:no|zero)\s+(?:closing\s+costs|fees)\b/i },
  { id: 'client-details', level: 'warn', message: 'Mentions a loan amount or deal detail about a client. Keep client details private.', re: /\b(?:loan|mortgage|deposit|down\s*payment)\s+(?:of|for)\s+[£$€]\s?\d|[£$€]\s?\d{2,3}(?:,\d{3})+\b/i },
]

export function checkCompliance(text: string): ComplianceResult {
  const hits: ComplianceHit[] = []
  for (const r of MORTGAGE) {
    const m = r.re.exec(text)
    if (m) hits.push({ rule: r.id, level: r.level, message: r.message, match: m[0].trim() })
  }
  const status: ComplianceStatus = hits.some((h) => h.level === 'block') ? 'block' : hits.length ? 'warn' : 'pass'
  return { status, hits }
}

/** One sentence for the user, from the most serious hits. */
export const complianceSummary = (r: ComplianceResult): string =>
  r.hits
    .filter((h) => h.level === (r.status === 'block' ? 'block' : 'warn'))
    .map((h) => h.message)
    .join(' ')

/** Method 1: mask sensitive information. Replaces personal and financial details with typed placeholders. Only counts are kept, never the values. */
export type MaskType = 'EMAIL' | 'PHONE' | 'SSN' | 'CARD' | 'ACCOUNT' | 'DOB' | 'ID' | 'SECRET' | 'ADDRESS' | 'IP'
export type MaskCounts = Partial<Record<MaskType, number>>

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?'

const luhn = (digits: string): boolean => {
  let sum = 0, dbl = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (dbl && (d *= 2) > 9) d -= 9
    sum += d
    dbl = !dbl
  }
  return sum % 10 === 0
}
const digitsOf = (s: string): string => s.replace(/\D/g, '')

export function maskText(input: string): { text: string; counts: MaskCounts } {
  const counts: MaskCounts = {}
  const bump = (t: MaskType) => { counts[t] = (counts[t] ?? 0) + 1 }
  let text = input
  const sub = (type: MaskType, re: RegExp, fn: (m: string, ...g: string[]) => string | null) => {
    text = text.replace(re, (m, ...g) => {
      const out = fn(m, ...(g as string[]))
      if (out === null) return m
      bump(type)
      return out
    })
  }

  // order matters: long, specific patterns first so phone numbers do not swallow them
  sub('SECRET', /\bsk-[A-Za-z0-9_-]{16,}/g, () => '[SECRET]')
  sub('SECRET', /\b(?:ghp|gho|xox[bp])[-_][A-Za-z0-9_-]{16,}/g, () => '[SECRET]')
  sub('SECRET', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, () => '[SECRET]')
  sub('SECRET', /\b(password|passcode|pin)\b(\s*(?:is|=|:)\s*)\S+/gi, (_m, label: string, sep: string) => `${label}${sep}[SECRET]`)
  sub('EMAIL', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, () => '[EMAIL]')
  sub('CARD', /\b(?:\d[ -]?){13,19}\b/g, (m) => {
    const d = digitsOf(m)
    return d.length >= 13 && d.length <= 19 && luhn(d) ? `[CARD]${/[ -]$/.test(m) ? m.slice(-1) : ''}` : null
  })
  sub('SSN', /\b\d{3}-\d{2}-\d{4}\b/g, () => '[SSN]')
  sub('SSN', /\b(ssn|social security(?: number)?)(\D{0,15})\d{9}\b/gi, (_m, label: string, sep: string) => `${label}${sep}[SSN]`)
  sub('DOB', new RegExp(`\\b(dob|date of birth|born(?: on)?)\\b([^.\\n]{0,12}?)(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|${MONTH} \\d{1,2},? \\d{4}|\\d{1,2} ${MONTH},? \\d{4})`, 'gi'), (_m, label: string, sep: string) => `${label}${sep}[DOB]`)
  sub('ACCOUNT', /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?\b/g, (m) => (digitsOf(m).length >= 8 ? '[ACCOUNT]' : null))
  sub('ACCOUNT', /\b(account|acct|routing|sort code|iban|swift)\b([^.\n\d]{0,20}?)(\d[\d -]{5,18}\d)/gi, (_m, label: string, sep: string) => `${label}${sep}[ACCOUNT]`)
  sub('ID', /\b(loan|application|case|file|reference|ref|claim|policy)(\s*(?:no\.?|number|#|id)?\s*[:#]?\s*)([A-Z0-9][A-Z0-9-]{5,})/gi, (_m, label: string, sep: string, id: string) => (/\d/.test(id) ? `${label}${sep}[ID]` : null))
  sub('IP', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, () => '[IP]')
  sub('ADDRESS', /\b\d{1,5}[A-Za-z]?\s+(?:[A-Z][A-Za-z']+\s){1,3}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Way|Close|Row|Place|Pl)\b\.?/g, () => '[ADDRESS]')
  sub('PHONE', /(?<![\w.])(?<!\d[\s-])(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\w|[\s.-]\d)/g, (m) => {
    const n = digitsOf(m).length
    return n >= 10 && n <= 13 ? '[PHONE]' : null
  })
  return { text, counts }
}

export const maskTotal = (c: MaskCounts): number => Object.values(c).reduce((n, v) => n + (v ?? 0), 0)
export const mergeCounts = (a: MaskCounts, b: MaskCounts): MaskCounts => {
  const out: MaskCounts = { ...a }
  for (const [k, v] of Object.entries(b)) out[k as MaskType] = (out[k as MaskType] ?? 0) + (v ?? 0)
  return out
}

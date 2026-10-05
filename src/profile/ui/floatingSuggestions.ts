import { useSyncExternalStore } from 'react'
import type { Suggestion } from './kit'

/**
 * The suggestions of the page you are on, handed to the floating NORA button. A page's "NORA suggests" strip registers them
 * (see AiInsightBar) and removes them when you leave. Listeners are notified only when what is shown changes, and the click
 * handlers are kept current without notifying, so ordinary re-renders cost nothing.
 */
const entries = new Map<string, { items: Suggestion[]; signature: string }>()
let snapshot: Suggestion[] = []
let lastSignature = ''
const listeners = new Set<() => void>()

const signatureOf = (items: Suggestion[]): string => items.map((s) => `${s.id}|${s.title}|${s.detail}|${s.cta}|${s.impact ?? ''}`).join('\n')

function refresh(): void {
  const all = [...entries.values()].flatMap((e) => e.items)
  const signature = [...entries.values()].map((e) => e.signature).join('\n--\n')
  if (signature !== lastSignature) {
    lastSignature = signature
    snapshot = all
    listeners.forEach((l) => l())
  } else {
    snapshot.forEach((s, i) => { s.onRun = all[i]!.onRun })
  }
}

export function setPageSuggestions(owner: string, items: Suggestion[]): void {
  entries.set(owner, { items, signature: signatureOf(items) })
  refresh()
}
export function clearPageSuggestions(owner: string): void {
  if (entries.delete(owner)) refresh()
}
export const getPageSuggestions = (): Suggestion[] => snapshot
export const subscribePageSuggestions = (fn: () => void): (() => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const usePageSuggestions = (): Suggestion[] => useSyncExternalStore(subscribePageSuggestions, getPageSuggestions)

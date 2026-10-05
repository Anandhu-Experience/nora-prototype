import { useSyncExternalStore } from 'react'

/** Whether NORA's suggestion cards are tucked away. Remembered in the browser; shared so the panel can shrink when they are hidden. */
const HIDE_KEY = 'nora-suggestions-hidden'
const hideListeners = new Set<() => void>()
const readHidden = (): boolean => { try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false } }
let hiddenNow = readHidden()
export const suggestionsHidden = {
  get: () => hiddenNow,
  set: (v: boolean) => { hiddenNow = v; try { localStorage.setItem(HIDE_KEY, v ? '1' : '0') } catch { /* storage unavailable */ } hideListeners.forEach((l) => l()) },
  use: (): boolean => useSyncExternalStore((fn) => { hideListeners.add(fn); return () => { hideListeners.delete(fn) } }, () => hiddenNow),
}

import { useSyncExternalStore } from 'react'

/**
 * A tiny persisted external store (same pattern as the Profile store). Each module of the app (listings,
 * connections, website audit, AI visibility, network) owns one, so the pages stay independent while
 * "Reset demo" can still restore all of them.
 */
export interface PersistedStore<T> {
  get: () => T
  set: (next: T | ((s: T) => T)) => void
  subscribe: (fn: () => void) => () => void
  /** React hook returning the current state. */
  use: () => T
  reset: () => void
}

const resets = new Set<() => void>()
const allListeners = new Set<() => void>()

/** Restore every module store to its seed (Reset demo). */
export function resetPresence(): void {
  resets.forEach((r) => r())
}

/** Subscribe to changes in ANY module store (used by the Search Rank Score, which reads all of them). */
export const subscribeAllPresence = (fn: () => void): (() => void) => {
  allListeners.add(fn)
  return () => allListeners.delete(fn)
}

export function createStore<T>(key: string, seed: () => T): PersistedStore<T> {
  const load = (): T => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      /* storage unavailable or corrupt: use the seed */
    }
    return seed()
  }
  let state = load()
  const listeners = new Set<() => void>()
  const commit = (next: T) => {
    state = next
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* quota: keep working in memory */
    }
    listeners.forEach((l) => l())
    allListeners.forEach((l) => l())
  }
  const store: PersistedStore<T> = {
    get: () => state,
    set: (next) => commit(typeof next === 'function' ? (next as (s: T) => T)(state) : next),
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    use: () => useSyncExternalStore(store.subscribe, store.get),
    reset: () => commit(seed()),
  }
  resets.add(store.reset)
  return store
}

export const uid = (p: string): string => `${p}-${Math.random().toString(36).slice(2, 9)}`
export const nowIso = (): string => new Date().toISOString()
/** Mock network latency. Tests set it to 0. */
export let latency = 600
export const setLatency = (ms: number): void => { latency = ms }
export const wait = (ms = latency): Promise<void> => new Promise((r) => setTimeout(r, ms))

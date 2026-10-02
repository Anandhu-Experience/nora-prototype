import { useSyncExternalStore } from 'react'

/**
 * Mock authentication for the prototype: there is no server. One demo account, and the
 * "session" is a flag in localStorage. Not real security; do not reuse.
 */
export const DEMO_ACCOUNT = { email: 'arjunan@newamerican.example', password: 'demo1234' } as const

const KEY = 'nora-auth'
const listeners = new Set<() => void>()

const read = (): boolean => {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
let authed = read()

const set = (v: boolean) => {
  authed = v
  try { v ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY) } catch { /* storage unavailable: session lasts until reload */ }
  listeners.forEach((l) => l())
}

/** A new login should be greeted by NORA again (NoraProvider opens when this flag is absent). */
const clearGreeting = () => {
  try { sessionStorage.removeItem('nora-greeted') } catch { /* ignore */ }
}

export type LoginResult = { ok: true } | { ok: false; error: string }

export function login(email: string, password: string): LoginResult {
  if (!email.trim() || !password) return { ok: false, error: 'Enter your email and password.' }
  if (email.trim().toLowerCase() !== DEMO_ACCOUNT.email || password !== DEMO_ACCOUNT.password) {
    return { ok: false, error: 'Incorrect email or password.' }
  }
  clearGreeting()
  set(true)
  return { ok: true }
}

const SIGNED_OUT = 'nora-signedout'

export function logout(): void {
  clearGreeting()
  // The route guard redirects the moment the session ends, so the "signed out" notice rides in the session, not the URL.
  try { sessionStorage.setItem(SIGNED_OUT, '1') } catch { /* ignore */ }
  set(false)
}

/** True once after a sign-out; read it in render, clear it in an effect (StrictMode renders twice). */
export const peekSignedOut = (): boolean => {
  try { return sessionStorage.getItem(SIGNED_OUT) === '1' } catch { return false }
}
export const clearSignedOut = (): void => {
  try { sessionStorage.removeItem(SIGNED_OUT) } catch { /* ignore */ }
}

export const useAuth = (): boolean =>
  useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn) }, () => authed)

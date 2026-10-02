import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'nora-theme'
const listeners = new Set<() => void>()

const read = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')

/** The `dark` class on <html> is the source of truth; index.html sets it before first paint. */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    read,
  )
  const toggle = useCallback(() => {
    const next: Theme = read() === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    listeners.forEach((l) => l())
  }, [])
  return { theme, toggle }
}

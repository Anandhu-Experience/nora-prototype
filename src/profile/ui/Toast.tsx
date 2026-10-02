import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Tone = 'success' | 'info' | 'error'
interface Toast { id: number; text: string; tone: Tone }
type Push = (text: string, tone?: Tone) => void

const Ctx = createContext<Push>(() => {})
export const useToast = (): Push => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback<Push>((text, tone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  const value = useMemo(() => push, [push])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg">
            {t.tone === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : t.tone === 'error' ? <XCircle size={16} className="text-rose-400" /> : <Info size={16} className="text-sky-300" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

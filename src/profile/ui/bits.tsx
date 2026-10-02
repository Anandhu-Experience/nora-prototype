import { Star } from 'lucide-react'
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { initials } from '../selectors'
import type { Agent } from '../types'

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const row = (cls: string) => (
    <div className="flex">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} className={cls} fill="currentColor" strokeWidth={0} />
      ))}
    </div>
  )
  return (
    <div className="relative inline-block" role="img" aria-label={`${rating.toFixed(2)} out of 5 stars`}>
      <div className="text-slate-200">{row('')}</div>
      <div className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${(rating / 5) * 100}%` }}>
        <div className="w-max">{row('')}</div>
      </div>
    </div>
  )
}

const TONES = ['from-emerald-500 to-green-700', 'from-sky-500 to-blue-700', 'from-violet-500 to-purple-700', 'from-rose-500 to-pink-700', 'from-amber-500 to-orange-700']

export function Avatar({ agent, size = 40, online }: { agent: Pick<Agent, 'id' | 'name' | 'photoUrl'>; size?: number; online?: boolean }) {
  const tone = TONES[[...agent.id].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length]
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {agent.photoUrl ? (
        <img src={agent.photoUrl} alt={agent.name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${tone}`} style={{ fontSize: size * 0.36 }} aria-label={agent.name}>
          {initials(agent.name)}
        </div>
      )}
      {online && <span className="absolute bottom-[6%] right-[6%] h-[16%] w-[16%] min-h-2.5 min-w-2.5 rounded-full border-2 border-white bg-emerald-500" />}
    </div>
  )
}

export function useDismiss(ref: RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [ref, onClose, active])
}

/** A dropdown that closes on outside click / Escape. */
export function Popover({ open, onClose, children, align = 'right', width = 'w-56', position }: { open: boolean; onClose: () => void; children: ReactNode; align?: 'left' | 'right'; width?: string; position?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, onClose, open)
  if (!open) return null
  return (
    <div ref={ref} className={`absolute z-40 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg ${width} ${position ?? `top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'}`}`}>
      {children}
    </div>
  )
}

export const MENU_ITEM = 'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50'

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  )
}

export function readImage(file: File, maxBytes = 1_500_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'))
    if (file.size > maxBytes) return reject(new Error('Image is too large (max 1.5 MB).'))
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read that file.'))
    r.readAsDataURL(file)
  })
}

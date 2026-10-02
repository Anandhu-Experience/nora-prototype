import { BarChart3, Briefcase, Calculator, Home, KeyRound, ShieldCheck } from 'lucide-react'
import type { ServiceIcon } from '../types'

const MAP = {
  home: { Icon: Home, bg: 'from-sky-100 to-blue-200 text-blue-700' },
  calculator: { Icon: Calculator, bg: 'from-slate-100 to-slate-300 text-slate-700' },
  key: { Icon: KeyRound, bg: 'from-amber-100 to-orange-200 text-orange-700' },
  briefcase: { Icon: Briefcase, bg: 'from-violet-100 to-purple-200 text-purple-700' },
  shield: { Icon: ShieldCheck, bg: 'from-emerald-100 to-green-200 text-emerald-700' },
  chart: { Icon: BarChart3, bg: 'from-rose-100 to-pink-200 text-rose-700' },
} as const

export function ServiceArt({ icon, className = '' }: { icon: ServiceIcon; className?: string }) {
  const { Icon, bg } = MAP[icon]
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br ${bg} ${className}`}>
      <Icon size={36} strokeWidth={1.6} />
    </div>
  )
}

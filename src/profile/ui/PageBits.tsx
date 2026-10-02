import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Title row used by every non-profile page. */
export function PageHeader({ icon: Icon, title, subtitle, right }: { icon: LucideIcon; title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Icon size={22} /></span>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

/** Card with the icon-and-divider header from the reference design. */
export function Card({ icon: Icon, title, right, children, className = '' }: { icon?: LucideIcon; title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="flex items-center gap-2.5 text-[17px] font-semibold text-slate-900">{Icon && <Icon size={20} className="text-slate-500" />}{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

/** One divided strip of figures. */
export function KpiGrid({ children, cols = 'md:grid-cols-4', slider = false }: { children: ReactNode; cols?: string; slider?: boolean }) {
  // slider: a single row on phones (wrap it in <ScrollFade axis="x">), the usual grid from sm up
  const layout = slider ? 'flex sm:grid sm:grid-cols-2' : 'grid grid-cols-2'
  return <section className={`${layout} gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-card ${cols}`}>{children}</section>
}

export function KpiCell({ icon: Icon, label, value, sub, className = '' }: { icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={`bg-white p-5 ${className}`}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500"><Icon size={15} />{label}</div>
      <div className="mt-2.5 text-xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export const EmptyState = ({ children }: { children: ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{children}</div>
)

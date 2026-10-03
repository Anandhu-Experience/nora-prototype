import { Sparkles, type LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useNoraChat } from '../NoraContext'
import type { AiAnswer } from '../assistant'
import { ScrollFade } from './ScrollFade'

/**
 * Shared building blocks for the module pages (Listings, Connections, Web Analytics, Search Rank Score,
 * Insights, AI Visibility, Network). They use the same tokens as the rest of the app, so dark mode works.
 */

/** Page-level tabs. A swipeable row (with edge fades) on phones. */
export function Tabs<T extends string>({ tabs, value, onChange, label = 'Sections' }: { tabs: { id: T; label: string; badge?: ReactNode; icon?: LucideIcon }[]; value: T; onChange: (id: T) => void; label?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 shadow-card">
      <ScrollFade axis="x" innerClassName="flex gap-1" innerProps={{ role: 'tablist', 'aria-label': label }}>
        {tabs.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
            className={`relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3.5 text-sm font-medium transition ${value === t.id ? 'text-blue-600 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {t.icon && <t.icon size={15} />}{t.label}{t.badge}
          </button>
        ))}
      </ScrollFade>
    </div>
  )
}

/** Circular progress. `value` and `max` give the arc; children sit in the middle. */
export function Ring({ value, max, size = 120, stroke = 10, tone = 'stroke-blue-500', children, label }: { value: number; max: number; size?: number; stroke?: number; tone?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className={`${tone} transition-[stroke-dashoffset] duration-500`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

/** A thin labelled progress bar: "Reviews  13 / 300  4%". */
export function ScoreBar({ label, points, max, tone = 'bg-blue-500', right }: { label: ReactNode; points: number; max: number; tone?: string; right?: ReactNode }) {
  const pct = max ? Math.round((points / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-800">{label}</span><span className="text-xs text-slate-500">{right ?? `${points} / ${max}  ${pct}%`}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={points} aria-valuemin={0} aria-valuemax={max}><div className={`h-full rounded-full ${tone} transition-[width] duration-500`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export type PillTone = 'green' | 'blue' | 'amber' | 'red' | 'slate' | 'purple'
const PILL: Record<PillTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
}
export const Pill = ({ tone = 'slate', children }: { tone?: PillTone; children: ReactNode }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL[tone]}`}>{children}</span>
)

/** The dark gradient banner at the top of a module page (title, blurb, optional figure and art on the right). */
export function Hero({ title, blurb, from = 'from-slate-900', via = 'via-indigo-900', to = 'to-blue-700', children, aside }: { title: ReactNode; blurb?: ReactNode; from?: string; via?: string; to?: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${from} ${via} ${to} p-6 text-white shadow-card sm:p-7`}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-pink-400/20 blur-3xl" />
      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
          {blurb && <p className="mt-1.5 max-w-xl text-sm text-white/80">{blurb}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
        {aside && <div className="hidden md:block">{aside}</div>}
      </div>
    </section>
  )
}

/** A white-on-dark progress bar for use inside <Hero>. */
export const HeroBar = ({ pct }: { pct: number }) => (
  <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} /></div>
)

export interface Suggestion {
  id: string
  title: string
  detail: string
  /** Button label, e.g. "Fix with AI", "Connect". */
  cta: string
  onRun: () => void
  /** Short impact tag, e.g. "+40 pts". */
  impact?: string
}

/**
 * The "AI friendly" strip every module page carries: NORA's read of the page in a sentence, up to three concrete
 * next steps (each does something), and "Ask NORA" which posts the question and a ready answer into the NORA chat.
 * Suggestions come from the page's real data, so they disappear when the thing is fixed.
 */
export function AiInsightBar({ summary, suggestions, question, answer, title = 'NORA suggests' }: { summary: ReactNode; suggestions: Suggestion[]; question: string; answer: AiAnswer; title?: string }) {
  const chat = useNoraChat()
  const id = useId()
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white"><Sparkles size={17} /></span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-[15px] font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{summary}</p>
        </div>
        <button onClick={() => chat.askWith(question, answer)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-50"><Sparkles size={14} /> Ask NORA</button>
      </div>
      {suggestions.length > 0 && (
        <ul className="mt-4 grid gap-2.5 lg:grid-cols-3">
          {suggestions.slice(0, 3).map((s) => (
            <li key={s.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-slate-900">{s.title}</span>{s.impact && <Pill tone="green">{s.impact}</Pill>}</div>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{s.detail}</p>
              <button onClick={s.onRun} className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-purple-600 hover:underline"><Sparkles size={13} /> {s.cta} →</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Smooth area/line chart for time series. `series` share the x labels. */
export function LineChart({ labels, series, height = 220, yTicks = 4, label }: { labels: string[]; series: { id: string; name: string; color: string; values: number[]; fill?: boolean }[]; height?: number; yTicks?: number; label: string }) {
  const W = 640, H = height, L = 34, R = 10, T = 12, B = 26
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const niceMax = Math.ceil(max / yTicks) * yTicks || yTicks
  const x = (i: number) => L + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - L - R))
  const y = (v: number) => T + (1 - v / niceMax) * (H - T - B)
  const path = (vals: number[]) => {
    if (!vals.length) return ''
    return vals.map((v, i) => {
      if (i === 0) return `M${x(0)},${y(v)}`
      const cx = (x(i - 1) + x(i)) / 2
      return `C${cx},${y(vals[i - 1]!)} ${cx},${y(v)} ${x(i)},${y(v)}`
    }).join(' ')
  }
  const gid = useId().replace(/:/g, '')
  const every = Math.max(1, Math.ceil(labels.length / 8))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <defs>
        {series.map((s) => (
          <linearGradient key={s.id} id={`${gid}-${s.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.28" /><stop offset="100%" stopColor={s.color} stopOpacity="0" /></linearGradient>
        ))}
      </defs>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = (niceMax / yTicks) * i
        return <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-slate-200" strokeDasharray="3 4" /><text x={L - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{Math.round(v)}</text></g>
      })}
      {labels.map((l, i) => (i % every === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">{l}</text> : null))}
      {series.map((s) => (
        <g key={s.id}>
          {s.fill !== false && s.values.length > 1 && <path d={`${path(s.values)} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gid}-${s.id})`} />}
          <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}

/** Legend with checkboxes that toggle series (used with LineChart). */
export function Legend({ items, hidden, onToggle }: { items: { id: string; name: string; color: string }[]; hidden: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
      {items.map((s) => (
        <label key={s.id} className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={!hidden.has(s.id)} onChange={() => onToggle(s.id)} className="h-3.5 w-3.5 rounded border-slate-300" />
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}
        </label>
      ))}
    </div>
  )
}

/** A card-sized call to action row: icon, title, text and a button on the right. */
export function ActionRow({ icon: Icon, title, text, action, tone = 'blue' }: { icon: LucideIcon; title: ReactNode; text?: ReactNode; action?: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple' }) {
  const t = { blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-rose-50 text-rose-600', purple: 'bg-purple-50 text-purple-600' }[tone]
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t}`}><Icon size={19} /></span>
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900">{title}</div>{text && <div className="text-xs text-slate-500">{text}</div>}</div>
      {action}
    </div>
  )
}

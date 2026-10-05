import { ArrowRight, Share2, Bell, Building2, ChevronDown, Loader2, MapPin, Menu, Moon, Network, RotateCcw, Search, Sparkles, Sun, BarChart3, TrendingUp, Activity, User, Users, Wrench, X, Bot, Cpu, type LucideIcon } from 'lucide-react'
import { SHOW_EXPERTISE_GRAPH } from '../features'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SCENARIOS, SCENARIO_IDS } from '../../mock/user'
import { collectIssues, syncIssueHistory, useOsRefresh } from '../../presence/noraOs'
import { getSkill } from '../../nora/skillRegistry'
import { NoraProvider, useNora, useNoraChat, useNoraPanel, useNoraProcessing, useResetDemo } from '../NoraContext'
import { allServices, cities, fmtDate } from '../selectors'
import { actions, unreadMessages, unreadNotifications, useStore } from '../store'
import { useTheme } from '../theme'
import { logout } from '../auth'
import { Avatar, MENU_ITEM, Popover } from './bits'
import { Logo } from './Logo'
import { NoraPanel } from './NoraPanel'
import { ToastProvider, useToast } from './Toast'
import { usePageSuggestions } from './floatingSuggestions'
import { TraceButton, TraceDrawer } from './TraceDrawer'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  badge?: 'messages' | 'notifications'
  /** Extra paths that count as this item being active. */
  also?: string[]
}

/** The sidebar: the product's modules. Messages and notifications live in the top bar and account menu. */
const NAV_ALL: NavItem[] = [
  { to: '/profile', label: 'Profile & Presence', icon: User },
  { to: '/nora-os', label: 'NORA OS', icon: Cpu },
  { to: '/graph', label: 'Expertise Graph', icon: Share2 },
  { to: '/listings', label: 'Listings', icon: Building2 },
  { to: '/connections', label: 'Connections', icon: Users },
  { to: '/analytics', label: 'Web Analytics', icon: Activity },
  { to: '/search-rank', label: 'Search Rank Score', icon: TrendingUp },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/ai-visibility', label: 'AI Visibility', icon: Bot },
  { to: '/network', label: 'Network', icon: Network, also: ['/professionals', '/locations'] },
]
const NAV_MAIN = NAV_ALL.filter((i) => SHOW_EXPERTISE_GRAPH || i.to !== '/graph')
const isActive = (item: NavItem, path: string) => [item.to, ...(item.also ?? [])].some((t) => path === t || path.startsWith(`${t}/`))

type Hit = { key: string; kind: 'agent' | 'city' | 'service'; label: string; sub: string; to: string }

function SearchBox() {
  const state = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    const agents = state.order.map((id) => state.agents[id]!).filter((a) => [a.name, a.title, a.company, a.city].some((v) => v.toLowerCase().includes(t)))
      .map((a): Hit => ({ key: `a-${a.id}`, kind: 'agent', label: a.name, sub: `${a.title} · ${a.city}`, to: `/profile/${a.id}` }))
    const cs = cities(state).filter((c) => c.toLowerCase().includes(t)).map((c): Hit => ({ key: `c-${c}`, kind: 'city', label: c, sub: 'Location', to: `/professionals?city=${encodeURIComponent(c)}` }))
    const ss = allServices(state).filter((s) => s.toLowerCase().includes(t)).map((s): Hit => ({ key: `s-${s}`, kind: 'service', label: s, sub: 'Service', to: `/professionals?service=${encodeURIComponent(s)}` }))
    return [...agents, ...cs, ...ss].slice(0, 8)
  }, [q, state])

  useEffect(() => {
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        input.current?.focus()
      }
    }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [])

  const go = (h: Hit | undefined) => {
    if (h) nav(h.to)
    else if (q.trim()) nav(`/professionals?q=${encodeURIComponent(q.trim())}`)
    setOpen(false)
    setQ('')
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') go(hits[active])
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
  }

  return (
    <div ref={ref} className="relative w-full">
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={input} role="combobox" aria-expanded={open && hits.length > 0} aria-controls="search-results" aria-label="Search agents, locations, or services"
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-12 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        placeholder="Search..." value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }} onFocus={() => setOpen(true)} onKeyDown={onKey}
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 sm:block">⌘K</kbd>
      {open && q.trim() && (
        <ul id="search-results" role="listbox" className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {hits.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No matches. Press Enter to search professionals.</li>}
          {hits.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === active}>
              <button onMouseEnter={() => setActive(i)} onClick={() => go(h)} className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === active ? 'bg-blue-50' : ''}`}>
                {h.kind === 'agent' ? <Avatar agent={state.agents[h.key.slice(2)]!} size={28} /> : h.kind === 'city' ? <MapPin size={18} className="mx-1 text-slate-400" /> : <Wrench size={18} className="mx-1 text-slate-400" />}
                <span><span className="block text-sm font-medium text-slate-900">{h.label}</span><span className="block text-xs text-slate-500">{h.sub}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BellMenu() {
  const state = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const unread = unreadNotifications(state).length
  return (
    <div className="relative">
      <button aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} width="w-80">
        <div className="flex items-center justify-between px-3.5 py-2">
          <span className="text-sm font-semibold text-slate-900">Notifications</span>
          <button disabled={!unread} onClick={() => actions.markAllNotificationsRead()} className="text-xs font-medium text-blue-600 hover:underline disabled:text-slate-300 disabled:no-underline">Mark all as read</button>
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {state.notifications.length === 0 && <li className="px-3.5 py-4 text-sm text-slate-500">You’re all caught up.</li>}
          {state.notifications.map((n) => (
            <li key={n.id}>
              <button onClick={() => { actions.markNotificationRead(n.id); setOpen(false); nav(n.link) }} className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-blue-600'}`} />
                <span><span className={`block text-sm ${n.read ? 'text-slate-500' : 'text-slate-900'}`}>{n.text}</span><span className="text-xs text-slate-400">{fmtDate(n.at)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  )
}

function AccountMenu({ position, variant = 'avatar' }: { position: string; variant?: 'avatar' | 'card' }) {
  const state = useStore()
  const { engine, state: nora } = useNora()
  const nav = useNavigate()
  const toast = useToast()
  const resetDemo = useResetDemo()
  const [open, setOpen] = useState(false)
  const me = state.agents[state.viewerId]!
  const go = (to: string) => { setOpen(false); nav(to) }
  return (
    <div className="relative">
      {variant === 'card' ? (
        <button aria-label="Account menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-slate-50">
          <Avatar agent={me} size={40} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{me.name}</span><span className="block truncate text-xs text-slate-500">{me.title}</span></span>
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        </button>
      ) : (
        <button aria-label="Account menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-1 rounded-full p-0.5 hover:bg-slate-100"><Avatar agent={me} size={38} /><ChevronDown size={14} className="mr-1 text-slate-400" /></button>
      )}
      <Popover open={open} onClose={() => setOpen(false)} width="w-64" position={position}>
        <div className="border-b border-slate-100 px-3.5 pb-2 pt-1"><div className="text-sm font-semibold text-slate-900">{me.name}</div><div className="text-xs text-slate-500">{me.title}</div></div>
        <button className={MENU_ITEM} onClick={() => go('/profile')}>Profile overview</button>
        <button className={MENU_ITEM} onClick={() => go(`/profile/${me.id}`)}>View public profile</button>
        <button className={MENU_ITEM} onClick={() => go('/profile?edit=1')}>Edit profile</button>
        <button className={MENU_ITEM} onClick={() => go('/messages')}>Messages</button>
        <button className={MENU_ITEM} onClick={() => go('/insights')}>Insights</button>
        <div className="my-1 border-t border-slate-100" />
        <div className="px-3.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">NORA demo scenario</div>
        {SCENARIO_IDS.map((id) => (
          <button key={id} role="menuitemradio" aria-checked={nora.scenario === id} title={SCENARIOS[id].description} className={`${MENU_ITEM} !py-1.5 text-xs`} onClick={() => { setOpen(false); void engine.reset(id); toast(`NORA: ${SCENARIOS[id].label}`, 'info') }}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${nora.scenario === id ? 'bg-purple-600' : 'border border-slate-300'}`} />
            {SCENARIOS[id].label}
          </button>
        ))}
        <div className="my-1 border-t border-slate-100" />
        <button className={MENU_ITEM} onClick={() => { setOpen(false); resetDemo(); toast('Demo reset', 'info') }}>Reset demo</button>
        <button className={MENU_ITEM} onClick={() => { setOpen(false); logout() }}>Sign out</button>
      </Popover>
    </div>
  )
}

function SidebarItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const state = useStore()
  const active = isActive(item, pathname)
  const count = item.badge === 'messages' ? unreadMessages(state) : item.badge === 'notifications' ? unreadNotifications(state).length : 0
  const Icon = item.icon
  return (
    <Link to={item.to} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium ${active ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
      <Icon size={20} className="shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white" aria-label={`${count} unread`}>{count}</span>}
    </Link>
  )
}

/** Logo, account card and the navigation. Shared by the desktop sidebar and the mobile drawer. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <Link to="/profile" onClick={onNavigate} className="mb-5 flex items-center gap-2 px-2.5"><Logo size={30} /><span className="text-xl font-extrabold tracking-tight text-slate-900">Experience<span className="text-blue-600">.com</span></span></Link>
      <AccountMenu variant="card" position="left-0 top-full mt-2" />
      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Main">
        {NAV_MAIN.map((it) => <SidebarItem key={it.to} item={it} onNavigate={onNavigate} />)}
      </nav>
    </div>
  )
}

function Sidebar() {
  return <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white lg:block"><SidebarContent /></aside>
}

/** Visible, presenter-friendly reset. Confirms first because it discards local edits. */
function ResetDemo() {
  const toast = useToast()
  const resetDemo = useResetDemo()
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setConfirm(!confirm)} aria-expanded={confirm} aria-label="Reset demo" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
        <RotateCcw size={16} /><span className="hidden lg:inline">Reset demo</span>
      </button>
      <Popover open={confirm} onClose={() => setConfirm(false)} width="w-72">
        <div className="px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Reset the demo?</div>
          <p className="mt-1 text-xs text-slate-500">Restores the starting profile, reviews and messages, and restarts NORA. Your edits are discarded.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setConfirm(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={() => { setConfirm(false); resetDemo(); toast('Demo reset', 'info') }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">Reset</button>
          </div>
        </div>
      </Popover>
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button onClick={toggle} role="switch" aria-checked={dark} aria-label="Dark mode" className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-1">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${!dark ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}><Sun size={16} /></span>
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${dark ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}><Moon size={16} /></span>
    </button>
  )
}

function TopBar() {
  const [drawer, setDrawer] = useState(false)
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-4 md:px-6">
        <button aria-label="Menu" onClick={() => setDrawer(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
        <Link to="/profile" className="flex items-center gap-2 lg:hidden"><Logo size={26} /></Link>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden w-[190px] md:block xl:w-[280px]"><SearchBox /></div>
          <TraceButton />
          <ResetDemo />
          <div className="hidden sm:block"><ThemeToggle /></div>
          <BellMenu />
          <AccountMenu position="top-full mt-2 right-0" />
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><SearchBox /></div>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <button aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute right-2 top-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
            <div className="absolute bottom-3 right-3 sm:hidden"><ThemeToggle /></div>
          </div>
        </div>
      )}
    </header>
  )
}

/** Toasts new notifications (e.g. an agent’s auto-reply) as they arrive. */
function NotificationToaster() {
  const state = useStore()
  const toast = useToast()
  const seen = useRef(new Set(state.notifications.map((n) => n.id)))
  useEffect(() => {
    for (const n of state.notifications) {
      if (!seen.current.has(n.id)) {
        seen.current.add(n.id)
        toast(n.text, 'info')
      }
    }
  }, [state.notifications, toast])
  return null
}

/** NORA in the centre of the screen. Backdrop click or Esc minimizes; while NORA works the rest of the app blurs. */
function NoraDialog() {
  const { setOpen } = useNoraPanel()
  const processing = useNoraProcessing()
  const frame = useRef<HTMLDivElement>(null)

  useEffect(() => {
    frame.current?.querySelector<HTMLElement>('section')?.focus()
    const key = (e: KeyboardEvent) => {
      // Esc belongs to a modal opened from NORA (e.g. the referral form) before it belongs to NORA
      if (e.key === 'Escape' && document.querySelectorAll('[role=dialog]').length === 1) setOpen(false)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [setOpen])

  return (
    <div className="fixed inset-0 z-[45] flex items-center justify-center p-4">
      <div
        aria-hidden onClick={() => setOpen(false)}
        className={`absolute inset-0 transition-all duration-300 ${processing ? 'bg-black/30 backdrop-blur-[5px]' : 'bg-black/25 backdrop-blur-[1px]'}`}
      />
      <div ref={frame} className="relative h-[min(780px,calc(100vh-32px))] w-full max-w-[440px]">
        <NoraPanel />
      </div>
    </div>
  )
}

/** What the suggestion says to do, in the user's words. The skill's own name is a fallback. */
const ACTION_TITLE: Record<string, string> = {
  'connection-setup': 'Connect Google to unlock Insights',
  'profile-completion': 'Complete your profile',
  'listing-optimization': 'Fix your incomplete listings',
  'web-analytics-insight': 'See what changed in your traffic',
}
const DISMISSED = 'nora-suggestions-dismissed-paths'
const readDismissed = (): string[] => { try { return JSON.parse(sessionStorage.getItem(DISMISSED) ?? '[]') as string[] } catch { return [] } }

interface Card { key: string; title: string; detail: string; impact?: string; run: () => void }

/** Page suggestions that are really a NORA skill: the card opens NORA on that skill instead of a chat message. */
const PAGE_SKILL: Record<string, string> = { google: 'connection-setup' }

/**
 * NORA's launcher: a round floating button in the corner, with suggestions stacked above it. On a page with its own
 * "NORA suggests" strip these are that page's suggestions; otherwise they are the issues NORA found. Every card opens the
 * NORA panel: an issue with its skill selected, a page suggestion as a message from NORA with a button that does it.
 * The button spins while NORA works and shows a dot when it needs you.
 */
function FloatingNora() {
  const { open, setOpen } = useNoraPanel()
  const { engine, state: nora } = useNora()
  const processing = useNoraProcessing()
  const { pathname } = useLocation()
  const pageItems = usePageSuggestions()
  const [dismissed, setDismissed] = useState(readDismissed)
  const needsYou = nora.status === 'SKILL_PROPOSED' || nora.status === 'WRITE_APPROVAL' || nora.status === 'RESULT_READY'

  const chat = useNoraChat()
  const pick = (skillId: string) => { engine.select(skillId); setOpen(true) }
  /** A page suggestion opens NORA first; the page action is one click away inside it. */
  const openInNora = (p: { id: string; title: string; detail: string; cta: string; onRun: () => void }) => {
    const skill = PAGE_SKILL[p.id]
    if (skill && nora.status === 'SKILL_PROPOSED' && nora.evaluations.some((e) => e.skillId === skill && e.rank)) return pick(skill)
    chat.askWith(p.title, { intro: p.detail, buttons: [{ label: p.cta, run: () => { setOpen(false); p.onRun() } }] })
  }
  const issues = nora.status === 'SKILL_PROPOSED' ? [...nora.evaluations].filter((e) => e.rank).sort((a, b) => a.rank! - b.rank!).slice(0, 3) : []
  const cards: Card[] = pageItems.length
    ? pageItems.slice(0, 3).map((p) => ({ key: p.id, title: p.title, detail: p.detail, impact: p.impact, run: () => openInNora(p) }))
    : issues.map((e) => {
        const outcome = nora.graph ? getSkill(e.skillId)?.expectedOutcome?.(nora.graph) : null
        return { key: e.skillId, title: ACTION_TITLE[e.skillId] ?? e.name, detail: outcome ? `${outcome.label}: ${outcome.before} → ${outcome.after}` : e.reason, run: () => pick(e.skillId) }
      })
  const showSuggestions = cards.length > 0 && !open && !dismissed.includes(pathname) && !(processing && !pageItems.length)
  const dismiss = () => {
    const next = [...new Set([...dismissed, pathname])]
    setDismissed(next)
    try { sessionStorage.setItem(DISMISSED, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2.5 sm:bottom-6 sm:right-6" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {showSuggestions && (
        <div key={pathname} className="pointer-events-auto flex w-[min(300px,calc(100vw-40px))] flex-col items-stretch gap-2" role="group" aria-label="Issues NORA found">
          <div className="nora-rise flex items-center justify-between rounded-full bg-white/95 py-1 pl-3 pr-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-purple-100" style={{ animationDelay: '0ms' }}>
            <span>{pageItems.length ? 'NORA suggests for this page' : `NORA can fix ${cards.length} ${cards.length === 1 ? 'thing' : 'things'} for you`}</span>
            <button onClick={dismiss} aria-label="Hide suggestions" title="Hide on this page for this session" className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-700"><X size={14} /></button>
          </div>
          {[...cards].reverse().map((c, i) => (
            <button
              key={c.key} onClick={c.run} className="nora-rise group flex items-center gap-3 rounded-2xl border border-purple-200 bg-white p-3 pr-2.5 text-left shadow-[0_8px_24px_rgba(124,58,237,0.18)] transition hover:-translate-y-0.5 hover:border-purple-400"
              style={{ animationDelay: `${(i + 1) * 110}ms` }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white"><Sparkles size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-900">{c.title}{c.impact && <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[10.5px] font-semibold text-emerald-700">{c.impact}</span>}</span>
                <span className="block text-xs leading-snug text-slate-500">{c.detail}</span>
              </span>
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 transition group-hover:translate-x-0.5 group-hover:bg-purple-600 group-hover:text-white"><ArrowRight size={16} className="nora-nudge" /></span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)} aria-pressed={open} aria-label="Ask NORA" title={open ? 'Minimize NORA' : 'Ask NORA'}
        className={`pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-[0_8px_24px_rgba(124,58,237,0.45)] ring-4 ring-white/70 transition hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-blue-400 ${showSuggestions ? 'nora-bob' : ''}`}
      >
        {showSuggestions && <span aria-hidden className="nora-ping absolute inset-0 rounded-full bg-purple-500/50" />}
        <span className="relative">{processing ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}</span>
        {needsYou && !open && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-rose-500 ring-2 ring-white" aria-label="Needs your attention" />}
      </button>
    </div>
  )
}

/** Keeps NORA OS's issue history current from any page, so "resolved" is stamped when the fix happens, not when the page is opened. */
function IssueHistory() {
  useOsRefresh()
  const state = useStore()
  const agent = state.agents[state.viewerId]
  useEffect(() => { if (agent) syncIssueHistory(collectIssues(agent)) })
  return null
}

function Shell() {
  const { open } = useNoraPanel()
  return (
    <div className="flex min-h-screen bg-slate-100">
      <IssueHistory />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
      <FloatingNora />
      {open && <NoraDialog />}
      <TraceDrawer />
      <NotificationToaster />
    </div>
  )
}

export function SiteLayout() {
  return (
    <ToastProvider>
      <NoraProvider>
        <Shell />
      </NoraProvider>
    </ToastProvider>
  )
}

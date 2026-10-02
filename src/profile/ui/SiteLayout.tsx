import { Bell, ChevronLeft, ChevronsLeft, ChevronsRight, Home, Loader2, MapPin, Menu, MessageSquare, Moon, RotateCcw, Search, Sparkles, Sun, BarChart3, Users, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SCENARIOS, SCENARIO_IDS } from '../../mock/user'
import { NoraProvider, useNora, useNoraPanel, useNoraProcessing, useResetDemo } from '../NoraContext'
import { allServices, cities, fmtDate } from '../selectors'
import { actions, unreadMessages, unreadNotifications, useStore } from '../store'
import { useTheme } from '../theme'
import { logout } from '../auth'
import { Avatar, MENU_ITEM, Popover } from './bits'
import { Logo } from './Logo'
import { NoraPanel } from './NoraPanel'
import { ToastProvider, useToast } from './Toast'

const NAV = [
  { to: '/profile', label: 'Home', icon: Home }, { to: '/professionals', label: 'Professionals', icon: Users },
  { to: '/locations', label: 'Locations', icon: MapPin }, { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
]

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

function AccountMenu({ position }: { position: string }) {
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
      <button aria-label="Account menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex rounded-full ring-2 ring-transparent hover:ring-blue-200"><Avatar agent={me} size={38} /></button>
      <Popover open={open} onClose={() => setOpen(false)} width="w-64" position={position}>
        <div className="border-b border-slate-100 px-3.5 pb-2 pt-1"><div className="text-sm font-semibold text-slate-900">{me.name}</div><div className="text-xs text-slate-500">{me.title}</div></div>
        <button className={MENU_ITEM} onClick={() => go(`/profile/${me.id}`)}>My profile</button>
        <button className={MENU_ITEM} onClick={() => go(`/profile/${me.id}?edit=1`)}>Edit profile</button>
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

function Rail() {
  const state = useStore()
  const [expanded, setExpanded] = useState(() => { try { return localStorage.getItem('nora-rail') === '1' } catch { return false } })
  const unread = unreadMessages(state)
  const toggle = () => {
    setExpanded((e) => {
      try { localStorage.setItem('nora-rail', e ? '0' : '1') } catch { /* ignore */ }
      return !e
    })
  }
  return (
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white py-4 transition-[width] md:flex ${expanded ? 'w-56' : 'w-[76px]'}`}>
      <div className={`flex items-center ${expanded ? 'justify-between px-4' : 'flex-col gap-3'}`}>
        <div className="flex items-center gap-2"><Logo />{expanded && <span className="text-lg font-extrabold tracking-tight text-slate-900">experience</span>}</div>
        <button onClick={toggle} aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50">
          {expanded ? <ChevronsLeft size={15} /> : <ChevronsRight size={15} />}
        </button>
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-2 px-3" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} title={label} className={({ isActive }) => `relative flex h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
            <Icon size={20} className="shrink-0" />
            {expanded && <span>{label}</span>}
            {to === '/messages' && unread > 0 && <span className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white ${expanded ? 'ml-auto' : 'absolute right-1.5 top-1.5'}`}>{unread}</span>}
          </NavLink>
        ))}
      </nav>
      <div className={`flex ${expanded ? 'px-4' : 'justify-center'}`}><AccountMenu position="bottom-0 left-full ml-3" /></div>
    </aside>
  )
}

function useTitle(): string {
  const { pathname } = useLocation()
  const state = useStore()
  const m = pathname.match(/^\/profile\/([^/]+)/)
  if (m) return state.agents[m[1]!]?.name ?? 'Profile'
  return NAV.find((n) => pathname.startsWith(n.to))?.label ?? 'Home'
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
  const nav = useNavigate()
  const title = useTitle()
  const [menu, setMenu] = useState(false)
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-[68px] items-center gap-3 px-4 md:px-6">
        <button aria-label="Menu" onClick={() => setMenu(!menu)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"><Menu size={20} /></button>
        <button onClick={() => nav(-1)} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-medium text-slate-600 hover:text-slate-900"><ChevronLeft size={18} /><span className="hidden sm:inline">Back</span></button>
        <div className="hidden min-w-0 items-center gap-2 text-sm sm:flex"><Users size={16} className="text-slate-500" /><span className="text-slate-300">/</span><span className="truncate font-semibold text-slate-900">{title}</span></div>
        <div className="ml-auto hidden w-full max-w-[380px] md:block"><SearchBox /></div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ResetDemo />
          <div className="hidden sm:block"><ThemeToggle /></div>
          <BellMenu />
          <div className="md:hidden"><AccountMenu position="top-full mt-2 right-0" /></div>
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden"><SearchBox /></div>
      {menu && (
        <nav className="border-t border-slate-100 px-4 py-2 md:hidden" aria-label="Mobile">
          {NAV.map(({ to, label }) => <NavLink key={to} to={to} onClick={() => setMenu(false)} className={({ isActive }) => `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}>{label}</NavLink>)}
          <div className="py-2 sm:hidden"><ThemeToggle /></div>
        </nav>
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

/** Minimized NORA: a floating pill that shows whether it is working or needs you. */
function NoraLauncher() {
  const { setOpen } = useNoraPanel()
  const { state } = useNora()
  const processing = useNoraProcessing()
  const needsYou = state.status === 'SKILL_PROPOSED' || state.status === 'WRITE_APPROVAL' || state.status === 'RESULT_READY'
  return (
    <button
      onClick={() => setOpen(true)} aria-label="Open NORA"
      className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white py-2 pl-2 pr-4 text-sm font-semibold text-slate-900 shadow-[0_8px_30px_rgba(168,85,247,0.35)] hover:brightness-105 ${processing ? 'nora-glow' : ''}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white">
        {processing ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
      </span>
      NORA
      {processing ? <span className="text-xs font-medium text-purple-600">Working…</span> : needsYou ? <span className="h-2.5 w-2.5 rounded-full bg-rose-500" aria-label="Needs your attention" /> : null}
    </button>
  )
}

function Shell() {
  const { open } = useNoraPanel()
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 p-4 md:p-6"><Outlet /></main>
      </div>
      {open ? <NoraDialog /> : <NoraLauncher />}
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

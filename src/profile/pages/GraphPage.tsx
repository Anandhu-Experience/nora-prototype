import { Building2, Crosshair, MapPin, Minus, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CONNECTIONS, connectionsStore } from '../../presence/connections'
import { listingsStore } from '../../presence/listings'
import { networkStore } from '../../presence/network'
import { useSrs, SRS_MAX } from '../../presence/srs'
import { voceStore } from '../../presence/voce'
import { websiteStore } from '../../presence/website'
import { agentAddresses } from '../details'
import { RINGS, STATE_LABEL, buildGraph, layoutGraph, type GNode, type GraphContext, type RingId } from '../graphModel'
import { useStore } from '../store'

/** The fixed dark palette of the graph (it is a canvas, so it does not follow the light and dark theme). */
const C = { bg: '#070c1c', panel: '#0d1429', line: '#1c2745', text: '#e8ecf7', muted: '#8e9bbd', faint: '#56637f' }
const STATE_DOT: Record<string, string> = { 'self-reported': '#8e9bbd', verified: '#34d399', published: '#34d399', 'client-written': '#d9a441', scanned: '#22c7e8', sample: '#f59e0b', managed: '#a98bff' }
const W = 1100, H = 900

export default function GraphPage() {
  const state = useStore()
  const agent = state.agents[state.viewerId]!
  const srs = useSrs(agent)
  const conns = connectionsStore.use().conns
  const sites = listingsStore.use().sites
  const voce = voceStore.use()
  const promoted = networkStore.use().promoted
  const web = websiteStore.use()

  const ctx = useMemo<GraphContext>(() => ({
    connected: CONNECTIONS.filter((c) => conns[c.id]?.connected).map((c) => ({ id: c.id, name: c.name, handle: conns[c.id]!.handle, oauth: c.kind === 'oauth' })),
    publishedListings: sites.filter((s) => s.status === 'published').map((s) => ({ id: s.id, name: s.name })),
    articles: voce.articles.filter((a) => a.status === 'published').map((a) => ({ id: a.id, title: a.title })),
    answeredFaqs: voce.faqs.filter((f) => f.answer.trim()).length,
    partners: promoted.map((p) => ({ id: p.id, name: p.name })),
    website: web.url ? { url: web.url, scanned: !!web.scan, live: web.source === 'live' } : null,
  }), [conns, sites, voce, promoted, web])

  const graph = useMemo(() => buildGraph(agent, ctx), [agent, ctx])
  const layout = useMemo(() => layoutGraph(graph), [graph])
  const color = (r: RingId) => RINGS.find((x) => x.id === r)!.color

  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const [focus, setFocus] = useState<RingId | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const selected = graph.nodes.find((n) => n.id === sel) ?? null
  const clamp = (k: number) => Math.min(3, Math.max(0.5, k))
  const zoom = (f: number) => setView((v) => ({ ...v, k: clamp(v.k * f) }))

  // the wheel needs a non-passive listener so the page does not scroll while zooming
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setView((v) => ({ ...v, k: clamp(v.k * (e.deltaY < 0 ? 1.12 : 0.89)) })) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const dim = (ring: RingId) => (focus && focus !== ring ? 0.12 : 1)
  const city = agentAddresses(agent)[0]!.city
  const maxCount = Math.max(1, ...graph.rings.map((r) => r.count))

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] space-y-5 p-4 md:-m-6 md:p-6" style={{ background: C.bg, color: C.text }}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-semibold">{agent.name}</h1>
            <span className="text-lg" style={{ color: '#37c5bd' }}>Expertise Graph</span>
          </div>
          <p className="mt-1 text-lg" style={{ color: C.muted }}>{agent.title} — {city}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5" style={{ borderColor: C.line, background: C.panel }}><Building2 size={15} />{agent.name} — {agent.company}</span>
            <span className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5" style={{ borderColor: '#5a3b8f', background: '#1b1236' }}>{agent.company}</span>
            <span className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-mono text-xs" style={{ borderColor: C.line, background: C.panel, color: C.muted }}><MapPin size={13} />nmls:{agent.nmls}</span>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
          {[
            ['Live nodes', String(graph.live), 'from connected modules'], ['Record nodes', String(graph.record), 'from the profile record'],
            ['Rings populated', `${graph.populated}/${graph.total}`, 'of the eight rings'], ['Search rank', String(srs.total), `of ${SRS_MAX} points`],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-2xl border px-4 py-3" style={{ borderColor: C.line, background: C.panel }}>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>{label}</div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
              <div className="text-xs" style={{ color: C.faint }}>{sub}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="relative overflow-hidden rounded-2xl border" style={{ borderColor: C.line, background: 'radial-gradient(circle at 50% 50%, #0e1a3a 0%, #070c1c 70%)' }} aria-label="Expertise graph">
          <svg
            ref={svgRef} viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} className="block h-[640px] w-full cursor-grab touch-none select-none active:cursor-grabbing" role="img"
            aria-label={`Graph of ${graph.nodes.length} facts about ${agent.name} in ${graph.populated} of 8 rings`}
            onPointerDown={(e) => { (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y } }}
            onPointerMove={(e) => { if (!drag.current) return; const s = (W / e.currentTarget.getBoundingClientRect().width) / view.k; setView((v) => ({ ...v, x: drag.current!.vx + (e.clientX - drag.current!.x) * s * view.k, y: drag.current!.vy + (e.clientY - drag.current!.y) * s * view.k })) }}
            onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
            onClick={(e) => { if (e.target === e.currentTarget) setSel(null) }}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
              {RINGS.map((r) => {
                const hub = layout.hubs[r.id]
                const mine = graph.nodes.filter((n) => n.ring === r.id)
                return (
                  <g key={r.id} style={{ opacity: dim(r.id), transition: 'opacity .2s' }}>
                    <path d={`M0 0 Q ${hub.x * 0.35 + hub.y * 0.12} ${hub.y * 0.35 - hub.x * 0.12} ${hub.x} ${hub.y}`} fill="none" stroke={r.color} strokeWidth={1.6} opacity={0.55} />
                    {mine.map((n) => {
                      const p = layout.nodes[n.id]!
                      return <path key={n.id} d={`M${hub.x} ${hub.y} Q ${(hub.x + p.x) / 2 + (hub.y - p.y) * 0.08} ${(hub.y + p.y) / 2 + (p.x - hub.x) * 0.08} ${p.x} ${p.y}`} fill="none" stroke={r.color} strokeWidth={1} opacity={0.4} />
                    })}
                  </g>
                )
              })}

              {/* the person at the centre */}
              <circle r={70} fill="#2a5bd7" opacity={0.12} />
              <circle r={44} fill="#070c1c" stroke="#2a5bd7" strokeWidth={2} />
              <text y={6} textAnchor="middle" fontSize={22} fontWeight={700} fill={C.text}>{srs.total}</text>
              <text y={70} textAnchor="middle" fontSize={16} fontWeight={600} fill={C.text}>{agent.name}</text>
              <text y={88} textAnchor="middle" fontSize={11} fill={C.muted}>Search Rank Score</text>

              {RINGS.map((r) => {
                const hub = layout.hubs[r.id]
                const w = 26 + r.label.length * 6.6
                const mine = graph.nodes.filter((n) => n.ring === r.id)
                return (
                  <g key={`g-${r.id}`} style={{ opacity: dim(r.id), transition: 'opacity .2s' }}>
                    <g transform={`translate(${hub.x} ${hub.y})`} onPointerEnter={() => setFocus(r.id)} onPointerLeave={() => setFocus(null)} style={{ cursor: 'pointer' }}>
                      <rect x={-w / 2} y={-15} width={w} height={30} rx={15} fill="#0b1226" stroke={r.color} strokeWidth={1.4} />
                      <circle cx={-w / 2 + 14} cy={0} r={4} fill={r.color} />
                      <text x={-w / 2 + 24} y={4} fontSize={11.5} fontWeight={600} fill={C.text}>{r.label}</text>
                    </g>
                    {mine.map((n) => {
                      const p = layout.nodes[n.id]!
                      const right = Math.cos((p.angle * Math.PI) / 180) >= -0.05
                      const on = sel === n.id
                      return (
                        <g key={n.id} transform={`translate(${p.x} ${p.y})`} onPointerEnter={() => setFocus(r.id)} onPointerLeave={() => setFocus(null)} onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setSel(n.id) }} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`${n.label}, ${r.label}`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSel(n.id)}>
                          {on && <circle r={15} fill="none" stroke={r.color} strokeWidth={2} opacity={0.9} />}
                          <circle r={n.origin === 'live' ? 8.5 : 7} fill={r.color} opacity={n.origin === 'live' ? 1 : 0.8} />
                          {n.origin === 'live' && <circle r={12} fill="none" stroke={r.color} strokeWidth={1} opacity={0.5} />}
                          <text x={right ? 15 : -15} y={4} textAnchor={right ? 'start' : 'end'} fontSize={11} fill={on ? '#fff' : C.text}>{n.label}</text>
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </g>
          </svg>
          <div className="absolute right-4 top-4 flex flex-col gap-2">
            {[['Zoom in', Plus, () => zoom(1.2)], ['Zoom out', Minus, () => zoom(1 / 1.2)], ['Fit to screen', Crosshair, () => setView({ k: 1, x: 0, y: 0 })]].map(([label, Icon, fn]) => {
              const I = Icon as typeof Plus
              return <button key={label as string} aria-label={label as string} title={label as string} onClick={fn as () => void} className="flex h-11 w-11 items-center justify-center rounded-xl border" style={{ borderColor: C.line, background: C.panel, color: C.text }}><I size={19} /></button>
            })}
          </div>
          <p className="absolute bottom-3 left-4 text-xs" style={{ color: C.faint }}>Scroll to zoom, drag to pan, hover a branch to isolate it. Filled rings mark data from a connected module.</p>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border p-5" style={{ borderColor: C.line, background: C.panel }} aria-label="Ring completeness">
            <h2 className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: C.muted }}>Ring completeness</h2>
            <ul className="mt-4 space-y-3.5">
              {graph.rings.map((r) => (
                <li key={r.id} onPointerEnter={() => setFocus(r.id)} onPointerLeave={() => setFocus(null)} style={{ opacity: dim(r.id) === 1 ? 1 : 0.45 }}>
                  <div className="mb-1 flex items-baseline justify-between text-[15px]"><span style={{ color: r.count ? C.text : C.faint }}>{r.label}</span><span style={{ color: r.count ? C.text : C.faint }}>{r.count || 'not captured'}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#162040' }}><div className="h-full rounded-full" style={{ width: `${(r.count / maxCount) * 100}%`, background: r.color }} /></div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border p-5" style={{ borderColor: C.line, background: C.panel }} aria-label="Node inspector" aria-live="polite">
            <h2 className="text-xl font-semibold">Node inspector</h2>
            {selected ? <Inspector n={selected} color={color(selected.ring)} /> : <p className="mt-3 leading-relaxed" style={{ color: C.muted }}>Click any node to inspect its title, source, schema mapping and verification state. Scroll to zoom, drag to pan, hover a branch to isolate it.</p>}
          </section>
        </aside>
      </div>

      <footer className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]" aria-label="Legend">
        {graph.rings.map((r) => (
          <button key={r.id} onPointerEnter={() => setFocus(r.id)} onPointerLeave={() => setFocus(null)} onFocus={() => setFocus(r.id)} onBlur={() => setFocus(null)} className="inline-flex items-center gap-2" style={{ color: r.count ? C.text : C.faint }}>
            <span className="h-3 w-3 rounded-full" style={{ background: r.color, opacity: r.count ? 1 : 0.4 }} />{r.label}<span style={{ color: C.faint }}>{r.count}</span>
          </button>
        ))}
      </footer>
    </div>
  )
}

function Inspector({ n, color }: { n: GNode; color: string }) {
  const rows: [string, string][] = [['Source', n.source], ['Comes from', n.origin === 'live' ? 'A connected module (live)' : 'The profile record'], ['Schema mapping', n.schema]]
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-start gap-2.5"><span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} /><div className="min-w-0"><div className="text-lg font-semibold leading-snug" style={{ overflowWrap: 'anywhere' }}>{n.label}</div><div className="text-xs" style={{ color: C.muted }}>{RINGS.find((r) => r.id === n.ring)!.label}</div></div></div>
      <dl className="space-y-2.5 text-sm">
        {rows.map(([k, v]) => <div key={k}><dt className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>{k}</dt><dd style={{ overflowWrap: 'anywhere' }}>{v}</dd></div>)}
        <div><dt className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Verification</dt><dd className="mt-0.5 inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATE_DOT[n.state] }} />{STATE_LABEL[n.state]}</dd></div>
        <div><dt className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: C.faint }}>Value</dt><dd className="line-clamp-6" style={{ color: C.muted, overflowWrap: 'anywhere' }}>{n.value}</dd></div>
      </dl>
    </div>
  )
}

import { ArrowRight, BarChart3, Sparkles, Target, TrendingUp, Trophy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authorityScore, voceStore } from '../../presence/voce'
import { bandOf, explainSrs, leaderboard, useSrs, type DriverId } from '../../presence/srs'
import { srsAnswer } from '../assistant'
import { useNoraFix } from '../NoraContext'
import { ratingStats } from '../selectors'
import { useStore } from '../store'
import { Avatar, Stars } from '../ui/bits'
import { AiInsightBar, Hero, LineChart, Pill, Ring, ScoreBar, type Suggestion } from '../ui/kit'
import { BTN_GHOST, BTN_PRIMARY, Modal } from '../ui/Modal'
import { Card, PageHeader } from '../ui/PageBits'
import { ScrollFade } from '../ui/ScrollFade'
import { nextActions, type NextAction } from '../ui/srs/nextActions'
import { peerBreakdown, scoreHistory, whyAhead } from '../ui/srs/peers'

type Row = ReturnType<typeof leaderboard>[number]

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-xl bg-white/10 px-4 py-3"><div className="text-[11px] font-medium uppercase tracking-wide text-white/70">{label}</div><div className="text-2xl font-bold">{value}</div>{sub && <div className="text-xs text-white/70">{sub}</div>}</div>
}

function RowView({ row, mine, onClick, highlight }: { row: Row; mine: boolean; onClick?: () => void; highlight: boolean }) {
  const inner = (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-semibold text-white">{row.rank}</span>
      <Avatar agent={{ id: row.id, name: row.name, photoUrl: '' }} size={40} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-900">{mine ? `${row.name} (you)` : row.name}</span></span>
        <span className="block truncate text-xs text-slate-500">{row.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Stars rating={row.rating} size={12} />{row.rating.toFixed(2)} ({row.reviews})</span>
      </span>
      <span className="shrink-0 text-right"><span className="block text-lg font-bold text-slate-900">{row.score}</span><span className="block text-[11px] text-slate-500">Search Rank Score</span></span>
    </>
  )
  const cls = `flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${mine ? `border-blue-500 ring-2 ring-blue-200 ${highlight ? 'animate-pulse bg-blue-50' : 'bg-blue-50/40'}` : 'border-slate-200 hover:bg-slate-50'}`
  return onClick ? <button onClick={onClick} className={cls} aria-label={`${row.name}, rank ${row.rank}, score ${row.score}. Why are they ahead?`}>{inner}</button> : <div className={cls} data-me="true">{inner}</div>
}

export default function SearchRankPage() {
  const store = useStore()
  const agent = store.agents[store.viewerId]!
  const srs = useSrs(agent)
  // why the score is what it is: what earned each driver's points and what is still missing, from the same stores the score reads
  const explain = explainSrs(agent)
  const voce = voceStore.use()
  const navigate = useNavigate()
  const fix = useNoraFix()
  const board = leaderboard(agent, srs)
  const me = board.find((r) => r.me)!
  const above = board[me.rank - 2]
  const top = board[0]!
  const toTop = me.me && me.rank === 1 ? 0 : top.score - srs.total
  const toNext = above ? above.score - srs.total : 0
  const stats = ratingStats(agent.reviews)
  const actions = nextActions(agent)
  const pct = Math.round((srs.total / srs.max) * 100)
  const mineByDriver = Object.fromEntries(srs.drivers.map((d) => [d.id, d.points])) as Record<DriverId, number>

  const [show, setShow] = useState(false)
  const [peer, setPeer] = useState<Row | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!show) return
    const el = scroller.current?.querySelector<HTMLElement>('[data-me="true"]')
    if (el && scroller.current) scroller.current.scrollTo({ top: Math.max(0, el.offsetTop - 80), behavior: 'smooth' })
    const t = setTimeout(() => setShow(false), 2500)
    return () => clearTimeout(t)
  }, [show])

  const run = (a: NextAction) => (a.fix === 'profile' ? fix('profile') : navigate(a.to))
  const suggestions: Suggestion[] = actions.slice(0, 3).map((a) => ({ id: a.id, title: a.title, detail: a.detail, impact: `+${a.points} pts`, cta: a.fix ? 'Fix with NORA' : 'Do it', onRun: () => run(a) }))
  const first = actions[0]
  const summary = me.rank === 1
    ? `You are #1 with ${srs.total} points. Keep your lead.${first ? ` The fastest gain is ${first.title.toLowerCase()} (+${first.points}).` : ''}`
    : `You are #${me.rank}, ${toNext} point${toNext === 1 ? '' : 's'} behind ${above!.name}.${first ? ` The fastest gain is ${first.title.toLowerCase()} (+${first.points}).` : ''}`

  const history = scoreHistory(srs.total)
  const labels = history.map((_, i) => (i === history.length - 1 ? 'Now' : `-${history.length - 1 - i}w`))
  const authority = authorityScore(voce)
  const ahead = peer ? whyAhead(peer, mineByDriver) : []

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={TrendingUp} title="Search Rank Score" subtitle="One number for the strength of your whole online presence, and how you compare nearby." right={<Link to="/search-rank/how-it-works" className={BTN_GHOST}><BarChart3 size={15} /> View SRS graph</Link>} />
      <AiInsightBar summary={summary} suggestions={suggestions} question="How do I get to #1 in my area?" answer={srsAnswer(agent)} />

      <Hero title="Search Rank Score Progress Tracker" blurb="Your ranking among top agents in your location, your score and the points to the top.">
        <div className="grid max-w-xl grid-cols-3 gap-3">
          <Stat label="Your ranking" value={`#${me.rank}`} sub={`of ${board.length}`} />
          <Stat label="Your SRS" value={String(srs.total)} sub={`of ${srs.max} · ${bandOf(srs.total).label}`} />
          <Stat label="Points to #1" value={String(toTop)} sub={above ? `${toNext} to next rank` : 'You lead'} />
        </div>
      </Hero>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Card title="Score progress" className="h-full">
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <Ring value={srs.total} max={srs.max} size={132} label={`${pct}% of ${srs.max}`}><span className="text-2xl font-bold text-slate-900">{pct}%</span><span className="text-xs text-slate-500">of {srs.max}</span></Ring>
            <p className="text-sm text-slate-600">You have <b className="text-slate-900">{srs.total}</b> of {srs.max} possible Search Rank points. That is the <b className="text-slate-900">{bandOf(srs.total).label}</b> band ({bandOf(srs.total).min} to {bandOf(srs.total).max}).</p>
          </div>
          <ul className="mt-5 space-y-4">
            {srs.drivers.map((d) => (
              <li key={d.id} className="flex items-end gap-3">
                <div className="min-w-0 flex-1"><ScoreBar label={d.label} points={d.points} max={d.max} tone={d.points >= d.max ? 'bg-emerald-500' : 'bg-blue-500'} right={`${d.points} / ${d.max}  ${Math.round((d.points / d.max) * 100)}%`} />
                  {(() => {
                    const why = explain.find((x) => x.id === d.id)
                    return why && (
                      <div className="mt-1.5 space-y-0.5 text-xs" data-explain={d.id}>
                        {why.contributes.map((c) => <div key={c} className="text-slate-600"><span className="font-medium text-emerald-700">Earned: </span>{c}</div>)}
                        {why.missing.length > 0 && <div className="text-slate-500"><span className="font-medium text-amber-700">Missing: </span>{why.missing.join(' · ')}</div>}
                      </div>
                    )
                  })()}
                </div>
                <Link to={d.to} aria-label={`Improve ${d.label}`} className="shrink-0 rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50">Improve</Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Next best actions" icon={Target} className="h-full">
          {actions.length === 0 ? <p className="text-sm text-slate-500">Nothing left to do right now. Great work.</p> : (
            <ul className="space-y-2.5">
              {actions.slice(0, 5).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900">{a.title}</div><div className="text-xs text-slate-500">{a.detail}</div></div>
                  <Pill tone="green">+{a.points} pts</Pill>
                  <button onClick={() => run(a)} className={BTN_PRIMARY + ' !px-3 !py-1.5 !text-xs'}>{a.fix ? <Sparkles size={13} /> : <ArrowRight size={13} />} {a.fix ? 'Fix with NORA' : 'Go'}</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Card title="My Profile" className="h-full" right={
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
            Show my position
            <button type="button" role="switch" aria-checked={show} aria-label="Show my position" onClick={() => setShow((v) => !v)} className={`relative h-5 w-9 rounded-full transition ${show ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${show ? 'left-[18px]' : 'left-0.5'}`} /></button>
          </label>
        }>
          <div className="flex items-center gap-3 rounded-xl border border-blue-500 bg-blue-50/40 p-3 ring-2 ring-blue-200">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-semibold text-white">{me.rank}</span>
            <Avatar agent={agent} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-900">{agent.name}</span>{agent.pro && <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">PRO</span>}</div>
              <div className="truncate text-xs text-slate-500">{agent.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500"><Stars rating={stats.avg} size={12} />{stats.avg.toFixed(2)} ({stats.count})</div>
            </div>
            <div className="text-right"><div className="text-xl font-bold text-slate-900">{srs.total}</div><div className="text-[11px] text-slate-500">Search Rank Score</div></div>
          </div>
          <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-semibold text-slate-900"><Trophy size={16} className="text-amber-500" /> Top agents in your location</h3>
          <ScrollFade maxHeight={520} scrollerRef={scroller} innerClassName="space-y-2.5">
            {board.map((r) => <RowView key={r.id} row={r} mine={r.me} highlight={show} onClick={r.me ? undefined : () => setPeer(r)} />)}
          </ScrollFade>
          <p className="mt-3 text-xs text-slate-400">Tap an agent to see why they are ahead of you.</p>
        </Card>
        <div className="flex flex-col gap-5">
          <Card title="Score history" className="flex-1" icon={TrendingUp} right={<span className="text-xs text-slate-400">Last 12 weeks</span>}>
            <LineChart labels={labels} series={[{ id: 'srs', name: 'Search Rank Score', color: '#2563eb', values: history }]} height={250} label={`Search Rank Score over the last 12 weeks, now ${srs.total}`} />
          </Card>
          <Card title="AI Authority" icon={Sparkles}>
            <div className="flex items-center gap-4">
              <Ring value={authority} max={100} size={84} stroke={8} tone="stroke-purple-500" label={`AI Authority ${authority} of 100`}><span className="text-lg font-bold text-slate-900">{authority}</span></Ring>
              <div className="min-w-0 text-sm text-slate-600">
                <span className="mt-1 inline-block rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">Counts toward your visibility in v3</span>
                <p className="mt-2 text-xs">Not part of the 850 yet. It shows how likely AI assistants are to recommend you.</p>
              </div>
            </div>
            <Link to="/ai-visibility" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:underline">Open AI Visibility <ArrowRight size={14} /></Link>
          </Card>
        </div>
      </div>

      {peer && (
        <Modal title={`Why ${peer.name} is ahead`} onClose={() => setPeer(null)} width="max-w-md" footer={<button className={BTN_PRIMARY} onClick={() => setPeer(null)}>Close</button>}>
          {peer.score <= srs.total ? <p className="text-sm text-slate-600">{peer.name} has {peer.score} points, below your {srs.total}. You are ahead of them.</p> : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{peer.name} has {peer.score} points, {peer.score - srs.total} more than you.</p>
              <ul className="space-y-1.5">
                {ahead.map((a) => <li key={a.driver} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-700">{a.label}</span><Pill tone="amber">+{a.diff} pts</Pill></li>)}
                {ahead.length === 0 && <li className="text-sm text-slate-500">Their lead is spread evenly across the drivers.</li>}
              </ul>
              <div className="text-xs text-slate-400">Their breakdown: {Object.entries(peerBreakdown(peer.id, peer.score)).map(([k, v]) => `${k} ${v}`).join(', ')}.</div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

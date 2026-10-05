import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Cpu, ListChecks, Target, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { OS_MODULES, collectIssues, noraOsStore, resolvedIssues, skillForIssue, useOsRefresh, type OsIssue, type OsModule, type Severity } from '../../presence/noraOs'
import { getSkill } from '../../nora/skillRegistry'
import { bandOf, useSrs } from '../../presence/srs'
import { useNora, useNoraFix } from '../NoraContext'
import { timeAgo } from '../selectors'
import { useStore } from '../store'
import { BTN_OUTLINE, BTN_PRIMARY } from '../ui/Modal'
import { Pill, Tabs, type PillTone } from '../ui/kit'
import { Card, EmptyState, KpiCell, KpiGrid, PageHeader } from '../ui/PageBits'

type Tab = 'issues' | 'activity'
const SEVERITY: Record<Severity, { label: string; tone: PillTone }> = { high: { label: 'High', tone: 'red' }, medium: { label: 'Medium', tone: 'amber' }, low: { label: 'Low', tone: 'slate' } }
const SMALL = '!px-3 !py-1.5 !text-xs'
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** NORA OS: every issue and tracker NORA is watching, across all modules, in one place. */
export default function NoraOsPage() {
  useOsRefresh()
  const state = useStore()
  const agent = state.agents[state.viewerId]!
  const srs = useSrs(agent)
  const history = noraOsStore.use()
  const issues = collectIssues(agent)
  const resolved = resolvedIssues(history)
  const [tab, setTab] = useState<Tab>('issues')
  /** The skill whose activity is shown on the NORA activity tab; null shows everything. */
  const [skill, setSkill] = useState<string | null>(null)
  const openActivity = (skillId: string | null) => { setSkill(skillId); setTab('activity') }

  const high = issues.filter((i) => i.severity === 'high').length
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={Cpu} title="NORA OS" subtitle="Everything NORA is watching across your presence: open issues, resolved work and what NORA did." />
      <KpiGrid>
        <KpiCell icon={AlertTriangle} label="Open issues" value={issues.length} sub={issues.length ? 'Across all modules' : 'Nothing needs you'} />
        <KpiCell icon={Target} label="High priority" value={high} sub={high ? 'Worth doing first' : 'None right now'} />
        <KpiCell icon={CheckCircle2} label="Resolved" value={resolved.length} sub="Since you started" />
        <KpiCell icon={Activity} label="Search Rank Score" value={<>{srs.total}<span className="text-sm font-medium text-slate-400"> / {srs.max}</span></>} sub={<>{bandOf(srs.total).label} · <Link to="/search-rank" className="text-blue-600 hover:underline">View breakdown</Link></>} />
      </KpiGrid>
      <Tabs<Tab>
        value={tab} onChange={setTab} label="NORA OS sections"
        tabs={[
          { id: 'issues', label: 'Issues', icon: ListChecks, badge: <span className="ml-1 rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">{issues.length}</span> },
          { id: 'activity', label: 'NORA activity', icon: Activity },
        ]}
      />
      {tab === 'issues' && <Issues issues={issues} resolved={resolved} firstSeen={(id) => history.seen[id]?.firstSeen} onOpenActivity={openActivity} />}
      {tab === 'activity' && <ActivityLog skill={skill} onSkill={setSkill} />}
    </div>
  )
}

function Issues({ issues, resolved, firstSeen, onOpenActivity }: { issues: OsIssue[]; resolved: ReturnType<typeof resolvedIssues>; firstSeen: (id: string) => string | undefined; onOpenActivity: (skillId: string | null) => void }) {
  const [module, setModule] = useState<OsModule | 'All'>('All')
  const [view, setView] = useState<'open' | 'resolved'>('open')
  const nav = useNavigate()
  const fix = useNoraFix()
  const shown = issues.filter((i) => module === 'All' || i.module === module)
  const done = resolved.filter((r) => module === 'All' || r.module === module)
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by module">
          <button className={chip(module === 'All')} onClick={() => setModule('All')}>All</button>
          {OS_MODULES.map((m) => {
            const n = issues.filter((i) => i.module === m).length
            return <button key={m} className={chip(module === m)} onClick={() => setModule(m)}>{m}{n > 0 && <span className="ml-1 opacity-70">{n}</span>}</button>
          })}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium" role="group" aria-label="Status">
          {(['open', 'resolved'] as const).map((v) => <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-md px-3 py-1.5 capitalize ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{v}{v === 'resolved' ? ` (${resolved.length})` : ` (${issues.length})`}</button>)}
        </div>
      </div>

      {view === 'open' && (shown.length === 0 ? <EmptyState>{issues.length ? `No open issues in ${module}.` : 'No open issues. NORA will list anything new here.'}</EmptyState> : (
        <ul className="space-y-2.5">
          {shown.map((i) => (
            <li key={i.id} data-issue={i.id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={SEVERITY[i.severity].tone}>{SEVERITY[i.severity].label}</Pill>
                  <Pill tone="blue">{i.module}</Pill>
                  {i.impact && <Pill tone="green">{i.impact}</Pill>}
                  {i.nora && <Pill tone="purple">NORA can do this</Pill>}
                </div>
                <h3 className="mt-1.5 text-[15px] font-semibold text-slate-900">{i.title}</h3>
                <p className="mt-0.5 text-sm text-slate-600">{i.detail}</p>
                {firstSeen(i.id) && <p className="mt-1 text-[11px] text-slate-400">Open since {timeAgo(firstSeen(i.id)!)}</p>}
              </div>
              {i.nora
                ? <button className={`${BTN_PRIMARY} ${SMALL}`} onClick={() => fix(i.nora)}>{i.cta} <ArrowRight size={13} /></button>
                : <button className={`${BTN_OUTLINE} ${SMALL}`} onClick={() => nav(i.to)}>{i.cta} <ArrowRight size={13} /></button>}
            </li>
          ))}
        </ul>
      ))}

      {view === 'resolved' && (done.length === 0 ? <EmptyState>Nothing resolved yet. Fixed issues move here with the time they were closed.</EmptyState> : (
        <ul className="space-y-2">
          {done.map((r) => {
            const handledBy = skillForIssue(r.id)
            return (
              <li key={`${r.id}-${r.resolvedAt}`}>
                <button onClick={() => onOpenActivity(handledBy)} data-resolved={r.id} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-card transition hover:border-blue-300">
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{r.title}</span>
                    <span className="block text-xs text-slate-500">{r.module} · open {when(r.firstSeen)} · resolved {when(r.resolvedAt!)}{handledBy ? ` · by ${getSkill(handledBy)?.name ?? handledBy}` : ' · fixed by hand'}</span>
                  </span>
                  <Pill tone="green">Resolved</Pill>
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600">See what NORA did <ChevronRight size={14} /></span>
                </button>
              </li>
            )
          })}
        </ul>
      ))}
    </div>
  )
}

function ActivityLog({ skill, onSkill }: { skill: string | null; onSkill: (skillId: string | null) => void }) {
  const { state } = useNora()
  const all = [...state.log].reverse()
  const log = (skill ? all.filter((l) => l.skillId === skill) : all).slice(0, 40)
  const name = (id: string) => getSkill(id)?.name ?? id
  // a skill that has run, or that has entries, can be picked; the one being viewed always stays in the list
  const skills = [...new Set([...state.handled, ...(skill ? [skill] : [])])]
  const outcome = (id: string) => (state.lastOutcome?.skillId === id ? state.lastOutcome.outcome : 'handled')
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card
        title={skill ? <>What NORA did: {name(skill)}</> : 'What NORA did'}
        right={skill
          ? <button onClick={() => onSkill(null)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"><X size={12} /> Show all</button>
          : <span className="text-xs text-slate-400">This session, newest first</span>}
      >
        {log.length === 0
          ? <p className="text-sm text-slate-500">{skill ? `NORA has no record of running ${name(skill)} this session. It was fixed outside NORA, or before this session started.` : 'NORA has not done anything yet.'}</p>
          : (
            <ol className="space-y-2" data-activity={skill ?? 'all'}>
              {log.map((l, i) => <li key={`${l.at}-${i}`} className="flex items-start gap-3 text-sm"><span className="w-28 shrink-0 text-xs text-slate-400">{when(new Date(l.at).toISOString())}</span><span className="text-slate-700">{l.message}</span></li>)}
            </ol>
          )}
      </Card>
      <Card title="Skills handled" right={skill ? undefined : <span className="text-xs text-slate-400">Pick one to filter</span>}>
        {skills.length === 0 ? <p className="text-sm text-slate-500">No skill has run yet. Fix something with NORA and it is listed here.</p> : (
          <ul className="space-y-1.5 text-sm">
            {skills.map((id) => (
              <li key={id}>
                <button onClick={() => onSkill(skill === id ? null : id)} aria-pressed={skill === id} data-skill-filter={id} className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${skill === id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <span className="font-medium text-slate-800">{name(id)}</span>
                  <Pill tone={outcome(id) === 'applied' ? 'green' : 'slate'}>{outcome(id)}</Pill>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

import { Check, CheckCircle2, ChevronRight, ExternalLink, Eye, EyeOff, Info, Loader2, ShieldCheck, Square, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { NoraEngine } from '../../nora/noraEngine'
import type { Evaluation, NoraState } from '../../nora/noraMachine'
import { getSkill } from '../../nora/skillRegistry'
import type { Skill } from '../../skills/types'
import { useNora, useNoraFocus, useNoraProcessing, useNoraStop } from '../NoraContext'
import { ConsentModal } from './ConsentModal'
import { suggestionsHidden } from './suggestionsHidden'
import { graphChanges } from './graphDiff'
import { BTN_GHOST, BTN_PRIMARY } from './Modal'

export { suggestionsHidden }

const WORKING: Record<string, string> = {
  IDLE: 'Signing you in…',
  CHECKING: 'Reading your profile and checking what I can help with…',
  RE_EVALUATING: 'Checking for anything else…',
}
const RUN_STEP: Record<string, number> = { SKILL_APPROVED: 0, READING: 0, VALIDATING: 1 }
const STEPS = ['Read', 'Validate', 'Draft']
const PROPOSED_OR_RUNNING = new Set(['SKILL_PROPOSED', 'SKILL_APPROVED', 'READING', 'VALIDATING', 'DRAFT_READY', 'WRITE_APPROVAL', 'WRITING', 'RESULT_READY'])

const CARD = 'rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-card'
const Chip = ({ tone = 'slate', children }: { tone?: 'slate' | 'green' | 'blue'; children: ReactNode }) => (
  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${tone === 'green' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{children}</span>
)
const SMALL = '!px-3 !py-1.5 !text-xs'

/** NORA's recommendations: one numbered action card per applicable skill, in ranked order. */
export function NoraActions() {
  const { engine, state } = useNora()
  const s = state.status
  const hidden = suggestionsHidden.use()
  const toggle = () => suggestionsHidden.set(!hidden)

  if (s in WORKING) {
    return <div className={`${CARD} flex items-center gap-2 text-slate-700`}><Loader2 size={15} className="animate-spin text-purple-500" /> {WORKING[s]}</div>
  }

  if (PROPOSED_OR_RUNNING.has(s)) {
    // the chosen action comes first and is always shown while it runs, even if the user tucked the suggestions away
    const chosen = state.selectedSkillId
    const queue = [...state.evaluations].filter((e) => e.rank).sort((a, b) => Number(b.skillId === chosen) - Number(a.skillId === chosen) || a.rank! - b.rank!)
    const shown = hidden && s !== 'SKILL_PROPOSED' ? queue.filter((e) => e.skillId === chosen) : queue
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-blue-600">Found {queue.length} high-impact {queue.length === 1 ? 'opportunity' : 'opportunities'}</p>
          <span className="flex items-center gap-3">
            <button onClick={toggle} aria-expanded={!hidden} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-600">{hidden ? <><Eye size={13} /> Show</> : <><EyeOff size={13} /> Hide</>}</button>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> NORA live</span>
          </span>
        </div>
        {(!hidden || shown.length > 0 && s !== 'SKILL_PROPOSED') && shown.map((e) => <ActionCard key={e.skillId} engine={engine} state={state} evaluation={e} />)}
      </div>
    )
  }

  switch (s) {
    case 'COMPLETED': {
      const changes = state.previousGraph && state.graph ? graphChanges(state.previousGraph, state.graph) : []
      const consent = getSkill(state.lastOutcome?.skillId ?? '')?.consent
      return (
        <div className={CARD}>
          <p className="flex items-center gap-2 font-medium text-emerald-700"><CheckCircle2 size={17} /> {state.insight ? 'Noted.' : consent ? `Done. ${consent.provider} is connected.` : 'Done. Saved to your profile.'}</p>
          {changes.length > 0 && (
            <div className="mt-2 rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600">
              <div className="mb-1 font-sans font-semibold text-slate-500">Graph updated</div>
              {changes.map((c) => <div key={c.path}>{c.path}: {c.before} → {c.after}</div>)}
            </div>
          )}
        </div>
      )
    }
    case 'REJECTED':
      return <div className={CARD}><p className="flex items-center gap-2 font-medium text-slate-700"><ShieldCheck size={17} /> No changes made.</p></div>
    case 'ALL_GOOD':
    case 'EXPLORE':
      return (
        <div className="space-y-3">
          <div className={CARD}>
            <p className="flex items-center gap-2 font-medium text-slate-900"><CheckCircle2 size={17} className="text-emerald-600" /> You’re all set for now.</p>
            <p className="mt-1 text-xs text-slate-500">{state.lastOutcome?.outcome === 'rejected' ? 'I skipped what you declined. Nothing else needs your attention.' : 'Nothing needs your attention right now.'}</p>
          </div>
          {state.explore && <Explore card={state.explore} />}
          <Why state={state} />
        </div>
      )
    case 'ERROR':
      return (
        <div className={CARD}>
          <p className="font-medium text-rose-700">Something went wrong.</p>
          <p className="mt-1 text-xs text-slate-600">{state.error}</p>
          <button className={`${BTN_GHOST} mt-2 ${SMALL}`} onClick={() => void engine.reset(state.scenario ?? 'live')}>Try again</button>
        </div>
      )
    default:
      return null
  }
}

function ActionCard({ engine, state, evaluation: e }: { engine: NoraEngine; state: NoraState; evaluation: Evaluation }) {
  const [analysis, setAnalysis] = useState(false)
  const [consenting, setConsenting] = useState(false)
  /** The user's own wording for a skill that lets them edit the draft; null means untouched. */
  const [edited, setEdited] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const focusTick = useNoraFocus()
  const processing = useNoraProcessing()
  const stop = useNoraStop()
  const skill = getSkill(e.skillId)!
  const graph = state.graph!
  const selected = e.skillId === state.selectedSkillId
  const s = state.status
  const outcome = skill.expectedOutcome?.(graph)

  useEffect(() => setEdited(null), [state.draft?.summary])
  const canEdit = !!skill.editDraft && s === 'WRITE_APPROVAL'
  const draftText = edited ?? state.draft?.changes[0]?.after ?? ''
  const editInvalid = canEdit && (!draftText.trim() || (skill.editLimit ? draftText.length > skill.editLimit : false))
  /** Approving posts exactly what is in the box: the edit is handed to the engine first. */
  const approve = () => {
    if (canEdit && edited !== null && edited !== state.draft?.changes[0]?.after) engine.editDraft(edited.trim())
    void engine.approveWrite()
  }

  // keep the user's eyes on the current action as it moves: the card while NORA works, the approve buttons once it needs a decision
  useEffect(() => {
    if (!selected) return
    const el = s === 'WRITE_APPROVAL' || s === 'WRITING' ? actionsRef.current : s === 'RESULT_READY' || s in RUN_STEP || s === 'DRAFT_READY' || s === 'SKILL_PROPOSED' ? ref.current : null
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected, s])

  // a "fix with NORA" link brings the targeted card into view
  useEffect(() => {
    if (selected && focusTick > 0) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusTick, selected])

  return (
    <div ref={ref} data-skill={e.skillId} className={`${CARD} transition ${selected ? (processing ? 'ring-2 ring-purple-400' : '') : 'opacity-70'}`}>
      <Chip tone="blue">Action {e.rank}</Chip>
      <h3 className="mt-2 text-[15px] font-semibold leading-snug text-slate-900">{skill.proposal(graph).message}</h3>

      {selected && s === 'SKILL_PROPOSED' && (
        <>
          <p className="mt-1.5 text-slate-600">{e.reason}.</p>
          <Chips skill={skill} />
          {outcome && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Expected outcome</div>
              <div className="mt-0.5 text-xs text-slate-500">{outcome.label}</div>
              <div className="text-sm font-semibold text-slate-900">{outcome.before} → {outcome.after}</div>
            </div>
          )}
          {analysis && <Analysis skill={skill} e={e} />}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button onClick={() => setAnalysis((a) => !a)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">View Analysis <ChevronRight size={14} className={analysis ? 'rotate-90' : ''} /></button>
            <div className="flex gap-2">
              <button className={`${BTN_GHOST} ${SMALL}`} onClick={() => void engine.declineStart()}>Not now</button>
              <button className={`${BTN_PRIMARY} ${SMALL}`} onClick={() => void engine.approveStart()}>{state.proposal!.cta} <ChevronRight size={14} /></button>
            </div>
          </div>
        </>
      )}

      {selected && s in RUN_STEP && (
        <div className="mt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-slate-600"><Loader2 size={14} className="animate-spin text-purple-500" /> {s === 'VALIDATING' ? 'Validating and preparing a draft…' : 'Reading your data. Nothing is changed.'}</p>
            <button onClick={stop} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"><Square size={9} fill="currentColor" /> Stop</button>
          </div>
          <ol className="mt-2 flex gap-1.5 text-[11px]">
            {STEPS.map((l, i) => <li key={l} className={`rounded-full px-2.5 py-0.5 ${i < RUN_STEP[s]! ? 'bg-emerald-50 text-emerald-700' : i === RUN_STEP[s] ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>{l}</li>)}
          </ol>
        </div>
      )}

      {selected && (s === 'DRAFT_READY' || s === 'WRITE_APPROVAL' || s === 'WRITING') && (
        <>
          <p className="mt-1 text-xs text-slate-500">
            {state.draft!.summary} ·{' '}
            {skill.allowedModel === 'none'
              ? 'no AI model used'
              : state.draft!.source === 'ai'
              ? `written by ${state.draft!.model ?? skill.allowedModel}`
              : state.draft!.source === 'mock'
                ? `template draft${state.draft!.note ? ` (${state.draft!.note.replace(/\.$/, '')})` : ''}`
                : `drafted with ${skill.allowedModel}`}
          </p>
          <div className="mt-3 space-y-2.5">
            {state.draft!.changes.map((c, i) => (
              <div key={c.label} className="overflow-hidden rounded-lg border border-slate-200 text-xs">
                <div className="bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">{c.label}</div>
                <div className="border-b border-slate-200 p-2.5"><div className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">Before</div><p className="mt-0.5 text-slate-500">{c.before}</p></div>
                <div className="bg-emerald-50/60 p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">After{i === 0 && skill.editDraft ? ' (you can edit it)' : ''}</div>
                  {i === 0 && canEdit
                    ? (
                      <>
                        <textarea value={draftText} onChange={(e) => setEdited(e.target.value)} rows={5} aria-label="Reply text" className="mt-1 w-full resize-y rounded-md border border-emerald-200 bg-white p-2 text-xs leading-relaxed text-slate-900 focus:border-emerald-400 focus:outline-none" />
                        {skill.editLimit && <div className={`mt-0.5 text-right text-[10px] ${draftText.length > skill.editLimit ? 'text-rose-600' : 'text-slate-400'}`}>{draftText.length} / {skill.editLimit}</div>}
                      </>
                    )
                    : <p className="mt-0.5 text-slate-900">{c.after}</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{skill.consent ? `Nothing is connected until you allow access on ${skill.consent.provider}’s screen.` : 'Nothing is saved until you approve.'}</p>
          <div ref={actionsRef} className="mt-2.5 flex justify-end gap-2">
            <button className={`${BTN_GHOST} ${SMALL}`} disabled={s !== 'WRITE_APPROVAL'} onClick={() => void engine.rejectWrite()}><X size={13} /> Reject</button>
            <button className={`${BTN_PRIMARY} ${SMALL}`} disabled={s !== 'WRITE_APPROVAL' || editInvalid} onClick={() => (skill.consent ? setConsenting(true) : approve())}>
              {s === 'WRITING' ? <Loader2 size={13} className="animate-spin" /> : skill.consent ? <ShieldCheck size={13} /> : <Check size={13} />} {s === 'WRITING' ? (skill.consent ? 'Connecting…' : 'Applying…') : (skill.consent?.cta ?? skill.approveCta ?? 'Approve & Apply')}
            </button>
          </div>
          {consenting && skill.consent && s === 'WRITE_APPROVAL' && <ConsentModal request={skill.consent} onCancel={() => setConsenting(false)} onAllow={() => { setConsenting(false); void engine.approveWrite() }} />}
        </>
      )}

      {selected && s === 'RESULT_READY' && (
        <>
          <p className="mt-2 flex items-center gap-2 font-medium text-slate-900"><Info size={16} className="text-sky-600" /> {state.insight!.title}</p>
          <p className="mt-1 text-slate-600">{state.insight!.body}</p>
          <p className="mt-1 text-[11px] text-slate-500">Read-only insight. Nothing was written.</p>
          <button className={`${BTN_PRIMARY} mt-3 ${SMALL}`} onClick={() => void engine.acknowledgeInsight()}>Got it</button>
        </>
      )}

      {!selected && <p className="mt-1 text-xs text-slate-500">Up next · {e.reason}</p>}
    </div>
  )
}

function Chips({ skill }: { skill: Skill }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      <Chip tone="green">{skill.consent ? `You allow access on ${skill.consent.provider}` : skill.kind === 'action' ? 'NORA prepares a draft' : 'Read-only insight'}</Chip>
      {skill.requiresApproval && <Chip>Needs your approval</Chip>}
      {skill.allowedModel !== 'none' && <Chip>{skill.allowedModel}</Chip>}
    </div>
  )
}

function Analysis({ skill, e }: { skill: Skill; e: Evaluation }) {
  return (
    <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
      <div><span className="font-semibold text-slate-700">Why:</span> {e.reason}</div>
      <div><span className="font-semibold text-slate-700">Ranking:</span> priority {e.priority}, relevance {e.relevance}, {e.kind} skill</div>
      <div><span className="font-semibold text-slate-700">Use when:</span> {skill.whenToUse.join('; ')}</div>
      <div><span className="font-semibold text-slate-700">Skip when:</span> {skill.whenNotToUse.join('; ')}</div>
    </div>
  )
}

/** VOCE is external; the prototype shows the mock redirect instead of leaving the page. */
function Explore({ card }: { card: NonNullable<NoraState['explore']> }) {
  const [redirect, setRedirect] = useState<string | null>(null)
  return (
    <div className={CARD}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Explore something new</div>
      <div className="mt-1 text-xs font-semibold text-purple-600">VOCE</div>
      <p className="font-medium text-slate-900">{card.headline}</p>
      <p className="mt-0.5 text-xs text-slate-500">{card.body}</p>
      {card.stats && (
        <dl className="mt-2.5 grid grid-cols-3 gap-1.5">
          {card.stats.map((x) => <div key={x.label} className="rounded-lg bg-slate-50 p-2"><dd className="text-base font-semibold">{x.value}</dd><dt className="text-[10px] leading-tight text-slate-500">{x.label}</dt></div>)}
        </dl>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {card.actions.map((a) => (
          <button key={a.label} onClick={() => setRedirect(a.url)} className={`${a.primary ? 'bg-purple-600 text-white hover:brightness-110' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'} inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium`}>
            {a.label} <ExternalLink size={12} />
          </button>
        ))}
      </div>
      {redirect && <p className="mt-2 break-all rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-[11px] text-slate-600">Mock redirect → {redirect}<span className="block font-sans text-slate-400">The prototype does not leave this page.</span></p>}
    </div>
  )
}

/** Why NORA had nothing (or what it considered): kept small, but it shows NORA isn't guessing. */
function Why({ state }: { state: NoraState }) {
  if (!state.evaluations.length) return null
  const rows = [...state.evaluations].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.priority - a.priority)
  return (
    <details className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none font-medium text-slate-600">How NORA decided</summary>
      <p className="mt-2 text-slate-500">NORA read your profile data and asked each skill whether it applies, then ranked the ones that do.</p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((e) => (
          <li key={e.skillId} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-800">{e.name}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${e.applies && !e.handled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{e.handled ? 'handled' : e.applies ? 'applies' : 'n/a'}</span>
            </div>
            <div className="text-slate-500">{e.reason}</div>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[10px] text-slate-400">state: {state.status}</p>
    </details>
  )
}

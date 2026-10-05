import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useMatch } from 'react-router-dom'
import { guardChat, maskNotice } from '../guardrails'
import { startTrace } from '../guardrails/trace'
import { buildGraph } from '../mock/graph'
import { DEFAULT_SCENARIO } from '../mock/user'
import { NoraEngine } from '../nora/noraEngine'
import type { NoraState, NoraStatus } from '../nora/noraMachine'
import { getSkill } from '../nora/skillRegistry'
import { answer, intentOf, type AiAnswer } from './assistant'
import { connectionsStore } from '../presence/connections'
import { resetPresence } from '../presence/persist'
import { actions as profileActions, getState as getProfileState, subscribe as subscribeProfile, useStore } from './store'
import type { Agent } from './types'
import { ReferralModal } from './ui/ReferralModal'
import { graphChanges } from './ui/graphDiff'

export interface ChatTurn { id: number; role: 'user' | 'ai'; text?: string; answer?: AiAnswer; /** The flow trace of the message this answers. */ traceId?: string }

interface Chat {
  /** The agent the conversation is about (the profile being viewed, else you). */
  agent: Agent
  turns: ChatTurn[]
  pending: boolean
  ask: (question: string) => void
  /** Post a question with a ready-made answer (pages use this for "Ask NORA about this"). */
  askWith: (question: string, answer: AiAnswer) => void
  clear: () => void
}

interface Ctx {
  engine: NoraEngine
  open: boolean
  setOpen: (open: boolean) => void
  chat: Chat
  openReferral: (agentId: string, text?: string) => void
  /** Restore the seed data, restart NORA on the live profile and clear the chat. */
  resetDemo: () => void
  /** "Fix this with NORA": open the panel, target the matching action, start it, and narrate in the chat. */
  fix: (domain?: string) => void
  /** Bumps whenever something asks NORA to take the user's attention (scrolls the target card into view). */
  focusTick: number
  /** True while NORA is actively working (reading, validating, drafting, writing). */
  processing: boolean
  /** Stop the run in progress (not possible once it is writing). */
  stop: () => void
  /** Bring NORA up in the centre of the screen. */
  greet: () => void
}

const NoraCtx = createContext<Ctx | null>(null)
/** How long after login (or after switching to someone else's profile) NORA waits before appearing. */
export const GREET_DELAY_MS = 5000

/** Engine states in which NORA is working rather than waiting for the user. */
const PROCESSING = new Set<NoraStatus>(['SKILL_APPROVED', 'READING', 'VALIDATING', 'DRAFT_READY', 'WRITING'])

/**
 * App-wide NORA: one engine (state survives navigation), one chat, one panel open/closed flag.
 * The engine also re-checks whenever the profile is edited elsewhere (Edit Profile, About).
 */
export function NoraProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => new NoraEngine())
  const nora = useSyncExternalStore(engine.subscribe, engine.getState)
  // Landing on the app no longer pops NORA open: the issues it found appear above the floating NORA button instead,
  // and picking one opens NORA with that skill selected.
  const [open, setOpen] = useState(false)
  const [referral, setReferral] = useState<{ agentId: string; text?: string } | null>(null)
  const [focusTick, setFocusTick] = useState(0)

  /* engine lifecycle */
  useEffect(() => {
    void engine.reset(DEFAULT_SCENARIO)
  }, [engine])
  useEffect(() => {
    const recheck = () => {
      const s = engine.getState()
      if (s.status !== 'SKILL_PROPOSED' && s.status !== 'EXPLORE') return
      if (JSON.stringify(buildGraph()) !== JSON.stringify(s.graph)) void engine.refresh()
    }
    // the Profile page and the Connections page both feed NORA's graph, so a change on either re-checks it
    const offs = [subscribeProfile(recheck), connectionsStore.subscribe(recheck)]
    return () => offs.forEach((off) => off())
  }, [engine])

  const processing = PROCESSING.has(nora.status)
  // A run that starts while NORA is minimized brings it up. Minimizing mid-run is allowed and sticks.
  const wasProcessing = useRef(false)
  useEffect(() => {
    if (processing && !wasProcessing.current) setOpen(true)
    wasProcessing.current = processing
  }, [processing])

  /* chat, scoped to the profile being viewed */
  const match = useMatch('/profile/:id')
  const store = useStore()
  const agent = store.agents[match?.params.id ?? ''] ?? store.agents[store.viewerId]!
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const seq = useRef(0)

  useEffect(() => {
    clearTimeout(timer.current)
    setTurns([])
    setPending(false)
  }, [agent.id])
  useEffect(() => () => clearTimeout(timer.current), [])

  // NORA appears a few seconds after you switch to a different profile. Opening or minimizing it yourself
  // in the meantime cancels that, and a second switch restarts the wait.
  const openRef = useRef(open)
  const openChanges = useRef(0)
  useEffect(() => {
    openRef.current = open
    openChanges.current++
  }, [open])
  const shownAgent = useRef<string | null>(null)
  useEffect(() => {
    const previous = shownAgent.current
    shownAgent.current = agent.id
    if (previous === null || previous === agent.id || openRef.current) return // first load, no switch, or already up
    const stamp = openChanges.current
    const t = setTimeout(() => {
      if (!openRef.current && openChanges.current === stamp) setOpen(true)
    }, GREET_DELAY_MS)
    return () => clearTimeout(t)
  }, [agent.id])

  const agentId = agent.id
  const ask = useCallback(
    (question: string) => {
      if (!question.trim()) return
      // input guardrails: the message is shown and answered with sensitive details masked; injection, unsafe or out-of-scope requests are refused
      const guard = guardChat(question.trim())
      const q = guard.input
      setOpen(true)
      setTurns((t) => [...t, { id: ++seq.current, role: 'user', text: q }])
      setPending(true)
      clearTimeout(timer.current)

      // flow trace: input -> guardrails -> agent -> LLM -> reply, filled in as each step finishes
      const tr = startTrace('chat', q)
      tr.add({ id: 'input', stage: 'input', label: 'You typed in NORA chat', status: 'pass', detail: `"${q.slice(0, 90)}${q.length > 90 ? '…' : ''}"${Object.keys(guard.masked).length ? ' (shown masked)' : ''}` })
      guard.checks.forEach((c) => tr.add({ id: c.id, stage: 'guardrails', label: c.label, status: 'pending', detail: 'Checking…' }))
      tr.add({ id: 'agent', stage: 'agent', label: 'Agent: NORA', status: 'pending', detail: 'Waiting for the guardrails' })
      tr.add({ id: 'llm', stage: 'llm', label: 'LLM', status: 'pending', detail: '' })
      tr.add({ id: 'output', stage: 'output', label: 'Reply to you', status: 'pending', detail: '' })
      guard.checks.forEach((c, i) => setTimeout(() => tr.update(c.id, { status: c.status, detail: c.detail }), 110 * (i + 1)))
      setTimeout(() => tr.update('agent', guard.allowed ? { status: 'pass', detail: `Matched your question to: ${intentOf(q)}` } : { status: 'skip', detail: `Not run: blocked by ${guard.blocked!.method} check` }), 110 * (guard.checks.length + 1))

      timer.current = setTimeout(() => {
        const s = getProfileState()
        const a = s.agents[agentId] ?? s.agents[s.viewerId]!
        let reply: AiAnswer
        if (!guard.allowed) reply = { text: guard.blocked!.message }
        else {
          const base = answer(a, s, q)
          const notice = maskNotice(guard.masked)
          reply = notice ? { ...base, intro: base.intro ? `${notice} ${base.intro}` : notice } : base
        }
        tr.update('llm', { status: 'skip', detail: guard.allowed ? 'No model call. Chat answers are built from your live data with rules.' : 'Not called: blocked before it' })
        tr.update('output', guard.allowed ? { status: 'info', detail: 'Answer shown. Output guardrails are not built yet.' } : { status: 'block', detail: `Refused: ${guard.blocked!.message}` })
        tr.finish(guard.allowed ? 'answered' : 'blocked')
        setTurns((t) => [...t, { id: ++seq.current, role: 'ai', answer: reply, traceId: tr.id }])
        setPending(false)
      }, 700)
    },
    [agentId],
  )
  const askWith = useCallback((question: string, ready: AiAnswer) => {
    setOpen(true)
    setTurns((t) => [...t, { id: ++seq.current, role: 'user', text: question }])
    setPending(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setTurns((t) => [...t, { id: ++seq.current, role: 'ai', answer: ready }])
      setPending(false)
    }, 600)
  }, [])
  const clear = useCallback(() => {
    clearTimeout(timer.current)
    setTurns([])
    setPending(false)
  }, [])

  /** NORA speaking on its own initiative (no question to answer). */
  const say = useCallback((text: string) => setTurns((t) => [...t, { id: ++seq.current, role: 'ai', answer: { text } }]), [])

  /* "fix this with NORA": narrate the run it started */
  const fixing = useRef(false)
  const fix = useCallback(
    (domain?: string) => {
      setOpen(true)
      setFocusTick((n) => n + 1)
      const s = engine.getState()
      if (PROCESSING.has(s.status) || s.status === 'WRITE_APPROVAL') return // already underway: just bring it into view
      const target = s.evaluations.filter((e) => e.rank).sort((a, b) => a.rank! - b.rank!).find((e) => !domain || getSkill(e.skillId)?.domain === domain)
      if (s.status !== 'SKILL_PROPOSED' || !target) {
        setTurns((t) => [...t, { id: ++seq.current, role: 'user', text: 'Fix this with NORA' }])
        say('There’s nothing to fix right now. Your profile data is in good shape.')
        return
      }
      engine.select(target.skillId)
      fixing.current = true
      setTurns((t) => [...t, { id: ++seq.current, role: 'user', text: `Fix: ${target.name}` }])
      say('On it. I’m reading your data and preparing a draft. Nothing changes until you approve it.')
      void engine.approveStart()
    },
    [engine, say],
  )

  // follow the run it started
  const lastStatus = useRef<NoraStatus>(nora.status)
  useEffect(() => {
    const changed = nora.status !== lastStatus.current
    lastStatus.current = nora.status
    // connecting an account is confirmed in the chat however the run was started, so the result outlasts the card
    if (changed && nora.status === 'COMPLETED') {
      const consent = getSkill(nora.lastOutcome?.skillId ?? '')?.consent
      if (consent && nora.lastOutcome?.outcome === 'applied') {
        const pts = nora.previousGraph && nora.graph ? ` Connection points ${nora.previousGraph.accounts.points} → ${nora.graph.accounts.points} of 100.` : ''
        say(`Done. ${consent.provider} is connected.${pts} You can manage it any time on Connections.`)
        fixing.current = false
        return
      }
    }
    if (!changed || !fixing.current) return
    if (nora.status === 'WRITE_APPROVAL') {
      const consent = getSkill(nora.selectedSkillId ?? '')?.consent
      say(consent ? `Ready. Click “${consent.cta}” in the card above and ${consent.provider} will ask you to allow access. Nothing is connected until you do.` : 'The draft is ready. Review the before and after in the card above, then approve to apply it.')
    }
    else if (nora.status === 'COMPLETED') {
      const changes = nora.previousGraph && nora.graph ? graphChanges(nora.previousGraph, nora.graph) : []
      say(changes.length ? `Done. ${changes.map((c) => `${c.path} ${c.before} → ${c.after}`).join(', ')}.` : 'Done.')
      fixing.current = false
    } else if (nora.status === 'REJECTED') {
      say('No changes made.')
      fixing.current = false
    } else if (nora.status === 'ERROR') fixing.current = false
  }, [nora, say])

  const stop = useCallback(() => {
    void engine.stop()
    // stop + re-evaluate happen in one tick, so narrate here rather than from a status change
    if (fixing.current) {
      fixing.current = false
      say('Stopped. Nothing was changed.')
    }
  }, [engine, say])
  const greet = useCallback(() => setOpen(true), [])
  const resetDemo = useCallback(() => {
    profileActions.reset()
    resetPresence()
    clear()
    fixing.current = false
    setOpen(false) // a fresh start: NORA's suggestions reappear above the floating button instead of opening the panel
    void engine.reset(DEFAULT_SCENARIO)
  }, [engine, clear])
  const openReferral = useCallback((id: string, text?: string) => setReferral({ agentId: id, text }), [])
  const chat = useMemo<Chat>(() => ({ agent, turns, pending, ask, askWith, clear }), [agent, turns, pending, ask, askWith, clear])
  const value = useMemo<Ctx>(
    () => ({ engine, open, setOpen, chat, openReferral, resetDemo, fix, focusTick, processing, stop, greet }),
    [engine, open, chat, openReferral, resetDemo, fix, focusTick, processing, stop, greet],
  )

  const target = referral ? getProfileState().agents[referral.agentId] : undefined
  return (
    <NoraCtx.Provider value={value}>
      {children}
      {referral && target && <ReferralModal agent={target} initialText={referral.text} onClose={() => setReferral(null)} />}
    </NoraCtx.Provider>
  )
}

function useCtx(): Ctx {
  const c = useContext(NoraCtx)
  if (!c) throw new Error('NORA hooks must be used inside <NoraProvider>')
  return c
}

/** Engine plus its reactive state. */
export function useNora(): { engine: NoraEngine; state: NoraState } {
  const { engine } = useCtx()
  const state = useSyncExternalStore(engine.subscribe, engine.getState)
  return { engine, state }
}
export const useNoraPanel = (): { open: boolean; setOpen: (o: boolean) => void } => {
  const { open, setOpen } = useCtx()
  return { open, setOpen }
}
export const useNoraChat = (): Chat => useCtx().chat
export const useReferral = (): Ctx['openReferral'] => useCtx().openReferral
export const useResetDemo = (): Ctx['resetDemo'] => useCtx().resetDemo
export const useNoraFix = (): Ctx['fix'] => useCtx().fix
export const useNoraFocus = (): number => useCtx().focusTick
export const useNoraProcessing = (): boolean => useCtx().processing
export const useNoraStop = (): Ctx['stop'] => useCtx().stop
export const useNoraGreet = (): Ctx['greet'] => useCtx().greet

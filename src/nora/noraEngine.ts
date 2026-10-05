import { checkCompliance, complianceSummary } from '../guardrails/compliance'
import { liveSrs, previewFor } from './scorePreview'
import type { Simulation } from '../presence/srs'
import { startTrace, type StepStatus, type TraceHandle, type Trace, type Stage } from '../guardrails/trace'
import { buildGraph, type Graph } from '../mock/graph'
import { graphChanges } from '../profile/ui/graphDiff'
import { resetDatabase } from '../mock/database'
import type { ScenarioId } from '../mock/types'
import type { Skill } from '../skills/types'
import { generateSkillDraft } from './generateSkillDraft'
import {
  canTransition,
  initialState,
  noraReducer,
  type Evaluation,
  type NoraAction,
  type NoraState,
  type NoraStatus,
  type Outcome,
} from './noraMachine'
import { skillRegistry } from './skillRegistry'

/* ---------- Skill discovery: graph + skill rules -> applicable -> ranked -> selected ---------- */

/** Ask every registered skill whether it applies. NORA holds no domain rules itself. */
export function evaluateSkills(graph: Graph, registry: readonly Skill[], handled: readonly string[]): Evaluation[] {
  const rows = registry.map((skill) => {
    const a = skill.evaluate(graph)
    const isHandled = handled.includes(skill.id)
    return {
      skillId: skill.id,
      name: skill.name,
      kind: skill.kind,
      priority: skill.priority,
      applies: a.applies,
      reason: a.reason,
      relevance: a.relevance,
      handled: isHandled,
      rank: null as number | null,
    }
  })
  const eligible = rows
    .filter((r) => r.applies && !r.handled && r.kind !== 'explore')
    .sort((a, b) => b.priority - a.priority || b.relevance - a.relevance)
  eligible.forEach((r, i) => (r.rank = i + 1))
  return rows
}

/** Highest-ranked eligible skill, or null when nothing is actionable. */
export const selectNext = (evals: Evaluation[]): string | null => evals.find((e) => e.rank === 1)?.skillId ?? null

/** Best exploration opportunity; only consulted once nothing actionable remains. */
export function selectExplore(evals: Evaluation[]): string | null {
  const c = evals.filter((e) => e.kind === 'explore' && e.applies).sort((a, b) => b.relevance - a.relevance)
  return c[0]?.skillId ?? null
}

/** One line on what NORA read, for the flow trace. */
const graphSummary = (g: Graph): string =>
  `profile ${g.profile.completeness}% complete · ${g.listings.incomplete} of ${g.listings.total} listings incomplete · Google ${g.accounts.google ? 'connected' : 'not connected'} (${g.accounts.points} of 100 connection points) · traffic ${g.analytics.changePct >= 0 ? '+' : ''}${g.analytics.changePct}%`

/* ---------- Orchestration ---------- */

export interface NoraEngineOptions {
  registry?: readonly Skill[]
  /** Pause between steps so the demo is readable. 0 in tests. */
  stepDelayMs?: number
}

export class NoraEngine {
  private state: NoraState = initialState()
  private listeners = new Set<() => void>()
  private epoch = 0
  private registry: readonly Skill[]
  private stepDelayMs: number
  /** The flow trace of the skill run in progress (issue found to evals), if one is open. */
  private run: TraceHandle | null = null
  private expected: { label: string; before: string; after: string } | null = null
  /** What the score change was priced at when the run started, to check against what happened. */
  private predicted: Simulation | null = null

  constructor(opts: NoraEngineOptions = {}) {
    this.registry = opts.registry ?? skillRegistry
    this.stepDelayMs = opts.stepDelayMs ?? 450
  }

  /* store API (useSyncExternalStore friendly: getState is stable between changes) */
  getState = (): NoraState => this.state
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private dispatch(action: NoraAction): void {
    const next = noraReducer(this.state, action)
    if (next === this.state) return
    this.state = next
    this.listeners.forEach((l) => l())
  }
  private go(to: NoraStatus, patch?: Partial<NoraState>, note?: string): void {
    if (!canTransition(this.state.status, to)) {
      throw new Error(`Illegal NORA transition ${this.state.status} → ${to}`)
    }
    this.dispatch({ type: 'transition', to, patch, note })
  }
  private note(message: string): void {
    this.dispatch({ type: 'patch', patch: {}, note: message })
  }
  private pause = (scale = 1) =>
    this.stepDelayMs ? new Promise<void>((r) => setTimeout(r, this.stepDelayMs * scale)) : Promise.resolve()
  /* ---------- flow trace of a skill run: user graph, analyze, prioritize, select, routing, guardrails + execute, update, evals ---------- */

  private step(id: string, stage: Stage, label: string, status: StepStatus, detail: string): void {
    this.run?.add({ id, stage, label, status, detail })
  }
  private upd(id: string, status: StepStatus, detail: string): void {
    this.run?.update(id, { status, detail })
  }
  private endRun(outcome: NonNullable<Trace['outcome']>): void {
    this.run?.finish(outcome)
    this.run = null
  }
  /** Starts the trace only once the user has chosen to run the skill: proposals the user never acts on leave no trace. */
  private beginRun(skill: Skill, graph: Graph, evaluations: Evaluation[]): void {
    const queued = evaluations.filter((e) => e.rank).sort((a, b) => a.rank! - b.rank!)
    this.endRun('superseded')
    const tr = startTrace('run', skill.name)
    this.run = tr
    this.expected = skill.expectedOutcome?.(graph) ?? null
    this.predicted = previewFor(skill, graph)
    this.step('graph', 'graph', 'Read the user graph', 'pass', graphSummary(graph))
    this.step('analyze', 'analyze', `${queued.length} of ${evaluations.length} skills apply`, 'pass', queued.map((e) => `${e.name}: ${e.reason}`).join('. ') || 'Nothing to act on')
    this.step('prioritize', 'prioritize', 'Ranked by priority, then relevance', 'pass', queued.map((e) => `${e.rank}. ${e.name} (priority ${e.priority}, relevance ${e.relevance})`).join(' · '))
    this.step('select', 'select', `Selected ${skill.name}`, 'pass', `“${skill.proposal(graph).message}” You approved: ${this.state.proposal?.cta ?? 'start'} (Approval 1)`)
  }
  /** The last steps of a run: what was checked and recorded, then close it. */
  private evalAndEnd(skill: Skill, outcome: Outcome, verdict: NonNullable<Trace['outcome']>, prev?: Graph, next?: Graph): void {
    if (!this.run) return
    if (prev && next) {
      const changes = graphChanges(prev, next)
      const still = skill.evaluate(next)
      const more = !!skill.repeatable && still.applies
      this.step('eval-quality', 'eval', 'Check quality and success', still.applies ? (more ? 'info' : 'warn') : 'pass', still.applies ? (more ? `This one is done. ${still.reason}, so NORA offers the next` : `${skill.name} still applies: ${still.reason}`) : `Resolved: ${skill.name} no longer applies`)
      const actual = liveSrs()
      const p = this.predicted
      if (p) {
        const gain = actual.total - p.before.total
        const sign = (n: number) => (n >= 0 ? `+${n}` : String(n))
        this.step('eval-score', 'eval', 'Check the score: predicted vs actual', gain === p.delta ? 'pass' : 'warn', `Predicted ${sign(p.delta)} points (${p.before.total} → ${p.after.total}), actual ${sign(gain)} (${p.before.total} → ${actual.total}). The prediction uses the same maths as the live score, so it should match`)
      }
      this.step('eval-outcome', 'eval', 'Check the expected outcome', changes.length ? 'pass' : 'warn', `${this.expected ? `Expected ${this.expected.label}: ${this.expected.before} → ${this.expected.after}. ` : ''}Graph now: ${changes.length ? changes.map((c) => `${c.path} ${c.before} → ${c.after}`).join(', ') : 'no tracked field changed'}`)
    }
    const waiting = evaluateSkills(next ?? this.state.graph ?? buildGraph(), this.registry, this.state.handled).filter((e) => e.rank).length
    this.step('eval-record', 'eval', 'Record the eval result', 'pass', `Outcome “${outcome}” saved for this session. ${waiting} other skill${waiting === 1 ? '' : 's'} waiting`)
    const again = !!skill.repeatable && !!next && skill.evaluate(next).applies
    this.step('eval-improve', 'eval', 'Use the result to improve', 'info', `${again ? 'NORA will offer the next one.' : 'This skill is not proposed again this session.'} A stored eval history that tunes ranking and routing is not built yet`)
    this.endRun(verdict)
  }

  private skill(id: string | null): Skill {
    const s = this.registry.find((x) => x.id === id)
    if (!s) throw new Error(`Unknown skill ${id}`)
    return s
  }

  /* ---------- public flow ---------- */

  /** Load a scenario's data and restart from login. Also the "Reset Demo" action. */
  async reset(scenario: ScenarioId): Promise<void> {
    this.epoch++
    this.endRun('superseded')
    resetDatabase(scenario)
    this.dispatch({ type: 'reset', scenario })
    await this.login()
  }

  /** Login: read the graph, evaluate skills, propose one or settle. */
  async login(): Promise<void> {
    const epoch = this.epoch
    const from = this.state.status
    if (from !== 'IDLE' && from !== 'EXPLORE') return
    this.go('CHECKING', undefined, 'User logged in; reading graph')
    await this.pause()
    if (epoch !== this.epoch) return
    await this.route(epoch)
  }

  /**
   * The underlying data changed outside NORA (e.g. the user edited their profile).
   * Reconsider everything, including skills dismissed earlier. Only acts while NORA is
   * waiting on the user (a standing proposal, or the all-set state), never mid-run.
   */
  async refresh(): Promise<void> {
    const st = this.state.status
    if (st !== 'SKILL_PROPOSED' && st !== 'EXPLORE') return
    const epoch = this.epoch
    this.dispatch({ type: 'patch', patch: { handled: [] } })
    this.go('RE_EVALUATING', undefined, 'Your data changed; re-evaluating skills')
    await this.route(epoch)
  }

  /**
   * The user stops a run in progress. In-flight work is discarded (nothing was written: writes
   * only start at WRITING, which can't be stopped) and NORA re-evaluates, so the proposal returns.
   */
  async stop(): Promise<void> {
    const st = this.state.status
    if (st !== 'SKILL_APPROVED' && st !== 'READING' && st !== 'VALIDATING' && st !== 'DRAFT_READY') return
    const epoch = ++this.epoch
    this.step('stopped', 'execute', 'Stopped by you', 'block', 'Nothing was changed')
    this.endRun('declined')
    this.go('RE_EVALUATING', { draft: null, validation: null, insight: null }, 'Stopped by you; nothing was changed')
    await this.route(epoch)
  }

  /** Pick which queued skill the standing proposal is about (e.g. a "fix this" link for a specific domain). */
  select(skillId: string): void {
    if (this.state.status !== 'SKILL_PROPOSED') return
    if (!this.state.evaluations.some((e) => e.skillId === skillId && e.rank)) return
    const skill = this.skill(skillId)
    this.dispatch({ type: 'patch', patch: { selectedSkillId: skillId, proposal: skill.proposal(this.state.graph!) }, note: `Selected ${skill.name}` })
  }

  /** Approval 1: user agrees to let the skill start. */
  async approveStart(): Promise<void> {
    if (this.state.status !== 'SKILL_PROPOSED') return
    const epoch = this.epoch
    const skill = this.skill(this.state.selectedSkillId)
    try {
      this.go('SKILL_APPROVED', undefined, `Approved start: ${skill.name}`)
      this.beginRun(skill, this.state.graph!, this.state.evaluations)
      this.step('routing', 'routing', 'Model chosen by the skill', 'pass', skill.allowedModel === 'none' ? 'No model needed: this skill has no text to write. NORA never picks a model' : `${skill.allowedModel}, declared by the skill. NORA does not pick the model`)
      await this.pause()
      if (epoch !== this.epoch) return

      this.go('READING', undefined, `${skill.name}: read (no data modified)`)
      this.step('read', 'execute', 'Context validation: read your data', 'pending', 'Read only. Nothing is modified')
      const data = await skill.read!()
      if (epoch !== this.epoch) return
      this.upd('read', 'pass', 'Read only. Nothing was modified')

      this.go('VALIDATING', undefined, `${skill.name}: validate`)
      const validation = skill.validate!(data)
      this.step('validate', 'execute', 'Input validation: what needs doing', validation.findings.length ? 'pass' : 'info', validation.findings.length ? validation.findings.map((f) => `${f.label}: ${f.detail}`).join('. ') : 'Nothing actionable found')
      await this.pause()
      if (epoch !== this.epoch) return

      if (validation.findings.length === 0) {
        this.markHandled(skill.id, 'nothing-to-do')
        this.evalAndEnd(skill, 'nothing-to-do', 'completed')
        this.go('RE_EVALUATING', { validation }, `${skill.name}: nothing actionable found`)
        return this.route(epoch)
      }

      if (skill.kind === 'insight') {
        this.go('RESULT_READY', { validation, insight: skill.insight!(validation) }, `${skill.name}: insight ready (read-only)`)
        this.step('insight', 'execute', 'Insight ready (read-only)', 'pass', this.state.insight!.title)
        this.step('approval', 'execute', 'Waiting for you to read it', 'pending', 'Nothing is written for an insight')
        return
      }

      const request = skill.buildDraftRequest!(validation)
      if (request.model !== skill.allowedModel) {
        throw new Error(`${skill.name} requested model ${request.model} but is only allowed ${skill.allowedModel}`)
      }
      this.note(skill.allowedModel === 'none' ? 'Preparing the draft (no AI model needed)' : `Drafting with ${skill.allowedModel} (chosen by the skill, not NORA)`)
      const draft = await generateSkillDraft(request, { trace: this.run ?? undefined })
      if (epoch !== this.epoch) return

      this.go('DRAFT_READY', { validation, draft }, `${skill.name}: draft ready`)
      await this.pause()
      if (epoch !== this.epoch) return
      this.go('WRITE_APPROVAL', undefined, 'Waiting for write approval; nothing has been written')
      this.step('approval', 'execute', 'Approval 2: your decision', 'pending', skill.consent ? `Waiting for you to allow access on ${skill.consent.provider}’s screen. Nothing is connected yet` : 'Waiting for you to approve the before and after. Nothing is saved yet')
    } catch (e) {
      this.fail(epoch, e)
    }
  }

  /** User declines to start the proposed skill. */
  async declineStart(): Promise<void> {
    if (this.state.status !== 'SKILL_PROPOSED') return
    await this.reject('Declined to start; no data touched')
  }

  /** Approval 2: user approves the draft. The only path that writes. */
  async approveWrite(): Promise<void> {
    if (this.state.status !== 'WRITE_APPROVAL') return
    const epoch = this.epoch
    const skill = this.skill(this.state.selectedSkillId)
    const { draft, graph } = this.state
    try {
      this.go('WRITING', undefined, `Approved write: ${skill.name} → actions.ts → mock API`)
      this.upd('approval', 'pass', skill.consent ? `You allowed access on ${skill.consent.provider}’s screen (Approval 2)` : 'You approved the before and after (Approval 2)')
      this.step('write', 'update', 'Update data', 'pending', `${skill.id} writes through the mock API`)
      await skill.write!(draft!)
      if (epoch !== this.epoch) return
      this.upd('write', 'pass', `${skill.id} wrote through the mock API`)
      const rebuilt = buildGraph()
      // a repeatable skill (one review per run) keeps being offered while it still applies
      if (skill.repeatable && skill.evaluate(rebuilt).applies) this.dispatch({ type: 'patch', patch: { lastOutcome: { skillId: skill.id, outcome: 'applied' } } })
      else this.markHandled(skill.id, 'applied')
      this.go('COMPLETED', { previousGraph: graph, graph: rebuilt }, 'Mock DB updated; graph rebuilt')
      this.step('graph-update', 'update', 'Update the user graph', 'pass', graphChanges(graph!, this.state.graph!).map((c) => `${c.path} ${c.before} → ${c.after}`).join(', ') || 'No tracked field changed')
      this.evalAndEnd(skill, 'applied', 'completed', graph!, this.state.graph!)
      await this.pause(2.5) // linger so the graph update is visible
      if (epoch !== this.epoch) return
      this.go('RE_EVALUATING', undefined, 'Re-reading graph and re-evaluating skills')
      await this.route(epoch)
    } catch (e) {
      this.fail(epoch, e)
    }
  }

  /** The user changed the drafted text before approving. Only skills that declare `editDraft` allow it. */
  editDraft(text: string): void {
    if (this.state.status !== 'WRITE_APPROVAL' || !this.state.draft) return
    const skill = this.skill(this.state.selectedSkillId)
    if (!skill.editDraft) return
    // the user's own wording goes through the same output compliance as the model's
    const c = checkCompliance(text)
    if (c.status === 'block') {
      this.step('edited', 'execute', 'Your edit was not used', 'block', complianceSummary(c))
      this.note('Your edit was not used: it broke a compliance rule')
      return
    }
    const next = skill.editDraft(this.state.draft, text)
    this.dispatch({ type: 'patch', patch: { draft: next }, note: 'You edited the draft' })
    this.step('edited', 'execute', 'You edited the text', c.status === 'warn' ? 'warn' : 'info', `${text.length} characters${c.status === 'warn' ? `. Flagged: ${complianceSummary(c)}` : ''}. NORA posts exactly what you approve`)
  }

  /** User rejects the draft. Nothing was written, so nothing to undo. */
  async rejectWrite(): Promise<void> {
    if (this.state.status !== 'WRITE_APPROVAL') return
    await this.reject('Write rejected; no data modified')
  }

  /** User has seen a read-only insight. */
  async acknowledgeInsight(): Promise<void> {
    if (this.state.status !== 'RESULT_READY') return
    const epoch = this.epoch
    this.upd('approval', 'pass', 'You read it')
    this.markHandled(this.state.selectedSkillId!, 'acknowledged')
    this.evalAndEnd(this.skill(this.state.selectedSkillId), 'acknowledged', 'completed')
    this.go('COMPLETED', undefined, 'Insight acknowledged (no write)')
    await this.pause()
    if (epoch !== this.epoch) return
    this.go('RE_EVALUATING', undefined, 'Re-reading graph and re-evaluating skills')
    await this.route(epoch)
  }

  /* ---------- internals ---------- */

  private async reject(note: string): Promise<void> {
    const epoch = this.epoch
    if (this.state.status === 'WRITE_APPROVAL') this.upd('approval', 'block', 'You rejected the draft. Nothing was written')
    // declining at Approval 1 leaves no trace: no run was started
    this.markHandled(this.state.selectedSkillId!, 'rejected')
    this.evalAndEnd(this.skill(this.state.selectedSkillId), 'rejected', 'declined')
    this.go('REJECTED', undefined, note)
    await this.pause()
    if (epoch !== this.epoch) return
    this.go('RE_EVALUATING', undefined, 'Re-reading graph and re-evaluating skills')
    await this.route(epoch)
  }

  private markHandled(skillId: string, outcome: Outcome): void {
    const handled = this.state.handled.includes(skillId) ? this.state.handled : [...this.state.handled, skillId]
    this.dispatch({ type: 'patch', patch: { handled, lastOutcome: { skillId, outcome } } })
  }

  /** Shared by CHECKING and RE_EVALUATING: read graph, evaluate, propose or settle. */
  private async route(epoch: number): Promise<void> {
    try {
      const graph = buildGraph()
      const evaluations = evaluateSkills(graph, this.registry, this.state.handled)
      const next = selectNext(evaluations)
      const cleared = { draft: null, validation: null, insight: null, explore: null, error: null }

      if (next) {
        const skill = this.skill(next)
        const queued = evaluations.filter((e) => e.rank).length
        this.go(
          'SKILL_PROPOSED',
          { ...cleared, graph, evaluations, selectedSkillId: next, proposal: skill.proposal(graph) },
          `${queued} applicable skill${queued === 1 ? '' : 's'}; selected ${skill.name} (priority ${skill.priority})`,
        )
        return
      }

      this.go('ALL_GOOD', { ...cleared, graph, evaluations, selectedSkillId: null, proposal: null }, 'No actionable skill applies')
      await this.pause()
      if (epoch !== this.epoch) return
      const exploreId = selectExplore(evaluations)
      const explore = exploreId ? (this.skill(exploreId).explore?.(graph) ?? null) : null
      this.go('EXPLORE', { explore }, exploreId ? `Offering exploration: ${this.skill(exploreId).name}` : 'Nothing to explore')
    } catch (e) {
      this.fail(epoch, e)
    }
  }

  private fail(epoch: number, e: unknown): void {
    if (epoch !== this.epoch) return
    const message = e instanceof Error ? e.message : String(e)
    this.step('error', 'execute', 'Something went wrong', 'block', message)
    this.endRun('blocked')
    this.dispatch({ type: 'patch', patch: { error: message }, note: `Error: ${message}` })
    if (canTransition(this.state.status, 'ERROR')) this.go('ERROR')
  }
}

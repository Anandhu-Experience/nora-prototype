import { buildGraph, type Graph } from '../mock/graph'
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
  private skill(id: string | null): Skill {
    const s = this.registry.find((x) => x.id === id)
    if (!s) throw new Error(`Unknown skill ${id}`)
    return s
  }

  /* ---------- public flow ---------- */

  /** Load a scenario's data and restart from login. Also the "Reset Demo" action. */
  async reset(scenario: ScenarioId): Promise<void> {
    this.epoch++
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
      await this.pause()
      if (epoch !== this.epoch) return

      this.go('READING', undefined, `${skill.name}: read (no data modified)`)
      const data = await skill.read!()
      if (epoch !== this.epoch) return

      this.go('VALIDATING', undefined, `${skill.name}: validate`)
      const validation = skill.validate!(data)
      await this.pause()
      if (epoch !== this.epoch) return

      if (validation.findings.length === 0) {
        this.markHandled(skill.id, 'nothing-to-do')
        this.go('RE_EVALUATING', { validation }, `${skill.name}: nothing actionable found`)
        return this.route(epoch)
      }

      if (skill.kind === 'insight') {
        this.go('RESULT_READY', { validation, insight: skill.insight!(validation) }, `${skill.name}: insight ready (read-only)`)
        return
      }

      const request = skill.buildDraftRequest!(validation)
      if (request.model !== skill.allowedModel) {
        throw new Error(`${skill.name} requested model ${request.model} but is only allowed ${skill.allowedModel}`)
      }
      this.note(`Drafting with ${skill.allowedModel} (chosen by the skill, not NORA)`)
      const draft = await generateSkillDraft(request)
      if (epoch !== this.epoch) return

      this.go('DRAFT_READY', { validation, draft }, `${skill.name}: draft ready`)
      await this.pause()
      if (epoch !== this.epoch) return
      this.go('WRITE_APPROVAL', undefined, 'Waiting for write approval; nothing has been written')
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
      await skill.write!(draft!)
      if (epoch !== this.epoch) return
      this.markHandled(skill.id, 'applied')
      this.go('COMPLETED', { previousGraph: graph, graph: buildGraph() }, 'Mock DB updated; graph rebuilt')
      await this.pause(2.5) // linger so the graph update is visible
      if (epoch !== this.epoch) return
      this.go('RE_EVALUATING', undefined, 'Re-reading graph and re-evaluating skills')
      await this.route(epoch)
    } catch (e) {
      this.fail(epoch, e)
    }
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
    this.markHandled(this.state.selectedSkillId!, 'acknowledged')
    this.go('COMPLETED', undefined, 'Insight acknowledged (no write)')
    await this.pause()
    if (epoch !== this.epoch) return
    this.go('RE_EVALUATING', undefined, 'Re-reading graph and re-evaluating skills')
    await this.route(epoch)
  }

  /* ---------- internals ---------- */

  private async reject(note: string): Promise<void> {
    const epoch = this.epoch
    this.markHandled(this.state.selectedSkillId!, 'rejected')
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
    this.dispatch({ type: 'patch', patch: { error: message }, note: `Error: ${message}` })
    if (canTransition(this.state.status, 'ERROR')) this.go('ERROR')
  }
}

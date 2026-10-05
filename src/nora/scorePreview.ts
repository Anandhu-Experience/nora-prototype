import type { Graph } from '../mock/graph'
import { simulate, srsNow, type Simulation, type Srs } from '../presence/srs'
import { getState } from '../profile/store'
import type { Agent } from '../profile/types'
import type { Skill } from '../skills/types'

/** The agent NORA is working for. */
export const viewerAgent = (): Agent => {
  const s = getState()
  return s.agents[s.viewerId]!
}

/** What a skill's change would be worth in the Search Rank Score, before anything is done. Null when the skill says nothing about the score. */
export function previewFor(skill: Skill, graph: Graph): Simulation | null {
  const change = skill.scoreChange?.(graph)
  return change ? simulate(viewerAgent(), change) : null
}

/** The live score of the agent NORA is working for. */
export const liveSrs = (): Srs => srsNow(viewerAgent())

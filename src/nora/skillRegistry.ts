import { analyticsSkill } from '../skills/analytics/actions'
import { listingsSkill } from '../skills/listings/actions'
import { profileSkill } from '../skills/profile/actions'
import type { Skill } from '../skills/types'
import { voceSkill } from '../skills/voce/actions'

/**
 * The only place NORA learns what capabilities exist. Adding a skill means
 * adding it here; NORA iterates and asks each one whether it applies.
 */
export const skillRegistry: readonly Skill[] = [profileSkill, listingsSkill, analyticsSkill, voceSkill]

export const getSkill = (id: string): Skill | undefined => skillRegistry.find((s) => s.id === id)

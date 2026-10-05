import { analyticsSkill } from '../skills/analytics/actions'
import { connectionsSkill } from '../skills/connections/actions'
import { listingsSkill } from '../skills/listings/actions'
import { reviewsSkill } from '../skills/reviews/actions'
import { profileSkill } from '../skills/profile/actions'
import type { Skill } from '../skills/types'
import { voceSkill } from '../skills/voce/actions'

/**
 * The only place NORA learns what capabilities exist. Adding a skill means
 * adding it here; NORA iterates and asks each one whether it applies.
 */
export const skillRegistry: readonly Skill[] = [profileSkill, connectionsSkill, reviewsSkill, listingsSkill, analyticsSkill, voceSkill]

export const getSkill = (id: string): Skill | undefined => skillRegistry.find((s) => s.id === id)

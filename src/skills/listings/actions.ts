import * as api from '../../mock/api'
import { missingListingFields } from '../../mock/rules'
import type { Listing } from '../../mock/types'
import { defineSkill, type Draft, type Finding } from '../types'
import doc from './SKILL.md?raw'

type ListingPatch = { id: string; patch: Partial<Listing> }

export const listingsSkill = defineSkill<Listing[]>({
  id: 'listing-optimization',
  name: 'Listing Optimization',
  description: 'Detect incomplete listing information and suggest improvements.',
  domain: 'listings',
  kind: 'action',
  priority: 80,
  allowedModel: 'haiku-4-5',
  requiresApproval: true,
  whenToUse: ['One or more listings are incomplete'],
  whenNotToUse: ['All listings are complete'],
  doc,

  evaluate(graph) {
    const n = graph.listings.incomplete
    if (n === 0) return { applies: false, reason: `All ${graph.listings.total} listings complete`, relevance: 0 }
    return {
      applies: true,
      reason: `${n} of ${graph.listings.total} listings incomplete`,
      relevance: Math.min(100, Math.round((n / graph.listings.total) * 100) + 20),
    }
  },

  proposal(graph) {
    const n = graph.listings.incomplete
    return {
      message: `${n} of your listings ${n === 1 ? 'is' : 'are'} missing details. Shall I take a look?`,
      cta: 'Review with NORA',
    }
  },

  read: () => api.getListings(),

  validate(listings) {
    const findings: Finding[] = listings
      .filter((l) => missingListingFields(l).includes('description'))
      .map((l) => ({ id: l.id, label: l.title, detail: 'Description is empty' }))
    return { findings, context: listings }
  },

  buildDraftRequest({ findings, context }) {
    const listings = context as Listing[]
    const targets = listings.filter((l) => findings.some((f) => f.id === l.id))
    const patches: ListingPatch[] = targets.map((l) => ({
      id: l.id,
      patch: { description: `${l.title}: a well-presented property with the key details buyers look for, priced to attract serious interest.` },
    }))
    const changes: Draft['changes'] = targets.map((l, i) => ({
      label: `${l.title} description`,
      before: 'Empty',
      after: patches[i].patch.description as string,
    }))
    return {
      skillId: 'listing-optimization',
      model: 'haiku-4-5',
      instruction: `Write a concise listing description for each: ${JSON.stringify(targets)}.`,
      mockDraft: { summary: `Add descriptions to ${changes.length} listing${changes.length === 1 ? '' : 's'}`, changes, payload: patches },
    }
  },

  async write(draft) {
    for (const { id, patch } of draft.payload as ListingPatch[]) await api.updateListing(id, patch)
  },
})

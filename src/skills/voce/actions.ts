import { getVoceUrl } from '../../mock/api'
import { defineSkill } from '../types'
import doc from './SKILL.md?raw'

export const voceSkill = defineSkill<never>({
  id: 'voce-explore',
  name: 'VOCE Explore',
  description: 'Show VOCE as an external connected application.',
  domain: 'voce',
  kind: 'explore',
  priority: 10,
  allowedModel: 'none',
  requiresApproval: false,
  whenToUse: ['Nothing more urgent applies'],
  whenNotToUse: ['Never competes with actionable skills'],
  doc,

  evaluate(graph) {
    return {
      applies: true,
      reason: graph.voce.hasProfile ? 'VOCE profile ready' : 'No VOCE profile yet',
      relevance: graph.voce.hasProfile ? 60 : 40,
    }
  },

  proposal(graph) {
    return {
      message: graph.voce.hasProfile ? 'Your VOCE profile is ready.' : 'Build your AI visibility with VOCE.',
      cta: 'Preview VOCE',
    }
  },

  explore(graph) {
    const { hasProfile, authorityScore, articles, questionsAnswered } = graph.voce
    if (hasProfile) {
      return {
        headline: 'Your VOCE profile is ready.',
        body: 'See how AI engines are representing you.',
        stats: [
          { label: 'AI Authority Score', value: String(authorityScore) },
          { label: 'Articles', value: String(articles) },
          { label: 'Questions answered', value: String(questionsAnswered) },
        ],
        actions: [
          { label: 'Preview VOCE', url: getVoceUrl('preview') },
          { label: 'Open VOCE', url: getVoceUrl('open'), primary: true },
        ],
      }
    }
    return {
      headline: 'Create your VOCE profile and build your AI visibility.',
      body: 'VOCE helps AI engines find, trust and recommend you.',
      actions: [
        { label: 'Preview VOCE', url: getVoceUrl('preview') },
        { label: 'Create VOCE Profile', url: getVoceUrl('create'), primary: true },
      ],
    }
  },
})

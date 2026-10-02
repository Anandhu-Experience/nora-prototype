import * as api from '../../mock/api'
import { MEANINGFUL_TREND_PCT } from '../../mock/rules'
import type { Analytics } from '../../mock/types'
import { defineSkill } from '../types'
import doc from './SKILL.md?raw'

const pct = (a: Analytics) => (a.previousVisits ? Math.round(((a.visits - a.previousVisits) / a.previousVisits) * 100) : 0)

export const analyticsSkill = defineSkill<Analytics>({
  id: 'web-analytics-insight',
  name: 'Web Analytics Insight',
  description: 'Provide an insight when traffic shows a meaningful trend.',
  domain: 'analytics',
  kind: 'insight',
  priority: 50,
  allowedModel: 'none',
  requiresApproval: false,
  whenToUse: ['Analytics contain a meaningful trend'],
  whenNotToUse: ['Traffic is roughly flat'],
  doc,

  evaluate(graph) {
    const { trend, changePct } = graph.analytics
    if (trend === 'flat') return { applies: false, reason: `Traffic flat (${changePct}%)`, relevance: 0 }
    return { applies: true, reason: `Traffic ${trend} ${Math.abs(changePct)}%`, relevance: Math.min(100, Math.abs(changePct)) }
  },

  proposal(graph) {
    const { trend, changePct } = graph.analytics
    return {
      message: `Your site traffic is ${trend === 'up' ? 'up' : 'down'} ${Math.abs(changePct)}%. Want to see what's behind it?`,
      cta: 'Show me',
    }
  },

  read: () => api.getAnalytics(),

  validate(data) {
    const change = pct(data)
    const meaningful = Math.abs(change) >= MEANINGFUL_TREND_PCT
    return {
      findings: meaningful
        ? [{ id: 'trend', label: 'Traffic trend', detail: `${data.previousVisits} → ${data.visits} visits (${change > 0 ? '+' : ''}${change}%)` }]
        : [],
      context: data,
    }
  },

  insight({ context }) {
    const data = context as Analytics
    const change = pct(data)
    const up = change > 0
    return {
      title: `Traffic is ${up ? 'up' : 'down'} ${Math.abs(change)}%`,
      body: up
        ? `Visits grew from ${data.previousVisits.toLocaleString()} to ${data.visits.toLocaleString()}. Make sure your profile and listings are complete while attention is high.`
        : `Visits fell from ${data.previousVisits.toLocaleString()} to ${data.visits.toLocaleString()}. Refreshing listings and your profile can help win traffic back.`,
    }
  },
})

import * as api from '../../mock/api'
import { CONNECTIONS, connectionMeta } from '../../presence/connections'
import { defineSkill, type Draft, type Finding } from '../types'
import doc from './SKILL.md?raw'

const GOOGLE = connectionMeta('google')

interface ConnectionRead { google: boolean; points: number }

export const connectionsSkill = defineSkill<ConnectionRead>({
  id: 'connection-setup',
  name: 'Connection Setup',
  description: 'Suggest connecting Google Business Profile, the account that earns the most ranking points.',
  domain: 'connections',
  kind: 'action',
  // above Profile Completion: connecting Google is the single biggest win and unlocks Insights
  priority: 95,
  allowedModel: 'none',
  requiresApproval: true,
  consent: { provider: 'Google', cta: 'Continue to Google', permissions: GOOGLE.permissions, account: GOOGLE.handle },
  whenToUse: ['Google Business Profile is not connected'],
  whenNotToUse: ['Google is already connected', 'The user declined the suggestion'],
  doc,

  evaluate(graph) {
    if (graph.accounts.google) return { applies: false, reason: `Google is connected (${graph.accounts.points} of 100 connection points)`, relevance: 0 }
    return { applies: true, reason: `Google is not connected, ${graph.accounts.points} of 100 connection points, +${GOOGLE.points} available`, relevance: 100 - graph.accounts.points }
  },

  expectedOutcome(graph) {
    if (graph.accounts.google) return null
    return { label: 'Connection points', before: `${graph.accounts.points} of 100`, after: `${graph.accounts.points + GOOGLE.points} of 100` }
  },

  proposal() {
    return { message: 'Connect Google to unlock Insights. Shall I start?', cta: 'Connect Google' }
  },

  read: () => api.getAccounts(),

  validate(data) {
    const findings: Finding[] = data.google ? [] : [{ id: 'google', label: GOOGLE.name, detail: `Not connected, +${GOOGLE.points} points available` }]
    return { findings, context: data }
  },

  buildDraftRequest({ context }) {
    const { points } = context as ConnectionRead
    const changes: Draft['changes'] = [
      { label: GOOGLE.name, before: `Not connected · ${points} of ${CONNECTIONS.reduce((n, c) => n + c.points, 0)} points`, after: `Connected as ${GOOGLE.handle} · ${points + GOOGLE.points} of 100 points` },
      { label: 'What Google will ask you to allow', before: 'Nothing shared yet', after: GOOGLE.permissions.join('; ') },
    ]
    return {
      skillId: 'connection-setup',
      model: 'none',
      instruction: 'No model: connecting an account has no text to write.',
      mockDraft: { summary: 'Connect Google Business Profile', changes, payload: { id: 'google' } },
    }
  },

  async write() {
    // reached only after the user allows access on the Google consent screen (see the skill's `consent`)
    await api.connectGoogle()
  },
})

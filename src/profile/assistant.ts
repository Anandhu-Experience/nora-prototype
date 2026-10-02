import { fmtDate, ratingStats, similarAgents } from './selectors'
import type { Agent, StoreState } from './types'

/** Mock "AI": deterministic answers built from the agent's real (mock) data. */
export interface AiAnswer {
  intro?: string
  items?: { title: string; detail: string }[]
  text?: string
  /** Follow-up buttons shown under the answer. */
  actions?: ('referral' | 'reviews')[]
}

export const suggestionsFor = (agent: Agent) => {
  const first = agent.name.replace(/^agent\s+/i, '').split(' ')[0]
  return [
    { icon: 'reviews', text: `Summarize ${first}’s reviews` },
    { icon: 'strengths', text: `What are ${first}’s key strengths?` },
    { icon: 'services', text: `What services does ${first} offer?` },
    { icon: 'draft', text: `Draft a referral message for ${first}` },
  ] as const
}

/** Tool chips above the composer. */
export const TOOLS = [
  { label: 'Draft Referral', prompt: 'Draft a referral message' },
  { label: 'Compare Agents', prompt: 'How do they compare to similar agents?' },
  { label: 'Explain Rating', prompt: 'Why is the rating what it is?' },
  { label: 'Contact Details', prompt: 'How can I contact them?' },
  { label: 'Recent Activity', prompt: 'Show recent activity and achievements' },
] as const

const THEMES: [RegExp, string][] = [
  [/communicat|responsive|reply|replied|quick/i, 'Communication and responsiveness'],
  [/professional|knowledg|expert|sharp/i, 'Professionalism and expertise'],
  [/rate|saving|saved|below/i, 'Competitive rates'],
  [/stress|smooth|easy|clear|jargon/i, 'A smooth, easy-to-follow process'],
  [/recommend/i, 'Strong word-of-mouth recommendations'],
]

export function draftMessage(
  agent: Agent,
  opts: { purpose: 'referral' | 'intro' | 'followup'; tone: 'friendly' | 'professional' | 'concise'; note?: string; variant?: number },
): string {
  const first = agent.name.replace(/^agent\s+/i, '').split(' ')[0]
  const note = opts.note?.trim()
  const greet = { friendly: `Hi ${first},`, professional: `Dear ${first},`, concise: `Hi ${first},` }[opts.tone]
  const close = { friendly: 'Thanks so much!', professional: 'Kind regards,', concise: 'Thanks.' }[opts.tone]
  const spec = agent.specialties[0]?.toLowerCase() ?? 'mortgages'
  const alt = (opts.variant ?? 0) % 2 === 1
  const body = {
    referral: alt
      ? `A client of mine is looking for help with ${spec} and your reviews stood out. Would you be open to taking the referral${note ? ` (${note})` : ''}?`
      : `I would like to refer a client to you${note ? ` (${note})` : ''}. Could you please connect with me to discuss further?`,
    intro: `I came across your profile and was impressed by your ${agent.yearsExperience}+ years in ${spec}. I would love to connect and explore working together${note ? `: ${note}` : ''}.`,
    followup: `Just following up on my earlier message${note ? ` about ${note}` : ''}. Let me know if you have capacity this week.`,
  }[opts.purpose]
  return opts.tone === 'concise' ? `${greet} ${body} ${close}` : `${greet}\n\n${body}\n\n${close}`
}

export function answer(agent: Agent, state: StoreState, question: string): AiAnswer {
  const q = question.toLowerCase()
  const s = ratingStats(agent.reviews)
  const first = agent.name.replace(/^agent\s+/i, '')

  if (/review|feedback|rating|rated|say about/.test(q)) {
    if (!s.count) return { text: `${first} has no reviews yet.` }
    const joined = agent.reviews.map((r) => r.text).join(' ')
    const themes = THEMES.filter(([re]) => re.test(joined)).map(([, t]) => t).slice(0, 3)
    const latest = [...agent.reviews].sort((a, b) => b.date.localeCompare(a.date))[0]!
    const five = s.dist[0]!.pct
    const lowest = [...agent.reviews].sort((a, b) => a.rating - b.rating || b.date.localeCompare(a.date))[0]!
    return {
      intro: `${first} averages ${s.avg.toFixed(2)} from ${s.count} review${s.count === 1 ? '' : 's'}, with ${five}% giving five stars.`,
      items: [
        { title: 'What clients praise', detail: themes.length ? themes.join(', ') + '.' : 'Overall service quality.' },
        { title: 'Most recent review', detail: `“${latest.text}” (${latest.author}, ${fmtDate(latest.date)})` },
        lowest.rating < 5
          ? { title: 'Lowest-rated feedback', detail: `${lowest.rating}★: “${lowest.text}” (${lowest.author})` }
          : { title: 'Lowest-rated feedback', detail: 'Every review is five stars.' },
      ],
      actions: ['reviews'],
    }
  }

  if (/strength|good at|best at|why/.test(q)) {
    const items = [
      s.count && { title: 'High Client Satisfaction', detail: `Maintains a ${s.avg.toFixed(2)} average rating from ${s.count} review${s.count === 1 ? '' : 's'}.` },
      { title: 'Specialized Expertise', detail: `Expert in ${agent.specialties.map((x) => x.toLowerCase()).join(', ')}.` },
      { title: 'Strong Local Presence', detail: `Based in ${agent.location} with ${agent.completedLoans}+ completed loans.` },
      { title: 'Quick Response Time', detail: `Typically responds within ${agent.responseTime} (${agent.responseRate}% response rate).` },
    ].filter(Boolean) as { title: string; detail: string }[]
    return { intro: `Key strengths for ${agent.name}:`, items }
  }

  if (/compar|versus|\bvs\b|top agent|similar/.test(q)) {
    const others = similarAgents(state, agent).slice(0, 2)
    return {
      intro: `Compared with similar agents near ${agent.city}:`,
      items: others.map((o) => {
        const os = ratingStats(o.reviews)
        const diff = s.avg - os.avg
        return {
          title: o.name,
          detail: `${os.avg.toFixed(2)} rating (${os.count} reviews), ${o.yearsExperience} yrs. ${first} is ${diff >= 0 ? 'ahead' : 'behind'} by ${Math.abs(diff).toFixed(2)} on rating.`,
        }
      }),
    }
  }

  if (/draft|write|message|referral|email|reach out/.test(q)) {
    return {
      intro: 'Here’s a draft you can send:',
      text: draftMessage(agent, { purpose: 'referral', tone: 'friendly' }),
      actions: ['referral'],
    }
  }

  if (/service|offer|do they do|loan|help with/.test(q)) {
    return { intro: `${first} offers ${agent.services.length} service${agent.services.length === 1 ? '' : 's'}:`, items: agent.services.map((x) => ({ title: x.name, detail: x.description })) }
  }

  if (/activity|achiev|award|recent|news/.test(q)) {
    const items = [
      ...agent.awards.map((a) => ({ title: `${a.title} (${a.year})`, detail: a.issuer })),
      ...agent.activity.slice(0, 3).map((a) => ({ title: fmtDate(a.at), detail: a.text })),
    ]
    return items.length ? { intro: 'Recent activity and achievements:', items } : { text: 'No recent activity yet.' }
  }

  if (/contact|phone|call|email|reach/.test(q)) {
    return { items: [{ title: 'Phone', detail: agent.phone || 'Not listed' }, { title: 'Email', detail: agent.email || 'Not listed' }], actions: ['referral'] }
  }

  if (/experience|how long|years|loans|track/.test(q)) {
    return { text: `${first} has ${agent.yearsExperience}+ years of experience and has completed ${agent.completedLoans}+ loans.` }
  }

  if (/respon|fast|quick|how soon/.test(q)) {
    return { text: `${first} typically responds within ${agent.responseTime}, with a ${agent.responseRate}% response rate.` }
  }

  return {
    text: `I can help with ${first}’s reviews, strengths, services, achievements, or how they compare to other agents. Try one of the suggestions, or ask about contact details or experience.`,
  }
}

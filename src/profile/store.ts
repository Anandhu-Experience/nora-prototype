import { useSyncExternalStore } from 'react'
import { seedState } from './seed'
import { applyLocks } from './details'
import { ratingStats } from './selectors'
import type { ActivityItem, Agent, LockField, Notification, Review, StoreState, Thread } from './types'

const KEY = 'nora-profile-demo-v3'

function load(): StoreState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as { v: number; state: StoreState }
      if (p.v === 1) return p.state
    }
  } catch {
    /* storage unavailable or corrupt: fall back to seed */
  }
  return seedState()
}

let state: StoreState = load()
const listeners = new Set<() => void>()

function commit(next: StoreState): void {
  state = next
  listeners.forEach((l) => l())
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, state }))
  } catch {
    /* quota exceeded (large uploads): keep working in memory */
  }
}

export const getState = (): StoreState => state
export const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const useStore = (): StoreState => useSyncExternalStore(subscribe, getState)

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`
const now = () => new Date().toISOString()

const updateAgent = (id: string, fn: (a: Agent) => Agent): StoreState => ({
  ...state,
  agents: { ...state.agents, [id]: fn(state.agents[id]!) },
})
const withActivity = (a: Agent, type: ActivityItem['type'], text: string): Agent => ({
  ...a,
  activity: [{ id: uid('x'), at: now(), type, text }, ...a.activity],
})
const pushNotification = (s: StoreState, text: string, link: string): StoreState => ({
  ...s,
  notifications: [{ id: uid('n'), text, at: now(), read: false, link }, ...s.notifications],
})

const REPLIES = [
  'Thanks for reaching out, happy to help. I will give your client a call today.',
  'Got it, send me their details and I will pick it up from here.',
  'Great to hear from you. I have capacity this week, let’s set up a quick call.',
]
let replyIdx = 0

/** Appends a message to the thread with an agent (creating it if needed). */
function appendToThread(agentId: string, text: string, from: 'me' | 'them'): void {
  const agent = state.agents[agentId]
  if (!agent) return
  const msg = { id: uid('m'), from, text, at: now() }
  const existing = state.threads.find((t) => t.withAgentId === agentId)
  const thread: Thread = existing
    ? { ...existing, messages: [...existing.messages, msg], unread: from === 'them' ? true : existing.unread }
    : { id: uid('t'), withName: agent.name, withAgentId: agentId, unread: from === 'them', messages: [msg] }
  commit({ ...state, threads: [thread, ...state.threads.filter((t) => t.id !== thread.id)] })
}

export const actions = {
  /** Replace an agent's editable fields. */
  saveProfile(id: string, next: Agent, opts: { manager?: boolean } = {}): void {
    // an agent's edit cannot change fields a manager locked; only a manager's edit can change the locks themselves
    commit(updateAgent(id, (a) => withActivity({ ...a, ...applyLocks(a, { ...a, ...next, id }, !!opts.manager) }, 'profile', opts.manager ? 'Manager updated profile details' : 'Updated profile details')))
  },
  setLocks(id: string, lockedFields: LockField[]): void {
    commit(updateAgent(id, (a) => withActivity({ ...a, lockedFields }, 'profile', 'Manager updated locked fields')))
  },
  setRankFormat(id: string, rankFormat: Agent['rankFormat']): void {
    commit(updateAgent(id, (a) => ({ ...a, rankFormat })))
  },
  /** Partial update from another part of the app (e.g. NORA). Optionally logs activity and notifies the viewer. */
  patchAgent(id: string, patch: Partial<Agent>, opts: { activity?: string; notify?: string } = {}): void {
    let next = updateAgent(id, (a) => {
      const merged = applyLocks(a, { ...a, ...patch }, false)
      return opts.activity ? withActivity(merged, 'profile', opts.activity) : merged
    })
    if (opts.notify) next = pushNotification(next, opts.notify, `/profile/${id}`)
    commit(next)
  },
  setAbout(id: string, about: string): void {
    commit(updateAgent(id, (a) => withActivity({ ...a, about }, 'profile', 'Updated About section')))
  },
  /** Take the profile live or offline. */
  setPublished(id: string, published: boolean): void {
    commit(updateAgent(id, (a) => withActivity({ ...a, published }, 'profile', published ? 'Published your profile' : 'Unpublished your profile')))
  },
  setCover(id: string, cover: string): void {
    commit(updateAgent(id, (a) => ({ ...a, cover })))
  },
  addReview(agentId: string, r: Pick<Review, 'author' | 'rating' | 'text'>): void {
    const review: Review = { id: uid('r'), date: now(), source: 'Experience.com', ...r }
    let next = updateAgent(agentId, (a) => withActivity({ ...a, reviews: [review, ...a.reviews] }, 'review', `Received a ${r.rating}-star review from ${r.author}`))
    if (agentId === state.viewerId) next = pushNotification(next, `New ${r.rating}-star review from ${r.author}`, `/profile/${agentId}?tab=reviews`)
    commit(next)
  },
  replyToReview(agentId: string, reviewId: string, reply: string): void {
    commit(updateAgent(agentId, (a) => ({ ...a, reviews: a.reviews.map((r) => (r.id === reviewId ? { ...r, reply } : r)) })))
  },
  /** Send a referral/message to an agent; they auto-reply a few seconds later. */
  sendReferral(agentId: string, text: string): void {
    appendToThread(agentId, text, 'me')
    const agent = state.agents[agentId]
    if (!agent || agentId === state.viewerId) return
    const reply = REPLIES[replyIdx++ % REPLIES.length]!
    setTimeout(() => {
      appendToThread(agentId, reply, 'them')
      commit(pushNotification(state, `${agent.name} replied to your referral request`, '/messages'))
    }, 4500)
  },
  sendThreadMessage(threadId: string, text: string): void {
    const t = state.threads.find((x) => x.id === threadId)
    if (!t) return
    if (t.withAgentId) actions.sendReferral(t.withAgentId, text)
  },
  markThreadRead(threadId: string): void {
    if (!state.threads.some((t) => t.id === threadId && t.unread)) return
    commit({ ...state, threads: state.threads.map((t) => (t.id === threadId ? { ...t, unread: false } : t)) })
  },
  markNotificationRead(id: string): void {
    commit({ ...state, notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })
  },
  markAllNotificationsRead(): void {
    commit({ ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) })
  },
  report(agentId: string, reason: string, details: string): void {
    commit({ ...state, reports: [...state.reports, { id: uid('rp'), agentId, reason, details, at: now() }] })
  },
  reset(): void {
    commit(seedState())
  },
}

export const unreadMessages = (s: StoreState): number => s.threads.filter((t) => t.unread).length
export const unreadNotifications = (s: StoreState): Notification[] => s.notifications.filter((n) => !n.read)
export const agentStats = (a: Agent) => ratingStats(a.reviews)

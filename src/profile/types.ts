export type ServiceIcon = 'home' | 'calculator' | 'key' | 'briefcase' | 'shield' | 'chart'

export interface Service {
  id: string
  name: string
  blurb: string
  description: string
  icon: ServiceIcon
}

export interface Review {
  id: string
  author: string
  rating: number
  /** ISO date */
  date: string
  text: string
  /** Owner's public reply. */
  reply?: string
}

export interface Award {
  id: string
  title: string
  issuer: string
  year: number
}

export type ActivityType = 'review' | 'referral' | 'profile' | 'award' | 'loan'

export interface ActivityItem {
  id: string
  at: string
  type: ActivityType
  text: string
}

export interface Social {
  linkedin: string
  twitter: string
  facebook: string
  website: string
}

export interface Agent {
  id: string
  name: string
  title: string
  nmls: string
  company: string
  /** Display location, e.g. "Birmingham, UK". */
  location: string
  city: string
  /** Avatar data URL; empty means use initials. */
  photoUrl: string
  /** A preset cover id, or a data URL. */
  cover: string
  pro: boolean
  about: string
  specialties: string[]
  services: Service[]
  awards: Award[]
  activity: ActivityItem[]
  reviews: Review[]
  yearsExperience: number
  completedLoans: number
  responseRate: number
  responseTime: string
  phone: string
  email: string
  social: Social
}

export interface ThreadMessage {
  id: string
  from: 'me' | 'them'
  text: string
  at: string
}

export interface Thread {
  id: string
  withName: string
  withAgentId: string | null
  unread: boolean
  messages: ThreadMessage[]
}

export interface Notification {
  id: string
  text: string
  at: string
  read: boolean
  link: string
}

export interface Report {
  id: string
  agentId: string
  reason: string
  details: string
  at: string
}

export interface StoreState {
  viewerId: string
  agents: Record<string, Agent>
  order: string[]
  threads: Thread[]
  notifications: Notification[]
  reports: Report[]
}

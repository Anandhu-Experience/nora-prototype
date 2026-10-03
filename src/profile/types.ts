export type ServiceIcon = 'home' | 'calculator' | 'key' | 'briefcase' | 'shield' | 'chart'

export interface Service {
  id: string
  name: string
  blurb: string
  description: string
  icon: ServiceIcon
}

export type ReviewSource = 'Google' | 'Facebook' | 'Experience.com'

export interface Review {
  id: string
  author: string
  rating: number
  /** ISO date */
  date: string
  text: string
  /** Owner's public reply. */
  reply?: string
  /** Where the review came from. Missing means Experience.com. */
  source?: ReviewSource
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

export interface Address {
  id: string
  /** e.g. "Main office", "Solihull branch". The first address in the list is the primary one. */
  label: string
  street: string
  city: string
  region: string
  postal: string
  /** Ids from AMENITIES (details.ts). */
  amenities: string[]
}

export interface DayHours {
  open: boolean
  /** 24h "HH:MM". */
  from: string
  to: string
}

export interface BusinessHours {
  /** IANA zone, e.g. "Europe/London". */
  timeZone: string
  /** Monday first. */
  days: DayHours[]
}

/** Fields a manager can lock so the agent cannot change them. */
export type LockField = 'name' | 'title' | 'nmls' | 'company' | 'about' | 'specialties' | 'phone' | 'email' | 'location' | 'hours'

export type RankFormat = 'card' | 'banner' | 'reviews'

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
  /** Whether the profile is live on Experience.com. Missing means published. */
  published?: boolean
  /** Cities this professional works in. */
  serviceAreas: string[]
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
  /** Missing means one address derived from `location`. */
  addresses?: Address[]
  /** Missing means the default weekly hours. */
  hours?: BusinessHours
  /** Fields locked by a manager. */
  lockedFields?: LockField[]
  /** Layout of the shareable rank page. Missing means 'card'. */
  rankFormat?: RankFormat
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

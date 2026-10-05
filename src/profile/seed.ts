import type { ActivityItem, Agent, Award, Review, Service, ServiceIcon, StoreState } from './types.ts'

const svc = (id: string, name: string, blurb: string, description: string, icon: ServiceIcon): Service => ({
  id, name, blurb, description, icon,
})
const rev = (id: string, author: string, rating: number, date: string, text: string, reply?: string, source?: Review['source']): Review => ({
  id, author, rating, date, text, reply, source,
})
const award = (id: string, title: string, issuer: string, year: number): Award => ({ id, title, issuer, year })
const act = (id: string, at: string, type: ActivityItem['type'], text: string): ActivityItem => ({ id, at, type, text })
const avatarSvg = (from: string, to: string, letter: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="78" font-family="Arial,sans-serif" font-size="56" font-weight="700" fill="white" text-anchor="middle">${letter}</text></svg>`,
  )}`
const noSocial = { linkedin: '', twitter: '', facebook: '', website: '' }

const arjunan: Agent = {
  id: 'arjunan',
  name: 'Matt Reeves',
  title: 'Mortgage Loan Officer',
  nmls: '1234567',
  company: 'New American Funding',
  location: 'Birmingham, UK',
  city: 'Birmingham',
  photoUrl: avatarSvg('#34d399', '#15803d', 'A'),
  cover: 'sunset',
  pro: true,
  published: true,
  serviceAreas: ['Birmingham', 'Solihull'],
  about:
    'Dedicated mortgage loan officer with 8+ years of experience helping clients achieve their homeownership goals. Specialize in home loans, refinancing, and first-time buyer programs. I take the time to explain every option, compare lenders on your behalf, and stay with you from pre-approval to the day you get your keys.',
  specialties: ['Home Loans', 'Refinance', 'First-time Buyers'],
  services: [
    svc('s1', 'Home Loans', 'Purchase mortgages tailored to you', 'Fixed, variable and tracker mortgages for home purchases, compared across a wide panel of lenders. Includes affordability assessment and full pre-approval support.', 'home'),
    svc('s2', 'Refinance', 'Lower your rate or release equity', 'Review your current deal, model the savings and handle the paperwork to switch lender or product, or release equity for home improvements.', 'calculator'),
    svc('s3', 'First-time Buyers', 'Guidance from deposit to keys', 'Step-by-step support for first-time buyers: government schemes, deposit planning, and a clear timeline so there are no surprises.', 'key'),
  ],
  awards: [
    award('a1', 'Top Rated Agent', 'Experience.com', 2024),
    award('a2', 'Million Dollar Producer', 'New American Funding', 2023),
    award('a3', '5-Star Service Award', 'Midlands Mortgage Network', 2023),
  ],
  activity: [
    act('x1', '2024-01-12', 'review', 'Received a 5-star review from John Doe'),
    act('x2', '2024-01-05', 'loan', 'Closed a first-time buyer loan in Solihull'),
    act('x3', '2023-12-18', 'award', 'Awarded 5-Star Service by Midlands Mortgage Network'),
    act('x4', '2023-11-30', 'profile', 'Added "Refinance" to services'),
  ],
  reviews: [
    rev('r1', 'John Doe', 5, '2024-01-12', 'Excellent service and great communication throughout the process. Highly recommended!', undefined, 'Google'),
    rev('r2', 'Sarah Mitchell', 5, '2023-11-03', 'Matt found us a rate well below what our bank offered and was always quick to reply. Made buying our first home stress-free.', 'Thank you Sarah, congratulations on the new home!', 'Facebook'),
    rev('r3', 'Tom Baker', 4, '2023-09-21', 'Very knowledgeable and professional. The refinance took a little longer than expected but the result was great.'),
  ],
  yearsExperience: 8,
  completedLoans: 250,
  responseRate: 98,
  responseTime: '1 hour',
  phone: '+44 121 555 0142',
  email: 'matt.reeves@newamerican.example',
  social: { linkedin: 'https://linkedin.com/in/matt-reeves', twitter: 'https://x.com/mattreeves', facebook: '', website: 'https://mattreeves.example.com' },
  addresses: [
    { id: 'addr1', label: 'Main office', street: '45 Colmore Row', city: 'Birmingham', region: 'UK', postal: 'B3 2BH', amenities: ['parking', 'step-free', 'private-room', 'wifi', 'transit'] },
    { id: 'addr2', label: 'Solihull branch', street: '12 Poplar Road', city: 'Solihull', region: 'UK', postal: 'B91 3AE', amenities: ['parking', 'evenings', 'home-visits'] },
  ],
  hours: {
    timeZone: 'Europe/London',
    days: [
      { open: true, from: '09:00', to: '17:30' }, { open: true, from: '09:00', to: '17:30' }, { open: true, from: '09:00', to: '19:00' },
      { open: true, from: '09:00', to: '17:30' }, { open: true, from: '09:00', to: '17:00' }, { open: true, from: '10:00', to: '14:00' }, { open: false, from: '10:00', to: '14:00' },
    ],
  },
  lockedFields: ['nmls', 'company'],
  rankFormat: 'card',
}

const priya: Agent = {
  id: 'priya-nair', name: 'Priya Nair', title: 'Mortgage Broker', nmls: '2234510', company: 'Northern Home Finance',
  location: 'Manchester, UK', city: 'Manchester', photoUrl: '', cover: 'ocean', pro: true, serviceAreas: ['Manchester', 'Salford', 'Stockport'],
  about: 'Independent broker with 11 years helping self-employed clients and landlords secure the right mortgage. Whole-of-market advice with a personal touch.',
  specialties: ['Buy-to-let', 'Remortgage', 'Self-employed'],
  services: [
    svc('s1', 'Buy-to-let', 'Finance for landlords', 'Portfolio and single-property buy-to-let mortgages, including limited company structures.', 'briefcase'),
    svc('s2', 'Remortgage', 'Switch to a better deal', 'Timely reviews of your deal and a smooth switch when your fixed term ends.', 'calculator'),
    svc('s3', 'Self-employed', 'Mortgages without the hassle', 'Lenders who understand contractor and sole-trader income.', 'shield'),
  ],
  awards: [award('a1', 'Broker of the Year', 'Northern Finance Awards', 2023)],
  activity: [act('x1', '2024-01-09', 'loan', 'Completed a buy-to-let purchase in Salford')],
  reviews: [
    rev('r1', 'Amir Khan', 5, '2024-01-02', 'Priya sorted my buy-to-let in record time.'),
    rev('r2', 'Helen Ward', 5, '2023-10-14', 'Clear advice, no jargon, and she chased the lender for us.'),
    rev('r3', 'Pete Collins', 5, '2023-08-30', 'Brilliant with self-employed paperwork.'),
    rev('r4', 'Lucy Grant', 4, '2023-06-11', 'Great service overall.'),
  ],
  yearsExperience: 11, completedLoans: 410, responseRate: 96, responseTime: '2 hours',
  phone: '+44 161 555 0177', email: 'priya@northernhome.example', social: noSocial,
}

const daniel: Agent = {
  id: 'daniel-okafor', name: 'Daniel Okafor', title: 'Loan Officer', nmls: '3345621', company: 'Pennine Lending',
  location: 'Leeds, UK', city: 'Leeds', photoUrl: '', cover: 'forest', pro: false, serviceAreas: ['Leeds'],
  about: 'Loan officer focused on first-time buyers and shared ownership across West Yorkshire.',
  specialties: ['First-time Buyers', 'Shared Ownership'],
  services: [
    svc('s1', 'First-time Buyers', 'Start your journey', 'Deposit planning and mortgage guidance for first-time buyers.', 'key'),
    svc('s2', 'Shared Ownership', 'Buy a share of your home', 'Specialist advice on shared ownership mortgages.', 'home'),
  ],
  awards: [], activity: [act('x1', '2023-12-04', 'profile', 'Joined Experience.com')],
  reviews: [
    rev('r1', 'Grace Ibe', 5, '2023-12-20', 'Daniel made shared ownership understandable.'),
    rev('r2', 'Joe Platt', 4, '2023-10-02', 'Helpful and patient.'),
  ],
  yearsExperience: 5, completedLoans: 120, responseRate: 92, responseTime: '3 hours',
  phone: '+44 113 555 0119', email: 'daniel@pennine.example', social: noSocial,
}

const sofia: Agent = {
  id: 'sofia-marin', name: 'Sofia Marin', title: 'Mortgage Advisor', nmls: '4456732', company: 'Capital Home Loans',
  location: 'London, UK', city: 'London', photoUrl: '', cover: 'dusk', pro: true, serviceAreas: ['London', 'Surrey', 'Kent'],
  about: 'London-based advisor with 14 years in jumbo, investor and refinance lending. Known for fast turnarounds on complex cases.',
  specialties: ['Jumbo Loans', 'Refinance', 'Investors'],
  services: [
    svc('s1', 'Jumbo Loans', 'High-value property finance', 'Large-loan mortgages with private bank and specialist lender access.', 'briefcase'),
    svc('s2', 'Refinance', 'Optimise your borrowing', 'Restructure existing debt and release equity.', 'calculator'),
    svc('s3', 'Investor Finance', 'Grow your portfolio', 'Finance structures for investors and developers.', 'chart'),
  ],
  awards: [award('a1', 'Top 50 Advisors', 'UK Mortgage Review', 2024), award('a2', 'Million Dollar Producer', 'Capital Home Loans', 2023)],
  activity: [act('x1', '2024-01-10', 'award', 'Named in the Top 50 Advisors')],
  reviews: [
    rev('r1', 'Oliver Hale', 5, '2024-01-06', 'Complex case, handled flawlessly.'),
    rev('r2', 'Nadia Rao', 5, '2023-11-22', 'Fast and clear.'),
    rev('r3', 'Ben Cross', 4, '2023-09-15', 'Very sharp advisor.'),
    rev('r4', 'Ella Fox', 5, '2023-07-01', 'Highly recommend.'),
    rev('r5', 'Raj Patel', 5, '2023-05-19', 'Excellent on refinancing.'),
  ],
  yearsExperience: 14, completedLoans: 600, responseRate: 99, responseTime: '30 minutes',
  phone: '+44 20 5550 0188', email: 'sofia@capitalhome.example', social: noSocial,
}

const marcus: Agent = {
  id: 'marcus-lee', name: 'Marcus Lee', title: 'Home Loan Specialist', nmls: '5567843', company: 'New American Funding',
  location: 'Birmingham, UK', city: 'Birmingham', photoUrl: '', cover: 'slate', pro: false, serviceAreas: ['Birmingham'],
  about: 'Newer to the industry and keen to help young families get on the ladder.',
  specialties: ['Home Loans', 'Family Mortgages'],
  services: [svc('s1', 'Home Loans', 'Mortgages for families', 'Straightforward purchase mortgages for families.', 'home')],
  awards: [], activity: [act('x1', '2023-11-12', 'profile', 'Joined Experience.com')],
  reviews: [rev('r1', 'Kim Walsh', 4, '2023-12-01', 'Friendly and helpful.')],
  yearsExperience: 3, completedLoans: 60, responseRate: 90, responseTime: '1 day',
  phone: '+44 121 555 0166', email: 'marcus@newamerican.example', social: noSocial,
}

export const ANALYTICS = {
  viewsLast7Days: [18, 24, 31, 27, 35, 42, 38],
  /** Mock trend figures shown on the Profile Overview. */
  viewsLast30Days: 860,
  viewsChangePct: 18,
  rankChangePct: 24,
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  referralsReceived: 9,
  /** Sent before this session; messages you send now are added on top. */
  referralsSentBefore: 3,
  profileSearchAppearances: 312,
}

export function seedState(): StoreState {
  const agents = [arjunan, priya, daniel, sofia, marcus]
  return structuredClone({
    viewerId: 'arjunan',
    agents: Object.fromEntries(agents.map((a) => [a.id, a])),
    order: agents.map((a) => a.id),
    threads: [
      {
        id: 't-sofia', withName: 'Sofia Marin', withAgentId: 'sofia-marin', unread: true,
        messages: [{ id: 'm1', from: 'them', at: '2024-01-14T09:30:00Z', text: 'Hi Matt, do you handle first-time buyer referrals in Birmingham? I have a client moving up from London.' }],
      },
      {
        id: 't-priya', withName: 'Priya Nair', withAgentId: 'priya-nair', unread: false,
        messages: [
          { id: 'm1', from: 'me', at: '2024-01-08T14:00:00Z', text: 'Hi Priya, could you take a buy-to-let enquiry from one of my clients?' },
          { id: 'm2', from: 'them', at: '2024-01-08T15:10:00Z', text: 'Absolutely, send them over. I can speak to them tomorrow.' },
        ],
      },
    ],
    notifications: [
      { id: 'n1', text: 'Sofia Marin sent you a message', at: '2024-01-14T09:30:00Z', read: false, link: '/messages' },
      { id: 'n2', text: 'Your profile was viewed 42 times this week', at: '2024-01-13T08:00:00Z', read: false, link: '/insights' },
    ],
    reports: [],
  })
}

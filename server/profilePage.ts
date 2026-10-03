import { buildSchema, agentAddresses } from '../src/profile/details.ts'
import { seedState } from '../src/profile/seed.ts'
import type { Agent } from '../src/profile/types.ts'

/**
 * Server-rendered head and first paint for a public profile, so search engines and AI crawlers that do not run JavaScript
 * see a real title, description, canonical, Open Graph and Twitter tags, schema.org JSON-LD and the profile text.
 * It uses the seeded agents (the app's data is demo data); changes made in a visitor's browser are not reflected here.
 */
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const cut = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`)

export const seededAgent = (id: string): Agent | undefined => seedState().agents[id]

export function profileMeta(a: Agent, origin: string): { title: string; description: string; canonical: string } {
  const city = agentAddresses(a)[0]!.city
  return {
    title: `${a.name} | ${a.title} in ${city}`,
    description: cut(a.about.replace(/\s+/g, ' ').trim() || `${a.name}, ${a.title} at ${a.company} in ${city}.`, 155),
    canonical: `${origin}/profile/${a.id}`,
  }
}

/** The profile as plain, crawlable HTML. React replaces it when the app starts. */
function bodyHtml(a: Agent): string {
  const addr = agentAddresses(a)[0]!
  const rating = a.reviews.length ? (a.reviews.reduce((n, r) => n + r.rating, 0) / a.reviews.length).toFixed(2) : ''
  return `<main><article><h1>${esc(a.name)}</h1><p>${esc(a.title)} at ${esc(a.company)}</p>
<p>${esc([addr.street, addr.city, addr.postal].filter(Boolean).join(', '))}</p><p>Phone: ${esc(a.phone)}</p>
${rating ? `<p>Rated ${rating} from ${a.reviews.length} reviews</p>` : ''}<h2>About</h2><p>${esc(a.about)}</p>
<h2>Services</h2><ul>${a.services.map((s) => `<li>${esc(s.name)}: ${esc(s.blurb)}</li>`).join('')}</ul>
<h2>Specialties</h2><p>${a.specialties.map(esc).join(', ')}</p></article></main>`
}

/** Takes the built index.html and returns it with the profile's head tags, JSON-LD and text filled in. */
export function renderProfileHtml(indexHtml: string, a: Agent, origin: string): string {
  const m = profileMeta(a, origin)
  const noindex = a.published === false
  const head = [
    `<meta name="description" content="${esc(m.description)}" />`,
    `<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow'}" />`,
    `<link rel="canonical" href="${esc(m.canonical)}" />`,
    `<meta property="og:type" content="profile" />`, `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`, `<meta property="og:url" content="${esc(m.canonical)}" />`,
    `<meta property="og:site_name" content="Experience.com" />`,
    `<meta name="twitter:card" content="summary" />`, `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    // JSON-LD must not be able to close its own script tag
    `<script type="application/ld+json">${JSON.stringify(buildSchema(a, origin)).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ')
  return indexHtml
    .replace(/<html lang="[^"]*"/, '<html lang="en-GB"')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${bodyHtml(a)}</div>`)
}

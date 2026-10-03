/** Method 4: scope validation. Is this a request this product is for? */
export type ScopeMode = 'strict' | 'lenient'

const DOMAIN = /\b(mortgages?|loans?|lend\w*|borrow\w*|refinanc\w*|re-?fi|home|homes|house|housing|propert\w+|real estate|realtor|down ?payments?|deposit|credit|escrow|closing|appraisal|underwrit\w+|pre-?approv\w+|equity|heloc|fha|va|usda|jumbo|conventional|fixed|variable|tracker|arm|interest|apr|rates?|fees?|costs?|afford\w*|budget|income|debts?|dti|pmi|insurance|tax(?:es)?|rent\w*|landlord|tenant|buyers?|sellers?|first-?time|investment|lender|broker|agent|nmls|survey|conveyanc\w+|stamp duty|bridging|equity release)\b/i

/** What the app itself does: profile, reviews, listings, score, website, AI visibility, network. Used for chat. */
const APP = /\b(profile|reviews?|ratings?|stars?|services?|awards?|bio|about|specialt\w+|listings?|publish\w*|connections?|connect|google|facebook|linkedin|score|rank\w*|srs|seo|website|site|traffic|views|impressions|insights?|analytics|reports?|ai visibility|authority|articles?|faqs?|voce|partners?|referrals?|messages?|inbox|network|promo|nora|hours|location|address|cover|photo|draft|fix|help|summar\w+|compare|strengths?|contact|activity)\b/i
const SMALLTALK = /^\s*(hi|hello|hey|thanks|thank you|ok|okay|yes|no|good (morning|afternoon|evening)|what can you do|help)\b/i

const UNRELATED: { code: string; re: RegExp }[] = [
  { code: 'code', re: /\b(write|generate|debug|fix)\b.{0,25}\b(code|script|program|function|python|javascript|typescript|sql|regex|html|css)\b|\bscrape\b.{0,20}\bwebsites?\b/i },
  { code: 'creative', re: /\b(write|compose|tell)\b.{0,20}\b(poem|song|joke|story|essay|lyrics|haiku|screenplay)\b/i },
  { code: 'politics', re: /\b(election|vote for|political party|president|prime minister|democrat|republican|conservative party|labour party)\b/i },
  { code: 'medical', re: /\b(diagnos\w+|symptoms?|medication|prescription|medical advice|treatment for)\b/i },
  { code: 'trading', re: /\b(crypto\w*|bitcoin|ethereum|forex|day ?trading|penny stocks?|which stocks?|meme coins?)\b/i },
  { code: 'legal', re: /\b(legal advice|should i sue|sue (?:my|the)|draft a contract|lawsuit|divorce)\b/i },
  { code: 'general', re: /\b(recipe|weather forecast|football score|movie recommendations?|translate this|horoscope|travel itinerary)\b/i },
]

export interface ScopeResult { ok: boolean; code?: string }

export function checkScope(text: string, mode: ScopeMode): ScopeResult {
  const bad = UNRELATED.find((u) => u.re.test(text))
  if (bad) return { ok: false, code: bad.code }
  if (mode === 'lenient') return { ok: true }
  return DOMAIN.test(text) ? { ok: true } : { ok: false, code: 'no_domain_term' }
}

export const isSmallTalk = (text: string): boolean => SMALLTALK.test(text)
export const isAppTerm = (text: string): boolean => APP.test(text) || DOMAIN.test(text)

export const SCOPE_MESSAGE = 'I can help with mortgages and home finance, your profile, reviews, listings, Search Rank Score, website, AI visibility and network. That request is outside what I can do here.'

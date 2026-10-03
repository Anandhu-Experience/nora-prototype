/** Method 3: content safety. Blocks threats, hate, sexual content, self-harm, fraud and discriminatory lending; masks profanity. */
export type SafetyCategory = 'threat' | 'hate' | 'sexual' | 'self-harm' | 'fraud' | 'discrimination'
export interface SafetyResult { category?: SafetyCategory; text: string; profanity: number }

const GROUPS = 'black|blacks|whites?|asians?|hispanics?|latinos?|latinas?|jews|jewish|muslims?|christians?|hindus?|immigrants?|foreigners?|gays?|lesbians?|trans|disabled|women|men|minorit(?:y|ies)|single mothers?|pregnant|families with kids'

const RULES: { category: SafetyCategory; re: RegExp }[] = [
  { category: 'threat', re: /\b(i(?:'| a)?m going to|i will|i'll|gonna|we will|we'll)\s+(?:find|hunt|track|come after|get)\b.{0,20}\b(you|him|her|them)\b.{0,25}\b(hurt|kill|harm|make you pay)\b|\b(i(?:'| a)?m going to|i will|i'll|gonna|we will|we'll|someone should)\s+(?:kill|hurt|harm|shoot|stab|beat|destroy|burn)\b.{0,25}\b(you|him|her|them|your|family|office)\b|\b(kill|murder|shoot|stab)\s+(you|him|her|them)\b|\bbomb threat\b/i },
  { category: 'hate', re: new RegExp(`\\b(?:inferior|subhuman|vermin|scum|filthy)\\b.{0,30}\\b(?:race|religion|people|${GROUPS})\\b|\\b(?:all|those|these)\\s+(?:the\\s+)?(?:${GROUPS})\\s+(?:are|should)\\b.{0,40}\\b(?:inferior|vermin|scum|subhuman|animals|die|deported)`, 'i') },
  { category: 'sexual', re: /\b(porn\w*|nude|naked|erotic|sex(?:ual)? (?:act|scene|story)|explicit sex)\b/i },
  { category: 'self-harm', re: /\b(kill myself|end my life|suicid(?:e|al)|self[- ]harm|want to die|hurt myself)\b/i },
  { category: 'fraud', re: /\b(?:fake|forge[d]?|falsif\w+|counterfeit|doctor(?:ed)?)\s+(?:the\s+|my\s+|a\s+)?(?:pay ?stubs?|bank statements?|w-?2s?|tax returns?|income|documents?|id|identity|signatures?)\b|\blaunder\w*\b.{0,15}\bmoney|\bmoney.{0,10}launder|\bstraw (?:buyer|purchase)|\bhide\b.{0,20}\b(?:income|debts?|assets)\b.{0,25}\b(?:lender|underwriter|bank)|\bidentity theft\b|\bsteal\w* (?:an? )?identit/i },
  { category: 'discrimination', re: new RegExp(`\\b(?:don'?t|do not|won'?t|will not|never|refuse to|no)\\s+(?:lend|sell|rent|finance|approve|serve|work with)\\b.{0,25}\\b(?:${GROUPS})\\b|\\b(?:only|just)\\s+(?:show|sell|lend)\\b.{0,25}\\b(?:${GROUPS})\\b|\\bavoid (?:areas|neighbou?rhoods)\\b.{0,30}\\b(?:${GROUPS})\\b`, 'i') },
]

const PROFANITY = /\b(?:fuck\w*|shit\w*|bitch\w*|asshole\w*|bastard\w*|dickhead\w*|bullshit)\b/gi

export function checkSafety(text: string): SafetyResult {
  const hit = RULES.find((r) => r.re.test(text))
  let profanity = 0
  const cleaned = text.replace(PROFANITY, () => { profanity++; return '****' })
  return { category: hit?.category, text: cleaned, profanity }
}

export const SAFETY_MESSAGE: Record<SafetyCategory, string> = {
  threat: 'This text contains a threat. It needs a personal response, so I will not draft one.',
  hate: 'This text contains hateful language, so I will not use it.',
  sexual: 'This text contains sexual content, which is not allowed here.',
  'self-harm': 'This mentions harming yourself. If you are in danger or thinking about it, please contact local emergency services or a crisis line. I will not use this text.',
  fraud: 'This describes fraud or illegal activity, which I cannot help with.',
  discrimination: 'This describes discrimination in lending or housing, which is not allowed and I cannot help with it.',
}

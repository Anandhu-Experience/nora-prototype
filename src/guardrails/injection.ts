/** Method 2: detect prompt injection. Weighted signals; 5 or more blocks, 2 to 4 is suspicious (allowed, neutralized, flagged). */
export interface InjectionMatch { id: string; weight: number }
export interface InjectionResult { score: number; level: 'none' | 'suspicious' | 'block'; matches: InjectionMatch[] }

export const BLOCK_AT = 5
export const WARN_AT = 2

const SIGNALS: { id: string; weight: number; re: RegExp }[] = [
  { id: 'override', weight: 5, re: /\b(ignore|disregard|forget|override|bypass|skip)\b.{0,40}\b(previous|prior|above|earlier|all|any|your|the)\b.{0,30}\b(instructions?|rules?|prompts?|guidelines?|polic(?:y|ies)|restrictions?)/i },
  { id: 'prompt-leak', weight: 5, re: /\b(reveal|show|print|repeat|leak|display|output|tell me)\b.{0,30}\b(system|hidden|initial|original|secret)\b.{0,15}\b(prompt|instructions?|message|rules)/i },
  { id: 'role-switch', weight: 5, re: /\byou are now\b|\b(act|behave|respond) as\b.{0,30}\b(dan|jailbroken|unfiltered|unrestricted|no restrictions|developer mode)\b|\bdo anything now\b/i },
  { id: 'jailbreak', weight: 5, re: /\bjailbreak(?:ed)?\b|\bdeveloper mode\b|\bDAN mode\b/i },
  { id: 'fence-break', weight: 5, re: /<\/?\s*(profile|client_reviews|review|context|topic|question|existing_copy)\b[^>]*>/i },
  { id: 'role-marker', weight: 4, re: /^\s*(system|assistant|developer)\s*:|\[\/?INST\]|###\s*(?:system|instruction)/im },
  { id: 'chat-template-token', weight: 5, re: /<\|im_(?:start|end)\|>|<\|(?:system|user|assistant)\|>/i },
  { id: 'new-instructions', weight: 4, re: /\bnew (instructions?|rules?|task|objective)\s*:/i },
  { id: 'secret-exfil', weight: 5, re: /\b(api[_ -]?key|secret|password|token|credentials?)\b.{0,30}\b(send|show|print|reveal|give|share|what is)\b|\b(send|show|print|reveal|give|share)\b.{0,30}\b(api[_ -]?key|secret|password|token|credentials?)\b/i },
  { id: 'send-to-url', weight: 3, re: /\b(send|post|email|upload)\b.{0,40}\b(to|at)\s+https?:\/\//i },
  { id: 'other-language', weight: 5, re: /ignora(?:r)? (?:las |todas las )?instrucciones (?:anteriores|previas)|ignorez? (?:les |toutes les )?instructions (?:précédentes|precedentes)|ignoriere (?:alle )?(?:vorherigen|bisherigen) anweisungen/i },
  { id: 'hidden-text', weight: 3, re: /[​-‏⁠﻿]|[\u{E0000}-\u{E007F}]/u },
  { id: 'encoded-blob', weight: 3, re: /[A-Za-z0-9+/]{80,}={0,2}/ },
  { id: 'run-command', weight: 3, re: /\b(execute|run)\b.{0,20}\b(command|script|shell|code|sql)\b/i },
  { id: 'destructive-command', weight: 5, re: /\brm\s+-rf\b|\bdrop\s+table\b|\bcurl\s+https?:|\bwget\s+https?:/i },
  { id: 'soft-framing', weight: 2, re: /\b(pretend|imagine|hypothetically)\b.{0,40}\b(no rules|ignore|without restrictions|you can)\b/i },
]

export function detectInjection(text: string): InjectionResult {
  const matches = SIGNALS.filter((s) => s.re.test(text)).map((s) => ({ id: s.id, weight: s.weight }))
  const score = matches.reduce((n, m) => n + m.weight, 0)
  return { score, level: score >= BLOCK_AT ? 'block' : score >= WARN_AT ? 'suspicious' : 'none', matches }
}

/** Rewrites the tags our prompts use as fences, so untrusted text cannot close one. Applied to everything, blocked or not. */
export const neutralizeDelimiters = (text: string): string =>
  text.replace(/<(\/?)\s*(profile|client_reviews|review|context|topic|question|existing_copy)\b([^>]*)>/gi, '‹$1$2$3›').replace(/[​-‏⁠﻿]/g, '')

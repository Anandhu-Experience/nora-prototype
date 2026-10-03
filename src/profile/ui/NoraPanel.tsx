import { ArrowUp, BarChart3, Trash2, Workflow, Bot, ChevronDown, MessageSquare, MessageSquarePlus, Minus, RotateCcw, Square, Zap, Sparkle, Sparkles, UserPlus, Wrench } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TOOLS, pathSuggestions, pathTools, suggestionsFor } from '../assistant'
import { useNora, useNoraChat, useNoraPanel, useNoraProcessing, useNoraStop, useReferral } from '../NoraContext'
import { useStore } from '../store'
import { traceStore } from '../../guardrails/trace'
import { ChipSlider } from './ChipSlider'
import { ScrollFade } from './ScrollFade'
import { NoraActions } from './NoraActions'

const ICON: Record<string, ReactNode> = {
  reviews: <MessageSquare size={14} />, strengths: <BarChart3 size={14} />, draft: <UserPlus size={14} />, services: <Wrench size={14} />,
}
const first = (name: string) => name.replace(/^agent\s+/i, '').split(' ')[0]!

/** Docked, chat-first NORA: greeting, what NORA found, quick actions, then the conversation. */
export function NoraPanel() {
  const { setOpen } = useNoraPanel()
  const chat = useNoraChat()
  const openReferral = useReferral()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const toolChips = pathTools(pathname) ?? TOOLS.map((t) => ({ label: t.label, prompt: t.prompt }))
  const processing = useNoraProcessing()
  const stop = useNoraStop()
  const { state: nora } = useNora()
  const stoppable = ['SKILL_APPROVED', 'READING', 'VALIDATING', 'DRAFT_READY'].includes(nora.status)
  const store = useStore()
  const me = store.agents[store.viewerId]!
  const viewing = chat.agent
  const quickItems = pathSuggestions(pathname) ?? suggestionsFor(viewing)
  const [draft, setDraft] = useState('')
  const [composer, setComposer] = useState(false)
  const [quick, setQuick] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (composer) box.current?.focus()
  }, [composer])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [chat.turns.length, chat.pending])

  const send = () => {
    if (!draft.trim() || chat.pending) return
    chat.ask(draft)
    setDraft('')
  }
  const hasChat = chat.turns.length > 0

  return (
    <section aria-label="NORA" role="dialog" aria-modal="false" tabIndex={-1} aria-busy={processing} className={`outline-none flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-pink-300 bg-gradient-to-b from-purple-500 via-purple-400 to-pink-300 shadow-card ${processing ? 'nora-glow' : ''}`}>
      <header className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pb-7 pt-4 text-white">
        <Sparkle size={14} className="absolute right-16 top-3 opacity-80" fill="currentColor" />
        <Sparkle size={9} className="absolute right-24 top-8 opacity-60" fill="currentColor" />
        <span aria-hidden />
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-purple-600" role="img" aria-label="NORA"><Sparkles size={22} /></span>
        <div className="flex items-center justify-end gap-2">
          {processing && (
            <button onClick={stop} disabled={!stoppable} aria-label="Stop NORA" title={stoppable ? 'Stop this run. Nothing will be changed.' : 'Applying changes…'} className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-white disabled:opacity-60">
              <Square size={11} fill="currentColor" /> {stoppable ? 'Stop' : 'Applying…'}
            </button>
          )}
          <button onClick={() => setOpen(false)} aria-label="Minimize NORA" title="Minimize" className="rounded-full p-1.5 text-white/90 hover:bg-white/20"><Minus size={20} /></button>
        </div>
      </header>

      <div className="relative -mt-4 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-white">
        <ScrollFade className="px-5 pb-3 pt-3">
          {!hasChat && (
            <div className="flex items-center gap-3 text-left">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-[0_0_28px_rgba(236,72,153,0.4)]"><Bot size={22} /></span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-tight text-slate-900">Hello {first(me.name)}</h2>
                <p className="text-sm text-slate-500">{viewing.id === me.id ? 'What can I help you with today?' : `You’re viewing ${viewing.name}’s profile. What can I help you with?`}</p>
              </div>
            </div>
          )}

          <div className="mt-3"><NoraActions /></div>

          {hasChat && (
            <div className="mt-5 space-y-3" aria-live="polite">
              <div className="flex justify-end"><button onClick={chat.clear} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={12} /> Clear chat</button></div>
              {chat.turns.map((t) =>
                t.role === 'user' ? (
                  <div key={t.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-purple-100 px-3.5 py-2 text-sm text-slate-900">{t.text}</div>
                  </div>
                ) : (
                  <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 text-sm shadow-card">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-purple-600"><Sparkles size={13} /> NORA</div>
                    {t.answer?.intro && <p className="mb-2 text-slate-700">{t.answer.intro}</p>}
                    {t.answer?.items && (
                      <ol className="space-y-2.5">
                        {t.answer.items.map((it, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">{i + 1}</span>
                            <span><span className="block font-semibold text-slate-900">{it.title}</span><span className="text-slate-600">{it.detail}</span></span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {t.answer?.text && <p className="whitespace-pre-line text-slate-700">{t.answer.text}</p>}
                    {t.traceId && <button onClick={() => traceStore.open(t.traceId!)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-blue-600"><Workflow size={12} /> View steps</button>}
                    {(t.answer?.actions || t.answer?.links) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {t.answer.actions?.includes('referral') && <button className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110" onClick={() => openReferral(viewing.id, t.answer?.text)}>Use as referral</button>}
                        {t.answer.actions?.includes('reviews') && <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50" onClick={() => nav(`/profile/${viewing.id}?tab=reviews`)}>View all reviews</button>}
                        {t.answer.links?.map((l, i) => <button key={l.to + i} className={i === 0 ? 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110' : 'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50'} onClick={() => { setOpen(false); nav(l.to) }}>{l.label}</button>)}
                      </div>
                    )}
                  </div>
                ),
              )}
              {chat.pending && (
                <div className="flex w-fit items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-3" aria-label="NORA is thinking">
                  {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400" style={{ animationDelay: `${i * 120}ms` }} />)}
                </div>
              )}
              <div ref={end} />
            </div>
          )}
        </ScrollFade>

        <footer className="px-4 pb-4 pt-2">
          {quick && (
            <div className="mb-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">Quick actions</div>
              <div className="flex flex-col items-start gap-2">
                {quickItems.map((q) => (
                  <button key={q.text} onClick={() => { setQuick(false); chat.ask(q.text) }} className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 text-sm text-slate-800 shadow-sm hover:border-purple-300">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-600">{ICON[q.icon]}</span>
                    <span className="truncate">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuick((v) => !v)} aria-expanded={quick} aria-label={quick ? 'Hide quick actions' : 'Show quick actions'} title={quick ? 'Hide quick actions' : 'Quick actions'}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${quick ? 'border-purple-300 bg-purple-50 text-purple-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {quick ? <ChevronDown size={16} /> : <Zap size={16} />}
            </button>
            <button
              onClick={() => setComposer((c) => !c)} aria-expanded={composer} aria-label={composer ? 'Hide message box' : 'Show message box'} title={composer ? 'Hide message box' : 'Type a message'}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${composer ? 'border-purple-300 bg-purple-50 text-purple-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              {composer ? <ChevronDown size={16} /> : <MessageSquarePlus size={16} />}
            </button>
            {hasChat && (
              <button onClick={chat.clear} aria-label="Clear chat" title="Clear chat" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><RotateCcw size={15} /></button>
            )}
            <ChipSlider>
              {toolChips.map((t) => (
                <button key={t.label} onClick={() => chat.ask(t.prompt)} className="shrink-0 snap-start whitespace-nowrap rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">{t.label}</button>
              ))}
            </ChipSlider>
          </div>
          {composer && (
            <div className="mt-2 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-purple-300">
              <textarea
                ref={box} aria-label="Ask NORA" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } else if (e.key === 'Escape') setComposer(false) }}
                placeholder="How can I help you today?" className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-slate-400"
              />
              <button onClick={send} disabled={!draft.trim() || chat.pending} aria-label="Send question" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:brightness-110 disabled:opacity-40"><ArrowUp size={16} /></button>
            </div>
          )}
        </footer>
      </div>
    </section>
  )
}

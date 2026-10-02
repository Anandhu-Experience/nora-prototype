import { ArrowUp, MessageSquare, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { actions, unreadMessages, useStore } from '../store'
import { Avatar } from '../ui/bits'
import { INPUT } from '../ui/Modal'
import { ScrollFade } from '../ui/ScrollFade'
import { EmptyState, PageHeader } from '../ui/PageBits'

const time = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function MessagesPage() {
  const state = useStore()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState('')
  const end = useRef<HTMLDivElement>(null)

  const threads = useMemo(() => state.threads.filter((t) => t.withName.toLowerCase().includes(filter.toLowerCase())), [state.threads, filter])
  const selectedId = params.get('t') ?? state.threads[0]?.id
  const thread = state.threads.find((t) => t.id === selectedId)
  const person = thread?.withAgentId ? state.agents[thread.withAgentId] : undefined
  const unread = unreadMessages(state)

  useEffect(() => {
    if (thread?.unread) actions.markThreadRead(thread.id)
  }, [thread?.id, thread?.unread, thread])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [thread?.messages.length])

  const send = () => {
    if (!thread || !draft.trim()) return
    actions.sendThreadMessage(thread.id, draft.trim())
    setDraft('')
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={MessageSquare} title="Messages" subtitle={unread ? `${unread} unread conversation${unread === 1 ? '' : 's'}` : 'You’re all caught up.'} />

      {state.threads.length === 0 ? (
        <EmptyState>No conversations yet. Request a referral from a professional’s profile to start one.</EmptyState>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col border-b border-slate-200 md:border-b-0 md:border-r">
            <div className="border-b border-slate-100 p-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${INPUT} pl-9`} placeholder="Search conversations" aria-label="Search conversations" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
            </div>
            {/* Phones: conversations as one swipeable row with edge fades. From md up they are the vertical list below. */}
            <div className="border-b border-slate-100 py-2.5 md:hidden">
              {threads.length === 0 ? (
                <p className="px-4 text-sm text-slate-500">No conversations match.</p>
              ) : (
                <ScrollFade axis="x" className="px-3" innerClassName="flex gap-2" innerProps={{ role: 'tablist', 'aria-label': 'Conversations' }}>
                  {threads.map((t) => {
                    const a = t.withAgentId ? state.agents[t.withAgentId] : undefined
                    const selected = t.id === thread?.id
                    return (
                      <button
                        key={t.id} role="tab" aria-selected={selected} onClick={() => setParams({ t: t.id }, { replace: true })}
                        className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        {a ? <Avatar agent={a} size={28} /> : <span className="h-7 w-7 rounded-full bg-slate-200" />}
                        <span className={t.unread ? 'font-bold' : 'font-medium'}>{t.withName}</span>
                        {t.unread && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />}
                      </button>
                    )
                  })}
                </ScrollFade>
              )}
            </div>
            <div className="hidden md:block">
            <ScrollFade maxHeight={480}>
            <ul>
              {threads.length === 0 && <li className="p-4 text-sm text-slate-500">No conversations match.</li>}
              {threads.map((t) => {
                const a = t.withAgentId ? state.agents[t.withAgentId] : undefined
                const last = t.messages.at(-1)!
                return (
                  <li key={t.id}>
                    <button onClick={() => setParams({ t: t.id }, { replace: true })} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${t.id === thread?.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      {a ? <Avatar agent={a} size={40} /> : <span className="h-10 w-10 rounded-full bg-slate-200" />}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${t.unread ? 'font-bold' : 'font-medium'} text-slate-900`}>{t.withName}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{time(last.at).split(',')[0]}</span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-slate-500">{last.from === 'me' ? 'You: ' : ''}{last.text}</span>
                          {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            </ScrollFade>
            </div>
          </div>

          {thread && (
            <div className="flex min-h-[460px] flex-col">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                {person ? <Avatar agent={person} size={38} online /> : null}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{thread.withName}</div>
                  {person && <div className="truncate text-xs text-slate-500">{person.title} · {person.city}</div>}
                </div>
                {person && <Link to={`/profile/${person.id}`} className="text-sm font-medium text-blue-600 hover:underline">View profile</Link>}
              </div>
              <ScrollFade tone="slate" maxHeight={400} wrapperClassName="bg-slate-50/60" className="p-5" innerClassName="space-y-3">
                {thread.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : ''}`}>
                    <div className={`max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm ${m.from === 'me' ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'}`}>
                      {m.text}
                      <div className={`mt-1 text-[10px] ${m.from === 'me' ? 'text-blue-100' : 'text-slate-400'}`}>{time(m.at)}</div>
                    </div>
                  </div>
                ))}
                <div ref={end} />
              </ScrollFade>
              <div className="border-t border-slate-100 p-3">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 pl-4 focus-within:border-blue-400">
                  <input className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" placeholder="Write a message…" aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
                  <button onClick={send} disabled={!draft.trim()} aria-label="Send message" className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white hover:brightness-110 disabled:opacity-40"><ArrowUp size={17} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

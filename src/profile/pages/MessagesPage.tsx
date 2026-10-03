import { Archive, ArchiveRestore, ArrowUp, Inbox, MessageSquare, RefreshCw, Search, Sparkles, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { folderThreads, networkStore, toggleArchive, toggleStar, type Folder } from '../../presence/network'
import { draftMessage } from '../assistant'
import { actions, useStore } from '../store'
import type { Agent } from '../types'
import { useToast } from '../ui/Toast'
import { Avatar } from '../ui/bits'
import { INPUT } from '../ui/Modal'
import { ScrollFade } from '../ui/ScrollFade'
import { EmptyState, PageHeader } from '../ui/PageBits'

const FOLDERS: { id: Folder; label: string }[] = [{ id: 'inbox', label: 'Inbox' }, { id: 'starred', label: 'Starred' }, { id: 'archived', label: 'Archived' }]
const EMPTY: Record<Folder, string> = { inbox: 'Nothing here yet.', starred: 'Star a conversation to find it here.', archived: 'Archived conversations appear here.' }
const QUICK = ['Thanks, I’ll take a look and get back to you today.', 'Can we schedule a quick call this week?', 'Happy to help. Please send me the client’s details.']

const time = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function MessagesPage() {
  const state = useStore()
  const net = networkStore.use()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const [drafted, setDrafted] = useState(false)
  const [filter, setFilter] = useState('')
  const [folder, setFolder] = useState<Folder>('inbox')
  const [refreshing, setRefreshing] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  const threads = useMemo(() => folderThreads(net, state.threads, state.agents, folder, filter), [net, state.threads, state.agents, folder, filter])
  const countIn = (f: Folder) => folderThreads(net, state.threads, state.agents, f).length
  const selectedId = params.get('t') ?? threads[0]?.id
  const thread = threads.find((t) => t.id === selectedId)
  const person = thread?.withAgentId ? state.agents[thread.withAgentId] : undefined
  const unread = state.threads.filter((t) => t.unread && !net.archived.includes(t.id)).length
  const starred = thread ? net.starred.includes(thread.id) : false
  const archived = thread ? net.archived.includes(thread.id) : false

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
    setDrafted(false)
  }
  const aiDraft = () => {
    if (!thread) return
    const who = person ?? ({ id: thread.id, name: thread.withName, specialties: [], yearsExperience: 0 } as unknown as Agent)
    setDraft(draftMessage(who, { purpose: 'followup', tone: 'friendly' }))
    setDrafted(true)
  }
  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => { setRefreshing(false); toast('Inbox is up to date') }, 600)
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader
        icon={MessageSquare} title="Messages" subtitle={unread ? `${unread} unread conversation${unread === 1 ? '' : 's'}` : 'You’re all caught up.'}
        right={<button onClick={refresh} aria-label="Refresh messages" className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>}
      />

      {state.threads.length === 0 ? (
        <EmptyState>No conversations yet. Request a referral from a professional’s profile to start one.</EmptyState>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex min-h-0 min-w-0 flex-col border-b border-slate-200 md:border-b-0 md:border-r">
            <div className="border-b border-slate-100 p-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${INPUT} pl-9`} placeholder="Search by name, email, or phone" aria-label="Search conversations" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
              <div role="tablist" aria-label="Folder" className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
                {FOLDERS.map((f) => (
                  <button key={f.id} role="tab" aria-selected={folder === f.id} onClick={() => setFolder(f.id)} className={`rounded-md py-1 text-xs font-medium ${folder === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{f.label}{countIn(f.id) > 0 && <span className="ml-1 text-slate-400">{countIn(f.id)}</span>}</button>
                ))}
              </div>
            </div>
            {/* Phones: conversations as one swipeable row with edge fades. From md up they are the vertical list below. */}
            <div className="border-b border-slate-100 py-2.5 md:hidden">
              {threads.length === 0 ? (
                <p className="px-4 text-sm text-slate-500">{EMPTY[folder]}</p>
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
                        {net.starred.includes(t.id) && <Star size={12} className="fill-amber-400 text-amber-400" aria-label="Starred" />}
                        {t.unread && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Unread" />}
                      </button>
                    )
                  })}
                </ScrollFade>
              )}
            </div>
            <div className="hidden min-h-0 flex-1 flex-col md:flex">
            <ScrollFade maxHeight={480}>
            <ul>
              {threads.length === 0 && (
                <li className="flex flex-col items-center gap-1 px-4 py-10 text-center"><Inbox size={22} className="text-slate-400" /><span className="text-sm font-medium text-slate-700">No conversations</span><span className="text-xs text-slate-500">{EMPTY[folder]}</span></li>
              )}
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
                          {net.starred.includes(t.id) && <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" aria-label="Starred" />}
                          {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            </ScrollFade>
            <div className="mx-3 mb-3 mt-auto rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700"><Sparkles size={13} /> NORA tip</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">Open a conversation and tap <b>Draft with AI</b> to write a reply. You read and send it; nothing goes out on its own.</p>
            </div>
            </div>
          </div>

          {!thread && (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 p-8 text-center max-md:hidden">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><MessageSquare size={24} /></span>
              <div className="text-sm font-semibold text-slate-800">No conversation selected</div>
              <p className="text-xs text-slate-500">Pick any chat from the left side to read and reply.</p>
            </div>
          )}
          {thread && (
            <div className="flex min-h-[460px] flex-col">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                {person ? <Avatar agent={person} size={38} online /> : null}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{thread.withName}</div>
                  {person && <div className="truncate text-xs text-slate-500">{person.title} · {person.city}</div>}
                </div>
                {person && <Link to={`/profile/${person.id}`} className="text-sm font-medium text-blue-600 hover:underline max-sm:hidden">View profile</Link>}
                <button onClick={() => { toggleStar(thread.id); toast(starred ? 'Removed from Starred' : 'Conversation starred') }} aria-label={starred ? 'Unstar conversation' : 'Star conversation'} aria-pressed={starred} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Star size={17} className={starred ? 'fill-amber-400 text-amber-400' : ''} /></button>
                <button onClick={() => { toggleArchive(thread.id); toast(archived ? 'Moved back to Inbox' : 'Conversation archived') }} aria-label={archived ? 'Move to inbox' : 'Archive conversation'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}</button>
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
                <ScrollFade axis="x" wrapperClassName="mb-2" innerClassName="flex items-center gap-2">
                  <button onClick={aiDraft} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"><Sparkles size={12} /> Draft with AI</button>
                  {QUICK.map((r) => <button key={r} onClick={() => { setDraft(r); setDrafted(false) }} className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">{r}</button>)}
                </ScrollFade>
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 pl-4 focus-within:border-blue-400">
                  <textarea rows={draft.includes('\n') ? 4 : 1} className="min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" placeholder="Write a message…" aria-label="Message" value={draft} onChange={(e) => { setDraft(e.target.value); setDrafted(false) }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
                  <button onClick={send} disabled={!draft.trim()} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:brightness-110 disabled:opacity-40"><ArrowUp size={17} /></button>
                </div>
                {drafted && <p className="mt-1.5 text-xs text-purple-600">Template draft. Review and edit it, nothing is sent until you press send.</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

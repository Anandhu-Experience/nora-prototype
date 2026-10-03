import { CalendarClock, Eye, EyeOff, FileText, Loader2, Pencil, Rocket, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteArticle, publishArticle, scheduleArticle, scheduleError, unpublishArticle, voceStore, type Article, type ArticleStatus } from '../../../presence/voce'
import { Field } from '../bits'
import { Card, EmptyState } from '../PageBits'
import { Pill } from '../kit'
import { BTN_GHOST, BTN_PRIMARY, INPUT, Modal } from '../Modal'
import { useToast } from '../Toast'
import { SubTabs } from '../insights/shared'
import { ScrollFade } from '../ScrollFade'

const TONE = { published: 'green', scheduled: 'blue', draft: 'slate' } as const

export function ArticlesCard({ onEdit, onStart }: { onEdit: (a: Article) => void; onStart: () => void }) {
  const s = voceStore.use()
  const toast = useToast()
  const [tab, setTab] = useState<ArticleStatus>('published')
  const [sched, setSched] = useState<Article | null>(null)
  const [date, setDate] = useState('')
  const [del, setDel] = useState<Article | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const count = (st: ArticleStatus) => s.articles.filter((a) => a.status === st).length
  const list = s.articles.filter((a) => a.status === tab)
  const dateErr = sched && date ? scheduleError(date) : null
  const pub = async (a: Article) => { setBusy(a.id); await publishArticle(a.id); setBusy(null); toast(`Published "${a.title}"`) }

  return (
    <Card icon={FileText} title="Articles written">
      <SubTabs tabs={[{ id: 'published', label: `Published (${count('published')})` }, { id: 'scheduled', label: `Scheduled (${count('scheduled')})` }, { id: 'draft', label: `Drafts (${count('draft')})` }]} value={tab} onChange={setTab} />
      <div className="mt-4">
        {list.length === 0 ? (
          <EmptyState>
            <p className="font-medium text-slate-700">{tab === 'published' ? 'Start writing to get questions from your readers.' : tab === 'scheduled' ? 'No scheduled articles.' : 'No drafts.'}</p>
            <p className="mx-auto mt-1 max-w-md">Questions and answers are some of the most powerful ways to boost your AI discoverability.</p>
            <button onClick={onStart} className={`${BTN_PRIMARY} mt-4`}><Rocket size={15} /> Start publishing</button>
          </EmptyState>
        ) : (
          <ScrollFade maxHeight={420}>
            <ul className="divide-y divide-slate-100">
              {list.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 font-medium text-slate-900">{a.title}</span><Pill tone={TONE[a.status]}>{a.status === 'scheduled' ? `Scheduled ${a.publishAt}` : a.status[0]!.toUpperCase() + a.status.slice(1)}</Pill></div>
                  <div className="mt-0.5 text-xs text-slate-500">{a.status === 'published' ? `Published ${a.publishedAt?.slice(0, 10)}` : `Updated ${a.updatedAt.slice(0, 10)}`}{a.origin !== 'manual' && ' · drafted with NORA'}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => onEdit(a)} className={`${BTN_GHOST} !px-3 !py-1.5`}><Pencil size={13} /> Edit</button>
                    {a.status !== 'published' && <button onClick={() => { setSched(a); setDate(a.publishAt ?? '') }} className={`${BTN_GHOST} !px-3 !py-1.5`}><CalendarClock size={13} /> Schedule</button>}
                    {a.status !== 'published' && <button disabled={busy === a.id} onClick={() => pub(a)} className={`${BTN_GHOST} !px-3 !py-1.5`}>{busy === a.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Publish</button>}
                    {a.status === 'published' && <button onClick={() => { unpublishArticle(a.id); toast('Moved back to drafts') }} className={`${BTN_GHOST} !px-3 !py-1.5`}><EyeOff size={13} /> Unpublish</button>}
                    {a.status === 'published' && <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Eye size={13} /> Live</span>}
                    <button onClick={() => setDel(a)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"><Trash2 size={13} /> Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollFade>
        )}
      </div>
      {sched && (
        <Modal title="Schedule article" onClose={() => setSched(null)} footer={<><button onClick={() => setSched(null)} className={BTN_GHOST}>Cancel</button><button disabled={!date || !!dateErr} onClick={() => { scheduleArticle(sched.id, date); toast(`Scheduled for ${date}`); setSched(null) }} className={BTN_PRIMARY}>Schedule</button></>}>
          <p className="mb-3 text-sm text-slate-600">"{sched.title}" will stay a scheduled draft until the date. It does not earn authority points until it is published.</p>
          <Field label="Publish on" error={dateErr ?? undefined}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} /></Field>
        </Modal>
      )}
      {del && (
        <Modal title="Delete article?" onClose={() => setDel(null)} footer={<><button onClick={() => setDel(null)} className={BTN_GHOST}>Keep it</button><button onClick={() => { deleteArticle(del.id); toast('Article deleted'); setDel(null) }} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110">Delete</button></>}>
          <p className="text-sm text-slate-600">"{del.title}" will be removed{del.status === 'published' ? ' and your AI Authority Score will drop' : ''}. This cannot be undone.</p>
        </Modal>
      )}
    </Card>
  )
}

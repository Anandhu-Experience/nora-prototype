import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fmtDate } from '../selectors'
import { actions, unreadNotifications, useStore } from '../store'
import { BTN_GHOST } from '../ui/Modal'
import { EmptyState, PageHeader } from '../ui/PageBits'

export default function NotificationsPage() {
  const state = useStore()
  const nav = useNavigate()
  const unread = unreadNotifications(state).length
  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      <PageHeader
        icon={Bell} title="Notifications" subtitle={unread ? `${unread} unread` : 'You’re all caught up.'}
        right={<button className={BTN_GHOST} disabled={!unread} onClick={() => actions.markAllNotificationsRead()}><CheckCheck size={15} /> Mark all as read</button>}
      />
      {state.notifications.length === 0 ? <EmptyState>No notifications yet.</EmptyState> : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          {state.notifications.map((n) => (
            <li key={n.id}>
              <button onClick={() => { actions.markNotificationRead(n.id); nav(n.link) }} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50">
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-blue-600'}`} />
                <span className="min-w-0 flex-1"><span className={`block text-sm ${n.read ? 'text-slate-500' : 'font-medium text-slate-900'}`}>{n.text}</span><span className="text-xs text-slate-400">{fmtDate(n.at)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

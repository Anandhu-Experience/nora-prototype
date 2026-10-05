import { ShieldCheck } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { ConsentRequest } from '../../skills/types'
import { BTN_GHOST, BTN_PRIMARY, Modal } from './Modal'

/**
 * The provider's own consent screen, mocked. NORA never handles a password: the user grants (or refuses) access here,
 * and only "Allow" lets the skill's write run. No real account is touched.
 */
export function ConsentModal({ request, onAllow, onCancel }: { request: ConsentRequest; onAllow: () => void; onCancel: () => void }) {
  // portalled to the page: the NORA panel is its own stacking layer and would otherwise trap the overlay beneath the top bar
  return createPortal(
    <Modal
      title={<span className="flex items-center gap-2"><GoogleG /> Sign in with {request.provider}</span>}
      onClose={onCancel}
      footer={<><button className={BTN_GHOST} onClick={onCancel}>Cancel</button><button className={BTN_PRIMARY} onClick={onAllow} data-testid="consent-allow">Allow</button></>}
    >
      <p className="text-sm font-medium text-slate-900">Experience.com wants to access your {request.provider} account</p>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{request.account.charAt(0)}</span>
        <div className="text-sm"><div className="font-medium text-slate-900">{request.account}</div><div className="text-xs text-slate-500">Business profile</div></div>
      </div>
      <p className="mt-4 text-sm text-slate-700">Experience.com will be able to:</p>
      <ul className="mt-2 space-y-2">
        {request.permissions.map((p) => <li key={p} className="flex items-start gap-2 text-sm text-slate-700"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />{p}</li>)}
      </ul>
      <p className="mt-4 text-xs text-slate-500">You can disconnect at any time from Connections. This is a demo: no real {request.provider} account is touched and no password is asked for.</p>
    </Modal>,
    document.body,
  )
}

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.4 0 20.100 0 24s.9 7.600 2.600 10.800l7.800-6.100z" />
      <path fill="#34A853" d="M24 48c6.200 0 11.500-2 15.300-5.600l-7.500-5.800c-2.100 1.400-4.700 2.200-7.800 2.200-6.300 0-11.700-4.200-13.600-9.900l-7.800 6.100C6.500 42.600 14.600 48 24 48z" />
    </svg>
  )
}

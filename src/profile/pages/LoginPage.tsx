import { AlertCircle, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { DEMO_ACCOUNT, clearSignedOut, login, peekSignedOut, useAuth } from '../auth'
import { INPUT } from '../ui/Modal'
import { Logo } from '../ui/Logo'

export default function LoginPage() {
  const authed = useAuth()
  const nav = useNavigate()
  const [signedOut] = useState(peekSignedOut)
  useEffect(() => clearSignedOut(), [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (authed && !busy) return <Navigate to="/profile" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    // a short pause so the sign-in feels real
    setTimeout(() => {
      const res = login(email, password)
      if (res.ok) nav('/profile', { replace: true })
      else {
        setError(res.error)
        setBusy(false)
      }
    }, 600)
  }

  const useDemo = () => {
    setEmail(DEMO_ACCOUNT.email)
    setPassword(DEMO_ACCOUNT.password)
    setError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-100 via-slate-100 to-blue-100 p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Logo size={34} />
          <span className="text-2xl font-extrabold tracking-tight text-slate-900">experience<span className="text-blue-600">.com</span></span>
        </div>

        <form onSubmit={submit} noValidate className="rounded-3xl border border-slate-200 bg-white p-7 shadow-card">
          <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account.</p>

          {signedOut && !error && <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">You’ve been signed out.</p>}
          {error && (
            <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertCircle size={16} /> {error}</p>
          )}

          <label className="mt-5 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
            <input type="email" autoComplete="username" autoFocus className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Password</span>
            <span className="relative block">
              <input type={show ? 'text' : 'password'} autoComplete="current-password" className={`${INPUT} pr-10`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          <button type="submit" disabled={busy} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] hover:brightness-110 disabled:opacity-70">
            {busy ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 rounded-2xl border border-purple-100 bg-white/70 px-4 py-3 text-center text-sm text-slate-600 backdrop-blur">
          <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide text-purple-600"><Sparkles size={13} /> Prototype</p>
          <p className="mt-1">No real account needed. Use the demo account:</p>
          <button type="button" onClick={useDemo} className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Fill demo credentials</button>
        </div>
      </div>
    </div>
  )
}

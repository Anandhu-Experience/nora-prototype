import { AlertCircle, CheckCircle2, Globe, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { verificationTag, websiteActions, WEBSITE_MAX, type WebsiteState } from '../../../presence/website'
import type { Agent } from '../../types'
import { Hero, HeroBar } from '../kit'
import { BTN_GHOST, BTN_PRIMARY, INPUT } from '../Modal'
import { useToast } from '../Toast'
import { CopyBox } from './ParamCard'

type Who = Pick<Agent, 'name' | 'title' | 'city' | 'phone'>

/** Hero: score, the website form and the verification state (with the reason and a one-click fix when it fails). */
export function VerifyHero({ state, score, agent }: { state: WebsiteState; score: number; agent: Who }) {
  const toast = useToast()
  const [val, setVal] = useState(state.url)
  useEffect(() => setVal(state.url), [state.url])
  const busy = state.status === 'verifying' || state.scanning

  const save = async () => {
    const before = val.trim()
    const url = websiteActions.saveUrl(before)
    if (!url) return
    if (url !== before) toast(`We tidied your address to ${url}`, 'info')
    const ok = await websiteActions.verify(agent)
    toast(ok ? 'Website verified and scanned' : 'We could not verify the site yet. See how to fix it below.', ok ? 'success' : 'error')
  }
  const retry = async () => {
    const ok = await websiteActions.verify(agent)
    toast(ok ? 'Website verified and scanned' : 'Still not verified. See the reason below.', ok ? 'success' : 'error')
  }
  const addForMe = async () => {
    websiteActions.addTagForMe()
    toast('Verification tag added to your site', 'info')
    await retry()
  }

  return (
    <div className="space-y-4">
      <Hero
        title="Website Analytics"
        blurb="Your professional website is your most important online citation. This AI-powered audit checks every critical SEO and trust signal so search engines find consistent, robust data about you."
        aside={<span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 text-white/90"><Globe size={44} /></span>}
      >
        <div className="mb-3 flex items-end gap-1"><span className="text-4xl font-bold">{score}</span><span className="pb-1 text-lg text-white/70">/{WEBSITE_MAX}</span></div>
        <HeroBar pct={(score / WEBSITE_MAX) * 100} />
        <form onSubmit={(e) => { e.preventDefault(); void save() }} className="mt-5 max-w-xl">
          <label htmlFor="site-url" className="mb-1.5 block text-xs font-medium text-white/80">Your website</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="site-url" value={val} onChange={(e) => setVal(e.target.value)} placeholder="www.yourname.com" inputMode="url" autoComplete="url" className={`${INPUT} sm:flex-1`} />
            <button type="submit" disabled={busy || !val.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-white/90 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : null} Save &amp; verify
            </button>
          </div>
        </form>
        <div className="mt-4 max-w-xl" role="status" aria-live="polite">
          {state.status === 'verifying' && <Banner tone="bg-white/15" icon={<Loader2 size={16} className="animate-spin" />} title="Verifying your website…" text="Checking that the site is online and belongs to you." />}
          {state.status === 'failed' && (
            <Banner tone="bg-rose-500/90" icon={<AlertCircle size={16} />} title="Verification failed" text={state.failure?.reason ?? 'We could not verify this site.'} action={<button onClick={() => void retry()} disabled={busy || state.failure?.code === 'invalid'} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-white/90 disabled:opacity-50"><RefreshCw size={13} /> Retry verification</button>} />
          )}
          {state.status === 'verified' && (
            <Banner tone="bg-emerald-500/90" icon={<CheckCircle2 size={16} />} title="Website verified" text={state.scanning ? 'Scanning your site…' : state.scannedAt ? `Last scanned ${state.scannedAt.slice(0, 10)}${state.source ? (state.source === 'live' ? ' · live results' : ' · sample data') : ''}` : 'Ready to scan.'} action={<button onClick={() => void websiteActions.scan(agent).then(() => toast('Scan complete'))} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-white/90 disabled:opacity-50">{state.scanning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-scan</button>} />
          )}
          {state.status === 'none' && <Banner tone="bg-white/15" icon={<AlertCircle size={16} />} title="Not verified yet" text="Save your website to verify it and see your score." />}
        </div>
      </Hero>

      {state.status === 'failed' && state.failure && state.failure.code !== 'invalid' && (
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-card" aria-label="How to fix verification">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900"><Wand2 size={17} className="text-purple-500" /> {state.failure.code === 'tag' ? 'Add the verification tag' : 'We could not reach your site'}</h2>
          <p className="mt-1 text-sm text-slate-500">{state.failure.fix}</p>
          {state.failure.code === 'tag' && <div className="mt-3"><CopyBox text={verificationTag(state.url)} label="Verification tag" /></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            {state.failure.code === 'tag' && <button onClick={() => void addForMe()} disabled={busy} className={BTN_PRIMARY}><Sparkles size={14} /> Add it for me</button>}
            <button onClick={() => void retry()} disabled={busy} className={BTN_GHOST}><RefreshCw size={14} /> Check again</button>
          </div>
        </section>
      )}
    </div>
  )
}

function Banner({ tone, icon, title, text, action }: { tone: string; icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-white ${tone}`}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{title}</div><div className="break-words text-xs text-white/85">{text}</div></div>
      {action}
    </div>
  )
}

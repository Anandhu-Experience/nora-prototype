import { Loader2, Radar, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ENGINES, mentionPrompt, presenceNow, runPresenceCheck, sentimentOf, voceStore, whyNotMentioned, type EngineId } from '../../../presence/voce'
import { useStore } from '../../store'
import { Card } from '../PageBits'
import { Pill } from '../kit'
import { BTN_GHOST } from '../Modal'
import { useToast } from '../Toast'

export function PresencePanel() {
  const s = voceStore.use()
  const toast = useToast()
  const state = useStore()
  const me = state.agents[state.viewerId]!
  const [busy, setBusy] = useState<EngineId | null>(null)
  const [why, setWhy] = useState<EngineId | null>(null)
  const run = async (id: EngineId, name: string) => {
    setBusy(id)
    const n = await runPresenceCheck(id)
    setBusy(null)
    toast(`${name}: mentioned in ${n} of 10 test prompts (simulated)`, 'info')
  }
  return (
    <Card icon={Radar} title="AI answer presence" right={<Pill tone="purple">Simulated demo data</Pill>}>
      <p className="mb-4 text-sm text-slate-500">How often AI assistants might mention you for 10 typical home-buyer questions. These numbers are simulated from your authority score and published articles; they are not real assistant results.</p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ENGINES.map((e) => {
          const n = presenceNow(s, e.id)
          const sent = sentimentOf(n)
          return (
            <div key={e.id} className="flex flex-col rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700">{e.letter}</span>
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900">{e.name}</div><div className="text-xs text-slate-500">Mentioned in {n} of 10 test prompts</div></div>
                <Pill tone={sent.tone}>{sent.label}</Pill>
              </div>
              <p className="mt-3 flex-1 text-xs text-slate-500">{n > 0 ? <>Mentioned you for: <span className="text-slate-700">"{mentionPrompt(e.id)}"</span></> : 'No test prompt mentioned you yet.'}</p>
              {s.checks[e.id] && <p className="mt-1 text-[11px] text-slate-400">Last check {s.checks[e.id]!.at.slice(0, 16).replace('T', ' ')}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => run(e.id, e.name)} disabled={busy !== null} className={`${BTN_GHOST} !px-3 !py-1.5`}>{busy === e.id ? <Loader2 size={13} className="animate-spin" /> : <Radar size={13} />} Run check</button>
                <button onClick={() => setWhy(why === e.id ? null : e.id)} aria-expanded={why === e.id} className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:underline"><Sparkles size={13} /> Why not mentioned?</button>
              </div>
              {why === e.id && <p className="mt-2 rounded-lg bg-purple-50 p-3 text-xs leading-relaxed text-purple-900">{whyNotMentioned(s, me.specialties[0] ?? 'home loans')}</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

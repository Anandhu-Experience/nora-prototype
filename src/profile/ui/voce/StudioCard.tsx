import { Sparkles, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { BTN_PRIMARY, INPUT } from '../Modal'
import type { EditorSeed } from './EditorModal'

const CHIPS = ['What is an FHA loan?', 'First-time buyer checklist', 'How much can I borrow?']

export function StudioCard({ onOpen, prefill }: { onOpen: (s: EditorSeed) => void; prefill?: string }) {
  const [prompt, setPrompt] = useState(prefill ?? '')
  const [personalize, setPersonalize] = useState(true)
  return (
    <section className="flex flex-col rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 via-indigo-50 to-white p-5 shadow-card">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-white"><Wand2 size={20} /></span>
      <h2 className="mt-3 text-center text-lg font-bold text-indigo-700">What would you like to write about today?</h2>
      <label className="mt-4 flex min-h-0 flex-1 flex-col"><span className="sr-only">Topic to write about</span>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className={`${INPUT} flex-1 resize-none`} placeholder="Meet VOCE, your AI writing assistant: research, write, edit and publish, guided every step." />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => <button key={c} onClick={() => setPrompt(c)} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-purple-300 hover:text-purple-700">{c}</button>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" role="switch" checked={personalize} onChange={(e) => setPersonalize(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Personalize <span className="text-xs text-slate-400">(your specialties and location)</span>
        </label>
        <button onClick={() => onOpen({ topic: prompt.trim(), autoWrite: prompt.trim().length >= 4, personalize })} className={BTN_PRIMARY}><Sparkles size={15} /> Write</button>
      </div>
      <p className="mt-3 text-xs text-slate-500">You can also <button onClick={() => onOpen({})} className="font-medium text-purple-700 hover:underline">start writing without AI</button>. Nothing is published without your click.</p>
    </section>
  )
}

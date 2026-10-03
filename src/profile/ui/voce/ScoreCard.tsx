import { ChevronDown, Info } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ARTICLE_CAP, ARTICLE_POINTS, FAQ_CAP, FAQ_POINTS, answerPoints, answeredCount, articlePoints, authorityScore, publishedCount, voceStore } from '../../../presence/voce'
import { useSrs } from '../../../presence/srs'
import { useStore } from '../../store'
import { ScoreBar } from '../kit'

export function ScoreCard({ onWrite, onAnswer }: { onWrite: () => void; onAnswer: () => void }) {
  const s = voceStore.use()
  const state = useStore()
  const srs = useSrs(state.agents[state.viewerId]!)
  const [open, setOpen] = useState(false)
  const score = authorityScore(s)
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-baseline gap-2"><h2 className="text-[17px] font-semibold text-slate-900">AI Authority Score</h2></div>
      <div className="mt-3 flex items-baseline gap-1"><span className="text-5xl font-bold text-slate-900">{score}</span><span className="text-slate-400">/ 100</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label="AI Authority Score"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-[width] duration-500" style={{ width: `${Math.max(2, score)}%` }} /></div>
      <div className="mt-5 space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Components of your authority</div>
        <ScoreBar label="Articles" points={articlePoints(s)} max={ARTICLE_CAP} tone="bg-purple-500" right={<>{publishedCount(s)} published · {articlePoints(s)} / {ARTICLE_CAP} · <button onClick={onWrite} className="font-medium text-purple-700 hover:underline">Write →</button></>} />
        <ScoreBar label="Answers" points={answerPoints(s)} max={FAQ_CAP} tone="bg-blue-500" right={<>{answeredCount(s)} answered · {answerPoints(s)} / {FAQ_CAP} · <button onClick={onAnswer} className="font-medium text-blue-700 hover:underline">Answer →</button></>} />
        <ScoreBar label="Search Rank Score" points={srs.total} max={srs.max} tone="bg-emerald-500" right={<>{srs.total} / {srs.max} · <Link to="/search-rank" className="font-medium text-emerald-700 hover:underline">Improve →</Link></>} />
        <p className="text-xs text-slate-500">The Search Rank Score is shown for context: it lifts your visibility everywhere but does not change the 0 to 100 authority number.</p>
      </div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"><Info size={15} /> Learn about AI Authority Score <ChevronDown size={15} className={open ? 'rotate-180' : ''} /></button>
      {open && <p className="mt-2 text-sm leading-relaxed text-slate-600">Score = a small base for your profile + {ARTICLE_POINTS} points per published article (up to {ARTICLE_CAP}) + {FAQ_POINTS} points per answered FAQ (up to {FAQ_CAP}). Drafts and scheduled articles earn nothing until they are published, so a human always decides what goes live.</p>}
    </section>
  )
}

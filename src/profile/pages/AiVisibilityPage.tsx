import { Bot } from 'lucide-react'
import { useState } from 'react'
import { authorityScore, projectedScore, voceAnswer, voceStore, voceSuggestions, type VoceAction } from '../../presence/voce'
import { useStore } from '../store'
import { AccountCard, AnalyticsCard } from '../ui/voce/AccountCard'
import { ArticlesCard } from '../ui/voce/ArticlesCard'
import { EditorModal, type EditorSeed } from '../ui/voce/EditorModal'
import { FaqSection } from '../ui/voce/FaqSection'
import { PresencePanel } from '../ui/voce/PresencePanel'
import { ScoreCard } from '../ui/voce/ScoreCard'
import { StudioCard } from '../ui/voce/StudioCard'
import { AiInsightBar, type Suggestion } from '../ui/kit'
import { PageHeader } from '../ui/PageBits'

export default function AiVisibilityPage() {
  const state = useStore()
  const me = state.agents[state.viewerId]!
  const s = voceStore.use()
  const [editor, setEditor] = useState<EditorSeed | null>(null)
  const [faq, setFaq] = useState<{ question: string; n: number } | null>(null)
  const top = me.specialties[0] ?? 'home loans'
  const score = authorityScore(s)

  const run = (a: VoceAction) => {
    if (a.kind === 'write') setEditor({ topic: a.topic, autoWrite: true, personalize: true })
    else if (a.kind === 'edit') setEditor({ article: s.articles.find((x) => x.id === a.id) })
    else setFaq({ question: a.question, n: Date.now() })
  }
  const suggestions: Suggestion[] = voceSuggestions(s, top).map((x) => ({ id: x.id, title: x.title, detail: x.detail, cta: x.cta, impact: x.impact, onRun: () => run(x.action) }))

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader icon={Bot} title="AI Visibility" subtitle="Get found inside AI assistants with helpful articles and answers (VOCE). You approve everything before it goes live." />
      <AiInsightBar
        summary={`Your AI Authority Score is ${score}/100. Publishing 3 articles would take it to about ${projectedScore(s, 3)}.`}
        suggestions={suggestions} question="How is my AI visibility?" answer={voceAnswer()}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <StudioCard onOpen={setEditor} />
        <ScoreCard onWrite={() => setEditor({})} onAnswer={() => setFaq({ question: '', n: Date.now() })} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <AccountCard />
        <AnalyticsCard />
      </div>
      <ArticlesCard onEdit={(a) => setEditor({ article: a })} onStart={() => setEditor({})} />
      <FaqSection prefill={faq} />
      <PresencePanel />
      {editor && <EditorModal key={editor.article?.id ?? editor.topic ?? 'new'} seed={editor} onClose={() => setEditor(null)} />}
    </div>
  )
}

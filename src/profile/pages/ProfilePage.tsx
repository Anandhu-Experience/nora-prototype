import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import type { Service } from '../types'
import { EditProfileModal } from '../ui/EditProfileModal'
import { ProfileHeader, TABS, type TabId } from '../ui/ProfileHeader'
import { defaultReferral } from '../ui/ReferralModal'
import { AboutCard, AiInsightsCard, ReviewsCard, ServicesCard } from '../ui/Sections'
import { CoverModal, ReportModal, ReviewModal, ServiceModal } from '../ui/SmallModals'
import { ActivityTab, AwardsTab, ContactTab, ReviewsTab, ServicesTab } from '../ui/TabViews'
import { useReferral } from '../NoraContext'

type ModalState =
  | { kind: 'edit' } | { kind: 'cover' } | { kind: 'review' } | { kind: 'report' }
  | { kind: 'service'; service: Service }
  | null

export default function ProfilePage() {
  const { id = 'arjunan' } = useParams()
  const state = useStore()
  const agent = state.agents[id]
  if (!agent) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-lg font-semibold">Profile not found</h1>
        <p className="mt-1 text-sm text-slate-500">We couldn’t find a professional with that ID.</p>
        <Link to="/professionals" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">Browse professionals</Link>
      </div>
    )
  }
  // key remounts per agent so the assistant conversation never leaks between profiles
  return <ProfileView key={agent.id} id={agent.id} />
}

function ProfileView({ id }: { id: string }) {
  const state = useStore()
  const agent = state.agents[id]!
  const isOwner = id === state.viewerId
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState<ModalState>(null)
  const openReferral = useReferral()

  const rawTab = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : 'overview'
  const stars = Number(params.get('stars') ?? 0) || 0

  const goTab = useCallback((t: string, extra?: Record<string, string>) => {
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('tab', t)
      n.delete('stars')
      Object.entries(extra ?? {}).forEach(([k, v]) => n.set(k, v))
      if (t === 'overview') n.delete('tab')
      return n
    }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [setParams])

  // Deep link from the account menu: /profile/arjunan?edit=1
  useEffect(() => {
    if (params.get('edit') === '1' && isOwner) {
      setModal({ kind: 'edit' })
      setParams((p) => { const n = new URLSearchParams(p); n.delete('edit'); return n }, { replace: true })
    }
  }, [params, isOwner, setParams])

  const close = useCallback(() => { setModal(null); return true }, [])
  const referral = (text?: string) => openReferral(agent.id, text)
  const openService = (service: Service) => setModal({ kind: 'service', service })

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="min-w-0 space-y-5">
        <ProfileHeader
          agent={agent} isOwner={isOwner} tab={tab} onTab={(t) => goTab(t)}
          onEdit={() => setModal({ kind: 'edit' })} onReferral={() => referral()}
          onCover={() => setModal({ kind: 'cover' })} onReport={() => setModal({ kind: 'report' })}
        />

        {tab === 'overview' && (
          <>
            <div className="grid gap-5 xl:grid-cols-2">
              <AboutCard agent={agent} isOwner={isOwner} />
              <ServicesCard agent={agent} onViewAll={() => goTab('services')} onOpen={openService} />
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
              <ReviewsCard agent={agent} onViewAll={() => goTab('reviews')} onStars={(n) => goTab('reviews', { stars: String(n) })} />
              <AiInsightsCard agent={agent} />
            </div>
          </>
        )}
        {tab === 'reviews' && (
          <ReviewsTab agent={agent} isOwner={isOwner} stars={stars} onWrite={() => setModal({ kind: 'review' })}
            onStars={(n) => setParams((p) => { const x = new URLSearchParams(p); n ? x.set('stars', String(n)) : x.delete('stars'); return x }, { replace: true })} />
        )}
        {tab === 'about' && <AboutCard agent={agent} isOwner={isOwner} full />}
        {tab === 'services' && <ServicesTab agent={agent} onOpen={openService} onRequest={(s) => referral(`${defaultReferral(agent).split('\n')[0]}\n\nI would like to enquire about your "${s.name}" service for a client. Could you please get in touch?\n\nThanks!`)} />}
        {tab === 'awards' && <AwardsTab agent={agent} />}
        {tab === 'activity' && <ActivityTab agent={agent} />}
        {tab === 'contact' && <ContactTab agent={agent} isOwner={isOwner} />}
      </div>


      {modal?.kind === 'edit' && <EditProfileModal agent={agent} onClose={() => void close()} />}
      {modal?.kind === 'cover' && <CoverModal agent={agent} onClose={() => void close()} />}
      {modal?.kind === 'review' && <ReviewModal agent={agent} onClose={() => void close()} />}
      {modal?.kind === 'report' && <ReportModal agent={agent} onClose={() => void close()} />}
      {modal?.kind === 'service' && (
        <ServiceModal service={modal.service} onClose={() => void close()}
          onRequest={() => close() && referral(`${defaultReferral(agent).split('\n')[0]}\n\nI would like to enquire about your "${modal.service.name}" service for a client. Could you please get in touch?\n\nThanks!`)} />
      )}
    </div>
  )
}


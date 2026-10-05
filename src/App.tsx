import { lazy, Suspense } from 'react'
import { SHOW_EXPERTISE_GRAPH } from './profile/features'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './profile/auth'
import { SiteLayout } from './profile/ui/SiteLayout'

const LoginPage = lazy(() => import('./profile/pages/LoginPage'))
const OverviewPage = lazy(() => import('./profile/pages/OverviewPage'))
const ProfilePage = lazy(() => import('./profile/pages/ProfilePage'))
const DirectoryPage = lazy(() => import('./profile/pages/DirectoryPage'))
const LocationsPage = lazy(() => import('./profile/pages/LocationsPage'))
const MessagesPage = lazy(() => import('./profile/pages/MessagesPage'))
const InsightsPage = lazy(() => import('./profile/pages/InsightsPage'))
const RankPage = lazy(() => import('./profile/pages/RankPage'))
const ListingsPage = lazy(() => import('./profile/pages/ListingsPage'))
const ConnectionsPage = lazy(() => import('./profile/pages/ConnectionsPage'))
const WebAnalyticsPage = lazy(() => import('./profile/pages/WebAnalyticsPage'))
const GraphPage = lazy(() => import('./profile/pages/GraphPage'))
const SrsGuidePage = lazy(() => import('./profile/pages/SrsGuidePage'))
const SearchRankPage = lazy(() => import('./profile/pages/SearchRankPage'))
const AiVisibilityPage = lazy(() => import('./profile/pages/AiVisibilityPage'))
const NetworkPage = lazy(() => import('./profile/pages/NetworkPage'))
const NotificationsPage = lazy(() => import('./profile/pages/NotificationsPage'))

/** Everything except /login needs a session. */
function RequireAuth() {
  return useAuth() ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Navigate to="/profile" replace />} />
            <Route path="/profile" element={<OverviewPage />} />
            <Route path="/profile/:id" element={<ProfilePage />} />
            <Route path="/rank/:id" element={<RankPage />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/analytics" element={<WebAnalyticsPage />} />
            <Route path="/search-rank" element={<SearchRankPage />} />
            <Route path="/graph" element={SHOW_EXPERTISE_GRAPH ? <GraphPage /> : <Navigate to="/profile" replace />} />
            <Route path="/search-rank/how-it-works" element={<SrsGuidePage />} />
            <Route path="/ai-visibility" element={<AiVisibilityPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/professionals" element={<DirectoryPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

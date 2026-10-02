import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './profile/auth'
import { SiteLayout } from './profile/ui/SiteLayout'

const LoginPage = lazy(() => import('./profile/pages/LoginPage'))
const ProfilePage = lazy(() => import('./profile/pages/ProfilePage'))
const DirectoryPage = lazy(() => import('./profile/pages/DirectoryPage'))
const LocationsPage = lazy(() => import('./profile/pages/LocationsPage'))
const MessagesPage = lazy(() => import('./profile/pages/MessagesPage'))
const InsightsPage = lazy(() => import('./profile/pages/InsightsPage'))

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
            <Route path="/profile" element={<Navigate to="/profile/arjunan" replace />} />
            <Route path="/profile/:id" element={<ProfilePage />} />
            <Route path="/professionals" element={<DirectoryPage />} />
            <Route path="/locations" element={<LocationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

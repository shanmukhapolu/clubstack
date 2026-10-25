import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ClubsProvider } from './context/ClubsContext'
import { ToastProvider } from './context/ToastContext'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { ClubMembersPage } from './pages/ClubMembersPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { ClubPage } from './pages/ClubPage'
import { CalendarPage } from './pages/CalendarPage'
import { RoleWorkspacePage } from './pages/RoleWorkspacePage'
import { AdminPage } from './pages/AdminPage'
import { ClubSettingsPage } from './pages/ClubSettingsPage'
import { ClubMeetingsPage } from './pages/ClubMeetingsPage'
import { CreateClubPage } from './pages/CreateClubPage'
import { NotFoundPage } from './pages/NotFoundPage'

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
      <div className="flex h-12 w-12 flex-col justify-center gap-1 rounded-2xl bg-ink px-3">
        <span className="h-1 w-6 rounded-full bg-lime" />
        <span className="h-1 w-4 rounded-full bg-brand-300" />
        <span className="h-1 w-5 rounded-full bg-white/90" />
      </div>
      <p className="text-sm font-medium text-muted">Loading ClubStack…</p>
    </div>
  )
}

function RoleHome() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'teacher') return <Navigate to="/teacher" replace />
  return <DashboardPage />
}

function EntryRoute() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'teacher' ? '/teacher' : '/home'} replace />
  return <HomePage />
}

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

function RequireStudent() {
  const { user } = useAuth()
  if (user?.role === 'teacher') return <Navigate to="/teacher" replace />
  return <Outlet />
}

function RequireStudentCreator() {
  const { user } = useAuth()
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'teacher') return <Navigate to="/teacher" replace />
  return <Outlet />
}

function RequireTeacher() {
  const { user } = useAuth()
  if (user?.role !== 'teacher' && user?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClubsProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<EntryRoute />} />
              <Route path="/login" element={<LoginPage />} />

              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="home" element={<RoleHome />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="invitations" element={<Navigate to="/notifications" replace />} />
                  <Route element={<RequireStudent />}>
                    <Route path="discover" element={<DiscoverPage />} />
                    <Route element={<RequireStudentCreator />}><Route path="clubs/new" element={<CreateClubPage />} /></Route>
                    <Route path="calendar" element={<CalendarPage />} />
                  </Route>
                  <Route path="clubs/:clubId/members" element={<ClubMembersPage />} />
                  <Route path="clubs/:clubId/meetings" element={<ClubMeetingsPage />} />
                  <Route path="clubs/:clubId/settings" element={<ClubSettingsPage />} />
                  <Route path="clubs/:clubId" element={<ClubPage />} />
                  <Route element={<RequireTeacher />}>
                    <Route path="teacher" element={<RoleWorkspacePage />} />
                    <Route path="teacher/calendar" element={<RoleWorkspacePage />} />
                    <Route path="teacher/clubs" element={<RoleWorkspacePage />} />
                    <Route path="teacher/reports" element={<RoleWorkspacePage />} />
                  </Route>
                  <Route element={<RequireAdmin />}>
                    <Route path="admin" element={<RoleWorkspacePage />} />
                    <Route path="admin/users" element={<AdminPage />} />
                    <Route path="admin/clubs" element={<AdminPage />} />
                    <Route path="admin/calendar" element={<RoleWorkspacePage />} />
                    <Route path="admin/security" element={<RoleWorkspacePage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ToastProvider>
        </ClubsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

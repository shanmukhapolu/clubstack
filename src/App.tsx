import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ClubsProvider } from './context/ClubsContext'
import { ToastProvider } from './context/ToastContext'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { ClubPage } from './pages/ClubPage'
import { CalendarPage } from './pages/CalendarPage'
import { AdminPage } from './pages/AdminPage'
import { TeacherPage } from './pages/TeacherPage'
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
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'teacher') return <Navigate to="/teacher" replace />
  return <Outlet />
}

function RequireTeacher() {
  const { user } = useAuth()
  if (user?.role !== 'teacher') return <Navigate to="/" replace />
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
              <Route path="/login" element={<LoginPage />} />

              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route index element={<RoleHome />} />
                  <Route element={<RequireStudent />}>
                    <Route path="discover" element={<DiscoverPage />} />
                    <Route path="clubs/new" element={<CreateClubPage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                  </Route>
                  <Route path="clubs/:clubId" element={<ClubPage />} />
                  <Route element={<RequireTeacher />}>
                    <Route path="teacher" element={<TeacherPage />} />
                  </Route>
                  <Route element={<RequireAdmin />}>
                    <Route path="admin" element={<AdminPage />} />
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

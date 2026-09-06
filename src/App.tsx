import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppLayout } from '@/layouts/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'

import Login from '@/pages/Login'
import ManagerDashboard from '@/pages/ManagerDashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import CalendarPage from '@/pages/CalendarPage'
import ReportsPage from '@/pages/ReportsPage'
import ResourcesPage from '@/pages/ResourcesPage'
import ProfilePage from '@/pages/ProfilePage'
import ManagersPage from '@/pages/admin/ManagersPage'
import ClubsPage from '@/pages/admin/ClubsPage'
import AdminReportsPage from '@/pages/admin/AdminReportsPage'
import NotFound from '@/pages/NotFound'
import { FullScreenLoader } from '@/components/ui/FullScreenLoader'
import EventRequestPage from '@/pages/EventRequestPage'
import EventRequestsAdminPage from '@/pages/admin/EventRequestsAdminPage'

function DashboardRouter() {
  const { profile, loading } = useAuth()
  if (loading || !profile) return <FullScreenLoader />
  return profile.role === 'admin' ? <AdminDashboard /> : <ManagerDashboard />
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { borderRadius: '12px', fontSize: '14px', fontWeight: 500 },
          success: { iconTheme: { primary: '#3a56e8', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/event-request" element={<EventRequestPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/admin/managers" element={<ManagersPage />} />
              <Route path="/admin/clubs" element={<ClubsPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/event-requests" element={<EventRequestsAdminPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}

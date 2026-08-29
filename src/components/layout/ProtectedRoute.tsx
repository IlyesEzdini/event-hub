import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { FullScreenLoader } from '@/components/ui/FullScreenLoader'

export function ProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <FullScreenLoader label="Setting up your account…" />
  if (adminOnly && profile.role !== 'admin') return <Navigate to="/dashboard" replace />

  return <Outlet />
}

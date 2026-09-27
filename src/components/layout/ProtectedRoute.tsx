import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { FullScreenLoader } from '@/components/ui/FullScreenLoader'
import type { Role } from '@/types/database'

export function ProtectedRoute({
  adminOnly = false,
  allowedRoles,
}: {
  adminOnly?: boolean
  allowedRoles?: Role[]
}) {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <FullScreenLoader label="Setting up your account…" />
  if (adminOnly && profile.role !== 'admin') return <Navigate to="/dashboard" replace />
  if (allowedRoles && !allowedRoles.includes(profile.role)) return <Navigate to="/dashboard" replace />

  return <Outlet />
}

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { usernameToEmail } from '@/utils/auth'
import { getCoordinatorByEmail } from '@/services/coordinators'
import type { CurrentUser } from '@/types/database'

interface AuthContextValue {
  session: Session | null
  profile: CurrentUser | null
  loading: boolean
  error: string | null
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchAccount(authUserId: string, authEmail: string | null): Promise<CurrentUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, club:clubs(*)')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load profile', error)
    return null
  }

  if (data) return data as CurrentUser

  if (!authEmail) return null

  try {
    const coordinator = await getCoordinatorByEmail(authEmail)
    if (!coordinator) return null

    return {
      id: null,
      auth_user_id: authUserId,
      manager_name: coordinator.username,
      username: coordinator.username,
      email: coordinator.email,
      phone_number: null,
      club_id: null,
      dean_id: null,
      assists_manager_id: null,
      responsible_clubs: [],
      clubs: [],
      field: coordinator.field,
      role: 'coordinator',
      is_active: true,
      created_at: null,
      updated_at: null,
      club: null,
      dean: null,
    }
  } catch (coordinatorError) {
    console.error('Failed to load coordinator account', coordinatorError)
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfileForSession = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      return
    }
    const p = await fetchAccount(s.user.id, s.user.email ?? null)
    setProfile(p)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadProfileForSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      await loadProfileForSession(newSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfileForSession])

  const signIn = useCallback(async (identifier: string, password: string) => {
    setError(null)
    if (!identifier.trim() || !password) {
      const msg = 'Please enter your username/email and password.'
      setError(msg)
      return { error: msg }
    }

    // Managers/admins/deans use username@members.eventhub.internal.
    // Coordinators can sign in with the email stored in public.coordinators.
    const email = identifier.includes('@')
      ? identifier.trim().toLowerCase()
      : usernameToEmail(identifier)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      const msg = 'Invalid username/email or password.'
      setError(msg)
      return { error: msg }
    }

    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session) {
      const p = await fetchAccount(session.user.id, session.user.email ?? null)
      setProfile(p)
    }
  }, [session])

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, error, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

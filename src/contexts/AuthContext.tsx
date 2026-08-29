import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { usernameToEmail } from '@/utils/auth'
import type { ProfileWithClub } from '@/types/database'

interface AuthContextValue {
  session: Session | null
  profile: ProfileWithClub | null
  loading: boolean
  error: string | null
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(authUserId: string): Promise<ProfileWithClub | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, club:clubs(*)')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) {
    console.error('Failed to load profile', error)
    return null
  }
  return data as ProfileWithClub | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileWithClub | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfileForSession = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null)
      return
    }
    const p = await fetchProfile(s.user.id)
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

  const signIn = useCallback(async (username: string, password: string) => {
    setError(null)
    if (!username.trim() || !password) {
      const msg = 'Please enter your username and password.'
      setError(msg)
      return { error: msg }
    }
    const email = usernameToEmail(username)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      const msg = 'Invalid username or password.'
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
      const p = await fetchProfile(session.user.id)
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

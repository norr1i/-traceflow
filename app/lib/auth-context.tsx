'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Role } from './roles'

interface AuthCtx {
  session: Session | null
  user:    User | null
  role:    Role | null
  loading: boolean
}

const AuthContext = createContext<AuthCtx>({ session: null, user: null, role: null, loading: true })

async function fetchRole(userId: string): Promise<Role> {
  const { data } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.role as Role | undefined) ?? 'manager'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role,    setRole]    = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fast path: hydrate from the persisted session cache
    supabase.auth.getSession().then(async ({ data }) => {
      const sess = data.session
      setSession(sess)
      if (sess) setRole(await fetchRole(sess.user.id))
      setLoading(false)
    })

    // Keep session in sync (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      setSession(sess)
      if (sess) {
        setRole(await fetchRole(sess.user.id))
      } else {
        setRole(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthCtx {
  return useContext(AuthContext)
}

/** Convenience hook — returns the current user's role (null while loading). */
export function useRole(): Role | null {
  return useContext(AuthContext).role
}

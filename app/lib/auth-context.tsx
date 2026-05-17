'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Role } from './roles'

interface AuthCtx {
  session: Session | null
  user:    User | null
  role:    Role | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  session: null, user: null, role: null, loading: true,
  signOut: async () => {},
})

/**
 * Fetch the role for the given user ID from user_profiles.
 *
 * Rules:
 *  - Only reads the row where user_id = userId (exact match)
 *  - Never overwrites an existing row's role
 *  - If no row exists, inserts a NEW row with default 'inspector'
 *    (ignoreDuplicates: true guarantees we skip the update on conflict)
 *  - If INSERT conflicted (row exists but SELECT returned nothing — RLS edge case),
 *    re-fetches the existing row
 *  - Final fallback is 'inspector', never 'manager'
 */
async function loadRole(userId: string): Promise<Role> {
  console.log('[auth] loadRole → querying user_id:', userId)

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  console.log('[auth] loadRole → query result:', { data, error })

  if (data?.role) {
    console.log('[auth] loadRole → matched row:', data, '→ resolved role:', data.role)
    return data.role as Role
  }

  // No row returned — attempt to insert a default profile.
  // ignoreDuplicates: true → ON CONFLICT DO NOTHING, never overwrites existing role.
  console.log('[auth] loadRole → no row found for', userId, '— inserting default inspector profile')

  const { data: inserted, error: insertError } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, role: 'inspector' },
      { onConflict: 'user_id', ignoreDuplicates: true },
    )
    .select('user_id, role')
    .maybeSingle()

  console.log('[auth] loadRole → insert result:', { inserted, insertError })

  if (inserted?.role) {
    console.log('[auth] loadRole → resolved role (from insert):', inserted.role)
    return inserted.role as Role
  }

  // ignoreDuplicates means the upsert returns nothing when the conflict fires.
  // The row already exists — re-fetch it (handles RLS-hidden rows on first attempt).
  console.log('[auth] loadRole → insert was a no-op (row exists) — re-fetching')

  const { data: refetched, error: refetchError } = await supabase
    .from('user_profiles')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  console.log('[auth] loadRole → re-fetch result:', { refetched, refetchError })

  const resolvedRole = (refetched?.role as Role | undefined) ?? 'inspector'
  console.log('[auth] loadRole → final resolved role:', resolvedRole)
  return resolvedRole
}

/** Clear all Supabase auth tokens from localStorage synchronously. */
function clearLocalAuthState() {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('sb-'))
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role,    setRole]    = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  // Tracks the user we are currently fetching a role for.
  // Prevents a stale async loadRole() response from a previous user
  // from overwriting the role of the current user.
  const activeUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Fallback: if onAuthStateChange never fires INITIAL_SESSION
    // (e.g. corrupt/missing localStorage token), stop the spinner after 6s.
    const fallbackTimer = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.log('[auth] fallback timer fired — clearing stale loading state')
          activeUserIdRef.current = null
          setSession(null)
          setRole(null)
          clearLocalAuthState()
        }
        return false
      })
    }, 6000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        console.log('[auth] onAuthStateChange →', event, 'user:', sess?.user?.id ?? 'none')
        clearTimeout(fallbackTimer)
        setSession(sess)

        if (!sess?.user) {
          activeUserIdRef.current = null
          setRole(null)
          setLoading(false)
          return
        }

        const userId = sess.user.id

        // If this is a token refresh for the same user and we already have a role,
        // skip re-fetching to avoid a flicker (role briefly becomes null).
        if (activeUserIdRef.current === userId && role !== null) {
          console.log('[auth] same user token refresh — skipping role re-fetch, current role:', role)
          setLoading(false)
          return
        }

        // New user (or role not yet loaded) — reset and re-fetch.
        activeUserIdRef.current = userId
        setRole(null)

        const freshRole = await loadRole(userId)

        // Guard: discard result if user changed during the async fetch.
        if (activeUserIdRef.current === userId) {
          console.log('[auth] setting role →', freshRole, 'for user:', userId)
          setRole(freshRole)
          setLoading(false)
        }
      }
    )

    return () => {
      clearTimeout(fallbackTimer)
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    console.log('[auth] signOut called')
    activeUserIdRef.current = null
    setSession(null)
    setRole(null)
    setLoading(false)
    clearLocalAuthState()
    try { await supabase.auth.signOut() } catch {}
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role, loading, signOut }}>
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

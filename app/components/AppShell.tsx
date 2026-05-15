'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/auth-context'
import Sidebar from './Sidebar'

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white text-lg font-bold shadow-lg">
          TF
        </div>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-blue-600" />
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // /login and /signup redirect logged-in users away
  const isAuthOnlyPage = pathname === '/login' || pathname === '/signup'
  // /trace/* is publicly accessible — no auth required, no redirect either way
  const isTracePage = pathname.startsWith('/trace/')
  const isPublic = isAuthOnlyPage || isTracePage

  useEffect(() => {
    if (loading) return

    // Redirect authenticated users away from auth pages
    if (isAuthOnlyPage && session) {
      router.replace('/')
      return
    }

    // Redirect unauthenticated users away from protected pages
    if (!isPublic && !session) {
      router.replace('/login')
    }
  }, [session, loading, isAuthOnlyPage, isPublic, router])

  // Public pages: render immediately, no sidebar
  if (isPublic) {
    return <>{children}</>
  }

  // Protected pages: wait for auth check to finish
  if (loading) return <LoadingScreen />

  // Not authenticated: show nothing while redirect is in flight
  if (!session) return <LoadingScreen />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/auth-context'
import { canVisit, homeFor } from '../lib/roles'
import Sidebar from './Sidebar'
import { LogoIcon } from './Logo'

function LoadingScreen() {
  return (
    <div
      className="flex h-screen items-center justify-center bg-[#090F15]"
      style={{
        background:
          'radial-gradient(ellipse 1600px 1000px at 20% 10%, rgba(74,127,165,0.05) 0%, transparent 65%), #090F15',
      }}
    >
      <div className="flex flex-col items-center gap-6">
        <LogoIcon size="lg" />
        {/* Brand-matched spinner: muted track + accent sweep */}
        <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-[#262E36] border-t-[#4a8fb9]" />
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading, role } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isAuthOnlyPage = pathname === '/login' || pathname === '/signup'
  const isTracePage = pathname.startsWith('/trace/')
  const isVerifyPage = pathname === '/verify-email'
  const isPublic = isAuthOnlyPage || isTracePage || isVerifyPage

  useEffect(() => {
    if (loading) return

    if (isAuthOnlyPage && session) {
      router.replace(role ? homeFor(role) : '/')
      return
    }

    if (!isPublic && !session) {
      router.replace('/login')
      return
    }

    if (!isPublic && session && role && !canVisit(role, pathname)) {
      router.replace(homeFor(role))
    }
  }, [session, loading, role, isAuthOnlyPage, isPublic, pathname, router])

  if (isPublic) {
    return <>{children}</>
  }

  if (loading) return <LoadingScreen />
  if (!session) return <LoadingScreen />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { AuthProvider } from '../lib/auth-context'
import { ToastProvider } from './Toast'
import { ConfirmProvider } from './ConfirmDialog'

function ThemeSync() {
  useEffect(() => {
    const stored = localStorage.getItem('tf-theme')
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const theme = stored ?? preferred
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [])
  return null
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <ThemeSync />
          {children}
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

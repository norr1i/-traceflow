'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: string; message: string; type: ToastType }
interface ToastAPI {
  success(msg: string): void
  error(msg: string): void
  info(msg: string): void
}

const Ctx = createContext<ToastAPI | null>(null)

const icons = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
}
const colours = {
  success: 'bg-emerald-600',
  error:   'bg-red-600',
  info:    'bg-gray-800 dark:bg-gray-700',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`
    setItems((prev) => [...prev, { id, message, type }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const dismiss = (id: string) => setItems((prev) => prev.filter((t) => t.id !== id))

  const api: ToastAPI = {
    success: (m) => push(m, 'success'),
    error:   (m) => push(m, 'error'),
    info:    (m) => push(m, 'info'),
  }

  return (
    <Ctx.Provider value={api}>
      {children}

      {/* Toast stack — bottom-right */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {items.map((item) => {
          const Icon = icons[item.type]
          return (
            <div
              key={item.id}
              className={`
                pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3
                text-sm font-medium text-white shadow-xl max-w-sm
                ${colours[item.type]} toast-slide-in
              `}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{item.message}</span>
              <button
                onClick={() => dismiss(item.id)}
                className="ml-1 rounded p-0.5 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastAPI {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOpts {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>

const Ctx = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOpts
    resolve: (v: boolean) => void
  } | null>(null)

  const confirm = useCallback((opts: ConfirmOpts) =>
    new Promise<boolean>((resolve) => setState({ opts, resolve }))
  , [])

  function handle(yes: boolean) {
    state?.resolve(yes)
    setState(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}

      {state && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {state.opts.title ?? 'Confirm action'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {state.opts.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => handle(false)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handle(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  state.opts.danger !== false
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {state.opts.confirmLabel ?? 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}

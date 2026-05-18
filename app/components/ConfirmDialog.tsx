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
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="
            w-full max-w-sm rounded-2xl p-6
            border border-[#B3B7BA]/[0.10]
            bg-[#141e28] backdrop-blur-xl
            shadow-[0_24px_60px_rgba(0,0,0,0.55)]
          ">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8a3535]/15 border border-[#8a3535]/25">
                <AlertTriangle size={18} className="text-[#c47070]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#D3D1CE]">
                  {state.opts.title ?? 'Confirm action'}
                </h3>
                <p className="mt-1 text-sm text-[#6C6D74]">
                  {state.opts.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => handle(false)}
                className="rounded-xl border border-[#B3B7BA]/[0.12] bg-[#262E36]/40 px-4 py-2 text-sm font-medium text-[#B3B7BA] hover:bg-[#262E36]/60 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handle(true)}
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${
                  state.opts.danger !== false
                    ? 'bg-[#8a3535] hover:bg-[#a04040] shadow-[0_0_16px_rgba(138,53,53,0.28)]'
                    : 'bg-[#3a6f8f] hover:bg-[#2d5a74] shadow-[0_0_16px_rgba(74,127,165,0.22)]'
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

'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { Mail, AlertCircle, CheckCircle2, Loader2, Clock } from 'lucide-react'
import { LogoIcon } from '../components/Logo'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email   = searchParams.get('email') ?? ''
  const company = searchParams.get('company') ?? ''

  const [resending, setResending]       = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [resendError, setResendError]   = useState<string | null>(null)
  const [cooldown, setCooldown]         = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleResend() {
    if (resending || cooldown > 0 || !email) return
    setResending(true)
    setResendStatus('idle')
    setResendError(null)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
      },
    })

    setResending(false)

    if (error) {
      const msg = error.message.includes('rate limit') || error.message.includes('over_email_send_rate_limit')
        ? 'Too many requests. Please wait a few minutes before resending.'
        : error.message
      setResendError(msg)
      setResendStatus('error')
      return
    }

    setResendStatus('sent')
    setCooldown(60)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden bg-[#090F15]">
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(ellipse 1600px 1000px at 20% 10%, rgba(74,127,165,0.05) 0%, transparent 65%)',
      }} />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LogoIcon size="lg" />
        </div>

        <div className="rounded-2xl border border-[#B3B7BA]/[0.09] bg-gradient-to-b from-[#262E36]/85 to-[#1a2230]/80 backdrop-blur-xl p-8 shadow-[0_24px_60px_rgba(0,0,0,0.50)] text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#3a6f8f]/25 bg-[#3a6f8f]/12">
              <Mail size={26} className="text-[#4a8fb9]" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-[#D3D1CE]">Check your email</h1>
          <p className="mt-2 text-sm text-[#6C6D74]">
            We sent a confirmation link to{' '}
            {email
              ? <span className="font-medium text-[#B3B7BA]">{email}</span>
              : 'your email address'
            }.
            {' '}Click it to activate your account{company ? ` and join ${company}` : ''}.
          </p>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#B3B7BA]/[0.08] bg-[#262E36]/40 px-3.5 py-3 text-left">
            <Clock size={13} className="mt-0.5 shrink-0 text-[#6C6D74]" />
            <p className="text-xs text-[#6C6D74] leading-relaxed">
              Emails can take a few minutes to arrive. If nothing shows up, check your spam or junk folder.
              On Supabase&apos;s free plan, delivery is rate-limited — configure a custom SMTP provider
              (e.g. Resend or SendGrid) in the Supabase dashboard for reliable delivery.
            </p>
          </div>

          {resendStatus === 'sent' && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#2d7a5a]/30 bg-[#2d7a5a]/12 px-4 py-3 text-sm text-[#6abf9a]">
              <CheckCircle2 size={15} className="shrink-0" />
              Confirmation email resent successfully.
            </div>
          )}
          {resendStatus === 'error' && resendError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#8a3535]/30 bg-[#8a3535]/10 px-4 py-3 text-sm text-[#c47070] text-left">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {resendError}
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0 || !email}
            className="
              mt-5 flex w-full items-center justify-center gap-2
              rounded-xl border border-[#B3B7BA]/[0.12] bg-[#262E36]/40
              px-4 py-2.5 text-sm font-medium text-[#B3B7BA]
              hover:bg-[#262E36]/60 hover:text-[#D3D1CE]
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors
            "
          >
            {resending && <Loader2 size={14} className="animate-spin" />}
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : resending
                ? 'Sending…'
                : 'Resend confirmation email'}
          </button>

          <div className="mt-3 border-t border-[#B3B7BA]/[0.08] pt-4">
            <p className="text-xs text-[#6C6D74]">Already confirmed your email?</p>
            <Link
              href={email ? `/login?email=${encodeURIComponent(email)}` : '/login'}
              className="mt-1.5 flex w-full items-center justify-center rounded-xl border border-[#4a7fa5]/25 bg-[#3a6f8f]/10 px-4 py-2.5 text-sm font-semibold text-[#4a8fb9] hover:bg-[#3a6f8f]/20 hover:text-[#6aafd9] transition-colors"
            >
              Sign in to your account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}

import { createClient } from '@supabase/supabase-js'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!rawUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  )
}

// The SDK builds the auth URL as: new URL("auth/v1", validateSupabaseUrl(supabaseUrl))
// validateSupabaseUrl() adds a trailing slash, so the base must be exactly
// "https://host/" — any extra path segment causes the auth URL to resolve wrong.
// e.g. "https://host/rest/v1/" → new URL("auth/v1", ...) → "https://host/rest/auth/v1" ❌
// Strip everything after the host so the SDK always produces "https://host/auth/v1".
let supabaseUrl: string
try {
  const u = new URL(rawUrl)
  supabaseUrl = `${u.protocol}//${u.host}`
} catch {
  supabaseUrl = rawUrl.replace(/\/+$/, '')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

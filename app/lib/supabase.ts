import { createClient } from '@supabase/supabase-js'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!rawUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  )
}

// Strip any accidental trailing slash or extra path (e.g. /rest/v1).
// createClient needs exactly "https://xxx.supabase.co" — any extra path
// causes gotrue to build a broken auth URL and throw "Invalid path in request URL".
const supabaseUrl = (() => {
  try {
    const u = new URL(rawUrl)
    return `${u.protocol}//${u.host}`
  } catch {
    return rawUrl.replace(/\/+$/, '')
  }
})()

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

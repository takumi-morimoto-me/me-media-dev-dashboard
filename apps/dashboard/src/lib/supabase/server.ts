import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service Role Keyを使用してRLSをバイパスするクライアント
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not defined. Please set it in your environment variables.'
    )
  }

  if (!supabaseKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not defined. Please set it in your environment variables (Vercel Project Settings > Environment Variables).'
    )
  }

  return createSupabaseClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
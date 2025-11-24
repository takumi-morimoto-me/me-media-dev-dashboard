import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service Role Keyを使用してRLSをバイパスするクライアント
export async function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
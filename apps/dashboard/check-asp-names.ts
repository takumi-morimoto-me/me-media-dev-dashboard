import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🔍 全ASP名を確認中...\n');

  const { data: asps, error } = await supabase
    .from('asps')
    .select('id, name, prompt, login_url')
    .order('name');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log(`📦 ${asps?.length || 0}個のASPが見つかりました:\n`);

  for (const asp of asps || []) {
    const hasPrompt = asp.prompt ? '✅ あり' : '❌ なし';
    console.log(`  ${asp.name} - プロンプト: ${hasPrompt}`);
  }
}

main();

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ASPテーブルの全データ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: asps, error } = await supabase
    .from('asps')
    .select('*')
    .order('name');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!asps || asps.length === 0) {
    console.log('⚠️  ASPデータがありません');
    return;
  }

  console.log(`総ASP数: ${asps.length}個\n`);
  asps.forEach(asp => {
    console.log(`📦 ${asp.name}`);
    console.log(`   ID: ${asp.id}`);
    console.log(`   表示名: ${asp.display_name || 'なし'}`);
    console.log('');
  });
}

main();

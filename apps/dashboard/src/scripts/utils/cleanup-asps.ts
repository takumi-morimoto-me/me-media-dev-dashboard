import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// スクレイパーが実装されているASPのみを残す
const KEEP_ASPS = [
  'A8net',
  'もしもアフィリエイト',
  'Link-AG',
  'felmat'
];

async function cleanupAsps() {
  console.log('🧹 不要なASPを削除しています...\n');

  // 全ASPを取得
  const { data: asps, error: aspsError } = await supabase
    .from('asps')
    .select('id, name')
    .order('name');

  if (aspsError || !asps) {
    console.error('❌ ASPの取得に失敗しました:', aspsError);
    return;
  }

  console.log(`📊 現在登録されているASP: ${asps.length}件\n`);

  // 削除対象のASPを特定
  const aspsToDelete = asps.filter(asp => !KEEP_ASPS.includes(asp.name));
  const aspsToKeep = asps.filter(asp => KEEP_ASPS.includes(asp.name));

  console.log('✅ 残すASP:');
  aspsToKeep.forEach(asp => console.log(`  - ${asp.name}`));

  console.log('\n🗑️  削除するASP:');
  aspsToDelete.forEach(asp => console.log(`  - ${asp.name}`));

  if (aspsToDelete.length === 0) {
    console.log('\n削除するASPはありません。');
    return;
  }

  console.log(`\n${aspsToDelete.length}件のASPを削除します...`);

  // 削除実行
  const { error: deleteError } = await supabase
    .from('asps')
    .delete()
    .in('id', aspsToDelete.map(asp => asp.id));

  if (deleteError) {
    console.error('❌ 削除に失敗しました:', deleteError);
    return;
  }

  console.log('\n✅ 削除が完了しました！');
  console.log(`\n📊 残りのASP: ${aspsToKeep.length}件`);
}

cleanupAsps().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteDuplicates() {
  console.log('🗑️  重複データを削除中...\n');

  const afbAspId = '09683e1e-769e-43ad-bfc6-fcc9c4aff354';

  // actualsテーブルから月初（-01日）のレコードを削除
  console.log('📊 actualsテーブルから月初（-01日）のレコードを削除:');

  // 全データ取得
  const { data: allData, error: fetchError } = await supabase
    .from('actuals')
    .select('id, date, amount')
    .eq('asp_id', afbAspId)
    .gte('date', '2025-01-01')
    .lte('date', '2025-12-31');

  if (fetchError) {
    console.error('Error fetching:', fetchError);
    return;
  }

  // 月初（-01日）のレコードをフィルタ
  const toDelete = allData?.filter(d => {
    const dateStr = d.date as string;
    return dateStr.endsWith('-01');
  });

  console.log(`削除対象: ${toDelete?.length}件`);
  toDelete?.forEach(d => {
    console.log(`  ${d.date}: ¥${d.amount.toLocaleString()}`);
  });

  // 削除実行
  if (toDelete && toDelete.length > 0) {
    const idsToDelete = toDelete.map(d => d.id);
    const { error: deleteError } = await supabase
      .from('actuals')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('Error deleting:', deleteError);
    } else {
      console.log('\n✅ 削除完了！');
    }
  }

  // 削除後の確認
  console.log('\n📊 削除後のactualsテーブル (afb):');
  const { data: afterDelete, error: afterError } = await supabase
    .from('actuals')
    .select('date, amount')
    .eq('asp_id', afbAspId)
    .gte('date', '2025-01-01')
    .lte('date', '2025-12-31')
    .order('date', { ascending: true });

  if (afterError) {
    console.error('Error:', afterError);
  } else if (afterDelete) {
    console.log(`残りレコード数: ${afterDelete.length}`);
    afterDelete.forEach(d => {
      console.log(`  ${d.date}: ¥${d.amount.toLocaleString()}`);
    });
  }
}

deleteDuplicates();

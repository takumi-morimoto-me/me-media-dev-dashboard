import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkActuals() {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 actualsテーブルのデータを確認中...\n');

  const { data, error } = await supabase
    .from('actuals')
    .select('*')
    .eq('media_id', '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12')
    .order('date', { ascending: false });

  if (error) {
    console.error('❌ エラー:', error);
  } else {
    console.log('📊 actualsテーブル（月別データ）:\n');
    data?.forEach(row => {
      console.log(`${row.date} | ${row.amount.toLocaleString()}円`);
    });
    console.log(`\n✅ 合計 ${data?.length}件`);
  }
}

checkActuals().catch(console.error);

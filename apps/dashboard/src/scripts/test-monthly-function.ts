import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testMonthlyFunction() {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 get_financial_monthly_data関数をテスト中...\n');

  const { data, error } = await supabase.rpc('get_financial_monthly_data', {
    p_media_id: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    p_fiscal_year: 2025,
  });

  if (error) {
    console.error('❌ エラー:', error);
  } else {
    console.log(`✅ 成功！データ件数: ${data?.length}`);
    console.log('\n📊 最初の10件:');
    data?.slice(0, 10).forEach((row: any) => {
      console.log(`${row.item_year}/${row.item_month} | 予算: ${row.budget.toLocaleString()}円 | 実績: ${row.actual.toLocaleString()}円`);
    });
  }
}

testMonthlyFunction().catch(console.error);

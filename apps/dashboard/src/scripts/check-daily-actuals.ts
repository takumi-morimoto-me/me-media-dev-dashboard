import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface DailyActualRow {
  date: string;
  amount: number;
  media?: { name: string };
  asp?: { name: string };
}

async function checkDailyActuals() {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 daily_actualsテーブルのデータを確認中...\n');

  // ReRe × A8net のデータを取得
  const { data, error } = await supabase
    .from('daily_actuals')
    .select(`
      *,
      media:media_id(name, slug),
      account_item:account_item_id(name),
      asp:asp_id(name)
    `)
    .eq('media_id', '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12')
    .eq('asp_id', 'a51cdc80-0924-4d03-a764-81dd77cda4f7')
    .order('date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('📊 最新10件のデータ（ReRe × A8net）:\n');

  if (data && data.length > 0) {
    let total = 0;
    data.forEach((item: DailyActualRow) => {
      console.log(
        `${item.date} | ${item.amount.toLocaleString()}円 | ` +
        `メディア: ${item.media?.name} | ASP: ${item.asp?.name}`
      );
      total += item.amount;
    });

    console.log(`\n💰 合計: ${total.toLocaleString()}円`);

    // 9月の合計も計算
    const { data: septemberData } = await supabase
      .from('daily_actuals')
      .select('amount')
      .eq('media_id', '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12')
      .eq('asp_id', 'a51cdc80-0924-4d03-a764-81dd77cda4f7')
      .gte('date', '2025-09-01')
      .lte('date', '2025-09-30');

    if (septemberData) {
      const septemberTotal = septemberData.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
      console.log(`\n📅 2025年9月の合計: ${septemberTotal.toLocaleString()}円 (${septemberData.length}件)`);
    }
  } else {
    console.log('⚠️  データが見つかりません');
  }
}

checkDailyActuals().catch(console.error);

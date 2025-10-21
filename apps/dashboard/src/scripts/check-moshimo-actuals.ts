import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkMoshimoActuals() {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 もしもアフィリエイトのデータを確認中...\n');

  const { data, error } = await supabase
    .from('daily_actuals')
    .select(`
      *,
      media:media_id(name),
      asp:asp_id(name)
    `)
    .eq('asp_id', 'e3996740-ccb3-4755-8afc-763ea299e5aa')
    .order('date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('📊 最新10件（もしもアフィリエイト × ReRe）:\n');

  if (data && data.length > 0) {
    let total = 0;
    data.forEach((item) => {
      console.log(
        `${item.date} | ${item.amount.toLocaleString()}円 | ` +
        `メディア: ${item.media?.name} | ASP: ${item.asp?.name}`
      );
      total += item.amount;
    });
    console.log(`\n💰 合計: ${total.toLocaleString()}円`);

    // 10月の合計も計算
    const { data: octoberData } = await supabase
      .from('daily_actuals')
      .select('amount')
      .eq('asp_id', 'e3996740-ccb3-4755-8afc-763ea299e5aa')
      .gte('date', '2025-10-01')
      .lte('date', '2025-10-31');

    if (octoberData) {
      const octoberTotal = octoberData.reduce((sum, item) => sum + item.amount, 0);
      console.log(`\n📅 2025年10月の合計: ${octoberTotal.toLocaleString()}円 (${octoberData.length}件)`);
    }
  } else {
    console.log('⚠️  データが見つかりません');
  }
}

checkMoshimoActuals().catch(console.error);

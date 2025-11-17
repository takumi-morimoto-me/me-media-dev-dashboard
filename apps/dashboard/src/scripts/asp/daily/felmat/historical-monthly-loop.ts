import { FelmatDailyScraper } from './index';

interface FelmatCredentials {
  username: string;
  password: string;
}

interface ScraperConfig {
  headless?: boolean;
  startYearMonth?: string;
  endYearMonth?: string;
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

async function main() {
  console.log('\n📋 felmat 過去データ取得 (2025/01〜2025/11) - 月ごとループ方式');

  const credentials: FelmatCredentials = {
    username: 'rere-dev',
    password: '6345ejrfideg',
  };

  const baseConfig = {
    headless: true,
    mediaId: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    accountItemId: 'a6df5fab-2df4-4263-a888-ab63348cccd5', // アフィリエイト
    aspId: 'b754b95f-01d0-4994-92f7-892f8c8aa760', // felmat
  };

  console.log(`📱 メディアID: ${baseConfig.mediaId}`);
  console.log(`💰 勘定科目ID: ${baseConfig.accountItemId}`);
  console.log(`🔗 ASP ID: ${baseConfig.aspId}\n`);

  // 2025年1月から11月まで月ごとにループ
  const months = [
    '202501', '202502', '202503', '202504', '202505', '202506',
    '202507', '202508', '202509', '202510', '202511'
  ];

  const allData: Array<{date: string; confirmedRevenue: string}> = [];

  for (const month of months) {
    console.log(`\n==================================================`);
    console.log(`📅 ${month} のデータを取得中...`);
    console.log(`==================================================\n`);

    const config: ScraperConfig = {
      ...baseConfig,
      startYearMonth: month,
      endYearMonth: month,
    };

    const scraper = new FelmatDailyScraper(credentials, config);

    try {
      await scraper.initialize();
      await scraper.login();

      // 日別レポートページに移動（期間指定付き）
      await scraper.navigateToDailyReport();

      // 日別データを抽出
      const monthlyData = await scraper.extractDailyData();
      console.log(`✅ ${month}: ${monthlyData.length}件のデータを取得`);

      // データを統合
      allData.push(...monthlyData);

      await scraper.close();
    } catch (error) {
      console.error(`❌ ${month} のデータ取得でエラー:`, error);
      await scraper.close();
    }

    // 次のループ前に少し待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n==================================================`);
  console.log(`📊 全データ取得完了`);
  console.log(`==================================================\n`);
  console.log(`合計: ${allData.length}件のデータを取得しました\n`);

  // Supabaseに保存
  if (allData.length > 0) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('💾 Supabase (daily_actualsテーブル) に保存中...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const item of allData) {
      const amount = parseInt(item.confirmedRevenue, 10);

      if (isNaN(amount)) {
        console.log(`⚠️  スキップ: ${item.date} - 無効な金額`);
        errorCount++;
        continue;
      }

      const { error } = await supabase.from('daily_actuals').upsert(
        {
          date: item.date,
          amount,
          media_id: baseConfig.mediaId,
          account_item_id: baseConfig.accountItemId,
          asp_id: baseConfig.aspId,
        },
        {
          onConflict: 'date,media_id,account_item_id,asp_id',
        }
      );

      if (error) {
        console.error(`❌ エラー (${item.date}):`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }

    console.log(`\n✅ 保存完了: ${successCount}件成功, ${errorCount}件失敗\n`);
  }
}

main().catch(console.error);

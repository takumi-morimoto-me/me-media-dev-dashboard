import { FelmatDailyScraper } from '../../daily/felmat/index';

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
  console.log('\n📋 felmat 全期間データ取得 (2025年1月〜10月)');
  console.log('📅 最大6ヶ月ごとに分割して取得します\n');

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

  // 6ヶ月ごとに期間を分割（felmatの最大期間が6ヶ月のため）
  const periods = [
    { start: '202501', end: '202506' }, // 1月〜6月
    { start: '202507', end: '202510' }, // 7月〜10月
  ];

  for (const period of periods) {
    console.log(`\n========================================`);
    console.log(`📅 期間: ${period.start} 〜 ${period.end}`);
    console.log(`========================================\n`);

    const config: ScraperConfig = {
      ...baseConfig,
      startYearMonth: period.start,
      endYearMonth: period.end,
    };

    const scraper = new FelmatDailyScraper(credentials, config);

    try {
      await scraper.initialize();
      await scraper.login();

      // 日別レポートページに移動して期間選択
      await scraper.navigateToDailyReport();

      // データを抽出
      const data = await scraper.extractDailyData();

      if (data.length > 0) {
        await scraper.saveToSupabase(data);
      } else {
        console.log(`⚠️  ${period.start}〜${period.end}: 取得したデータが0件です`);
      }

      await scraper.close();

      // 次の期間の前に少し待機
      console.log('\n⏱️  次の期間の取得まで3秒待機...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`❌ ${period.start}〜${period.end}のデータ取得でエラーが発生:`, error);
      await scraper.close();
    }
  }

  console.log('\n✅ すべての期間のデータ取得が完了しました！');
}

main().catch(console.error);

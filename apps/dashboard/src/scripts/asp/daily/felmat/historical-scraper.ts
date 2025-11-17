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
  console.log('\n📋 felmat 過去データ取得 (2025/01〜現在)');

  const credentials: FelmatCredentials = {
    username: 'rere-dev',
    password: '6345ejrfideg',
  };

  const config: ScraperConfig = {
    headless: false, // デバッグ用にfalseに変更
    startYearMonth: '202501', // 2025年1月
    endYearMonth: '202511', // 2025年11月
    mediaId: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    accountItemId: 'a6df5fab-2df4-4263-a888-ab63348cccd5', // アフィリエイト
    aspId: 'b754b95f-01d0-4994-92f7-892f8c8aa760', // felmat
  };

  console.log(`📱 メディアID: ${config.mediaId}`);
  console.log(`💰 勘定科目ID: ${config.accountItemId}`);
  console.log(`🔗 ASP ID: ${config.aspId}`);
  console.log(`📅 期間: ${config.startYearMonth} 〜 ${config.endYearMonth}\n`);

  const scraper = new FelmatDailyScraper(credentials, config);

  try {
    await scraper.initialize();
    await scraper.login();

    console.log('現在のURL:', await scraper['page']?.url());

    // 日別レポートページに移動（期間指定付き）
    await scraper.navigateToDailyReport();

    // 日別データを抽出・保存
    const dailyData = await scraper.extractDailyData();
    console.log(`\n取得したデータ件数: ${dailyData.length}`);

    if (dailyData.length > 0) {
      await scraper.saveToSupabase(dailyData, 'daily_actuals');
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

main().catch(console.error);

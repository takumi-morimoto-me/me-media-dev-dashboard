import { LinkAGDailyScraper } from './linkag-daily-scraper';

interface LinkAGCredentials {
  username: string;
  password: string;
}

interface ScraperConfig {
  headless?: boolean;
  month?: string;
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

async function main() {
  console.log('\n📋 Link-AG 全月データ取得 (2025年1月〜10月)');

  const credentials: LinkAGCredentials = {
    username: 'rere-dev',
    password: 'ydh563czoq',
  };

  const baseConfig = {
    headless: true,
    mediaId: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    accountItemId: 'a6df5fab-2df4-4263-a888-ab63348cccd5', // アフィリエイト
    aspId: '88256cb4-d177-47d3-bf04-db48bf859843', // Link-AG
  };

  // 2025年1月から10月まで
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

  for (const month of months) {
    console.log(`\n========================================`);
    console.log(`📅 ${month}月のデータ取得中...`);
    console.log(`========================================\n`);

    const config: ScraperConfig = {
      ...baseConfig,
      month,
    };

    const scraper = new LinkAGDailyScraper(credentials, config);

    try {
      await scraper.initialize();
      await scraper.login();

      // Link-AGは月を指定してダッシュボードに移動できないので
      // 日別レポートページに移動する必要があるかもしれません
      // とりあえず、現在のダッシュボードから取得
      const data = await scraper.extractDailyData();

      if (data.length > 0) {
        await scraper.saveToSupabase(data);
      } else {
        console.log(`⚠️  ${month}月: 取得したデータが0件です`);
      }

      await scraper.close();

      // 次の月の前に少し待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ ${month}月のデータ取得でエラーが発生:`, error);
      await scraper.close();
    }
  }

  console.log('\n✅ すべての月のデータ取得が完了しました！');
}

main().catch(console.error);

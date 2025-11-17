import A8NetDailyScraper from './a8net-daily-scraper';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface A8NetCredentials {
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

async function scrapeAllMonths() {
  const credentials: A8NetCredentials = {
    username: process.env.A8NET_USERNAME || '',
    password: process.env.A8NET_PASSWORD || '',
  };

  if (!credentials.username || !credentials.password) {
    console.error('❌ A8NET_USERNAMEとA8NET_PASSWORDを.env.localに設定してください');
    return;
  }

  const baseConfig = {
    headless: true,
    mediaId: process.env.RERE_MEDIA_ID || '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12',
    accountItemId: process.env.AFFILIATE_ACCOUNT_ITEM_ID || 'a6df5fab-2df4-4263-a888-ab63348cccd5',
    aspId: process.env.A8NET_ASP_ID || 'a51cdc80-0924-4d03-a764-81dd77cda4f7',
  };

  // 1月から8月までのデータを取得
  const months = ['1', '2', '3', '4', '5', '6', '7', '8'];

  for (const month of months) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📅 ${month}月のデータを取得中...`);
    console.log('='.repeat(50));

    const config: ScraperConfig = {
      ...baseConfig,
      month,
    };

    const scraper = new A8NetDailyScraper(credentials, config);

    try {
      await scraper.initialize();
      await scraper.login();
      await scraper.navigateToDailyReport();

      const data = await scraper.extractDailyData();

      if (data.length > 0) {
        await scraper.saveToSupabase(data);
      } else {
        console.log('⚠️ データが取得できませんでした');
      }

      console.log(`✅ ${month}月の処理が完了しました`);
    } catch (error) {
      console.error(`❌ ${month}月のエラー:`, error instanceof Error ? error.message : error);
      await scraper.screenshot(`error-${month}.png`);
    } finally {
      await scraper.close();
      // 次の月の処理前に少し待機
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ 全ての月の処理が完了しました！');
  console.log('='.repeat(50));
}

scrapeAllMonths().catch(console.error);

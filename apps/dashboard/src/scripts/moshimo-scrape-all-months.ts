import { MoshimoDailyScraper } from './moshimo-daily-scraper';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function scrapeAllMonths() {
  console.log('📋 もしもアフィリエイト 全月データ取得（2025年1月～9月）\n');

  const credentials = {
    username: 'reredev',
    password: 'Pa7MHBCe',
  };

  const baseConfig = {
    headless: true,
    mediaId: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    accountItemId: 'a6df5fab-2df4-4263-a888-ab63348cccd5', // アフィリエイト
    aspId: 'e3996740-ccb3-4755-8afc-763ea299e5aa', // もしもアフィリエイト
  };

  const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const month of months) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📅 ${month}月のデータを取得中...`);
    console.log('='.repeat(60));

    const scraper = new MoshimoDailyScraper(credentials, { ...baseConfig, month });

    try {
      await scraper.initialize();
      await scraper.login();
      await scraper.navigateToDailyReport();
      const data = await scraper.extractDailyData();

      if (data.length > 0) {
        await scraper.saveToSupabase(data);
        totalSuccess += data.length;
      }
    } catch (error) {
      console.error(`❌ ${month}月のデータ取得でエラーが発生:`, error);
      totalFailed++;
    } finally {
      await scraper.close();
      // 次の月まで3秒待機
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ 全ての処理が完了しました！');
  console.log(`📊 成功: ${totalSuccess}件`);
  console.log(`❌ 失敗: ${totalFailed}月`);
  console.log('='.repeat(60));
}

scrapeAllMonths().catch(console.error);

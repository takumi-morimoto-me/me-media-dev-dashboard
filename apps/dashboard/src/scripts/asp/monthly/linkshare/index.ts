import { LinkshareDailyScraper } from '../../daily/linkshare/index';

/**
 * リンクシェア 月次スクレイパー (過去データ一括取得用)
 *
 * 使い方:
 * pnpm exec tsx src/scripts/asp/monthly/linkshare/index.ts
 *
 * 環境変数:
 * - LINKSHARE_USERNAME
 * - LINKSHARE_PASSWORD
 * - RERE_MEDIA_ID
 * - AFFILIATE_ACCOUNT_ITEM_ID
 * - LINKSHARE_ASP_ID
 */

async function main() {
  console.log('\n📋 リンクシェア 全期間データ取得');
  console.log('📅 2025年1月〜10月のデータを取得します\n');

  const credentials = {
    username: process.env.LINKSHARE_USERNAME || '',
    password: process.env.LINKSHARE_PASSWORD || '',
  };

  const config = {
    headless: true,
    mediaId: process.env.RERE_MEDIA_ID || '',
    accountItemId: process.env.AFFILIATE_ACCOUNT_ITEM_ID || '',
    aspId: process.env.LINKSHARE_ASP_ID || '',
  };

  // 検証
  if (!credentials.username || !credentials.password) {
    console.error('❌ エラー: 認証情報が設定されていません');
    console.error('   LINKSHARE_USERNAME と LINKSHARE_PASSWORD を .env.local に設定してください');
    process.exit(1);
  }

  if (!config.mediaId || !config.accountItemId || !config.aspId) {
    console.error('❌ エラー: 必須の設定が不足しています');
    console.error('   RERE_MEDIA_ID, AFFILIATE_ACCOUNT_ITEM_ID, LINKSHARE_ASP_ID を設定してください');
    process.exit(1);
  }

  // 月ごとにループ (1月〜10月)
  const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  for (const month of months) {
    console.log(`\n========================================`);
    console.log(`📅 2025年${month}月のデータを取得中...`);
    console.log(`========================================\n`);

    const scraper = new LinkshareDailyScraper(credentials, { ...config, month });

    try {
      await scraper.initialize();
      await scraper.login();
      await scraper.navigateToDailyReport();
      const data = await scraper.extractDailyData();

      if (data.length > 0) {
        await scraper.saveToSupabase(data);
        console.log(`✅ ${month}月: ${data.length}件のデータを保存しました`);
      } else {
        console.log(`⚠️  ${month}月: データがありません`);
      }

      await scraper.close();

      // 次の月の前に3秒待機
      if (month !== '10') {
        console.log('\n⏱️  次の月の取得まで3秒待機...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(`❌ ${month}月のデータ取得でエラー:`, error);
      await scraper.close();
    }
  }

  console.log('\n✅ すべての月のデータ取得が完了しました！');
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;

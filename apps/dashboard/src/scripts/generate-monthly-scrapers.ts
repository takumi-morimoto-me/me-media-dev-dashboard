#!/usr/bin/env tsx
/**
 * 月次スクレイパーを一括生成するスクリプト
 */
import fs from 'fs';
import path from 'path';

const ASP_LIST = [
  { kebab: 'a8app', pascal: 'A8app', display: 'A8.net App', envPrefix: 'A8APP' },
  { kebab: 'accesstrade', pascal: 'Accesstrade', display: 'アクセストレード', envPrefix: 'ACCESSTRADE' },
  { kebab: 'afb', pascal: 'Afb', display: 'afb', envPrefix: 'AFB' },
  { kebab: 'amazon', pascal: 'Amazon', display: 'Amazon Associates', envPrefix: 'AMAZON' },
  { kebab: 'castalk', pascal: 'Castalk', display: 'CASTALK', envPrefix: 'CASTALK' },
  { kebab: 'circuitx', pascal: 'Circuitx', display: 'CircuitX', envPrefix: 'CIRCUITX' },
  { kebab: 'dmm', pascal: 'Dmm', display: 'DMMアフィリエイト', envPrefix: 'DMM' },
  { kebab: 'docomo-affiliate', pascal: 'DocomoAffiliate', display: 'ドコモアフィリエイト', envPrefix: 'DOCOMO_AFFILIATE' },
  { kebab: 'imobile', pascal: 'Imobile', display: 'i-mobile', envPrefix: 'IMOBILE' },
  { kebab: 'janet', pascal: 'Janet', display: 'JANet', envPrefix: 'JANET' },
  { kebab: 'linkshare', pascal: 'Linkshare', display: 'リンクシェア', envPrefix: 'LINKSHARE' },
  { kebab: 'presco', pascal: 'Presco', display: 'PRESCO', envPrefix: 'PRESCO' },
  { kebab: 'ratelad', pascal: 'Ratelad', display: 'Ratel AD', envPrefix: 'RATELAD' },
  { kebab: 'rentracks', pascal: 'Rentracks', display: 'レントラックス', envPrefix: 'RENTRACKS' },
  { kebab: 'skyflag', pascal: 'Skyflag', display: 'SKYFLAG', envPrefix: 'SKYFLAG' },
  { kebab: 'slvrbullet', pascal: 'Slvrbullet', display: 'SLVRbullet', envPrefix: 'SLVRBULLET' },
  { kebab: 'smaad', pascal: 'Smaad', display: 'SmaAD', envPrefix: 'SMAAD' },
  { kebab: 'smartc', pascal: 'Smartc', display: 'Smart-C', envPrefix: 'SMARTC' },
  { kebab: 'tg-affiliate', pascal: 'TgAffiliate', display: 'TGアフィリエイト', envPrefix: 'TG_AFFILIATE' },
  { kebab: 'ultiga', pascal: 'Ultiga', display: 'アルテガアフィリエイト', envPrefix: 'ULTIGA' },
  { kebab: 'valuecommerce', pascal: 'Valuecommerce', display: 'バリューコマース', envPrefix: 'VALUECOMMERCE' },
  { kebab: 'zucks', pascal: 'Zucks', display: 'Zucks Affiliate', envPrefix: 'ZUCKS' },
];

const TEMPLATE = `import { {PASCAL}DailyScraper } from '../../daily/{KEBAB}/index';

/**
 * {DISPLAY} 月次スクレイパー (過去データ一括取得用)
 *
 * 使い方:
 * pnpm exec tsx src/scripts/asp/monthly/{KEBAB}/index.ts
 *
 * 環境変数:
 * - {ENV_PREFIX}_USERNAME
 * - {ENV_PREFIX}_PASSWORD
 * - RERE_MEDIA_ID
 * - AFFILIATE_ACCOUNT_ITEM_ID
 * - {ENV_PREFIX}_ASP_ID
 */

async function main() {
  console.log('\\n📋 {DISPLAY} 全期間データ取得');
  console.log('📅 2025年1月〜10月のデータを取得します\\n');

  const credentials = {
    username: process.env.{ENV_PREFIX}_USERNAME || '',
    password: process.env.{ENV_PREFIX}_PASSWORD || '',
  };

  const config = {
    headless: true,
    mediaId: process.env.RERE_MEDIA_ID || '',
    accountItemId: process.env.AFFILIATE_ACCOUNT_ITEM_ID || '',
    aspId: process.env.{ENV_PREFIX}_ASP_ID || '',
  };

  // 検証
  if (!credentials.username || !credentials.password) {
    console.error('❌ エラー: 認証情報が設定されていません');
    console.error('   {ENV_PREFIX}_USERNAME と {ENV_PREFIX}_PASSWORD を .env.local に設定してください');
    process.exit(1);
  }

  if (!config.mediaId || !config.accountItemId || !config.aspId) {
    console.error('❌ エラー: 必須の設定が不足しています');
    console.error('   RERE_MEDIA_ID, AFFILIATE_ACCOUNT_ITEM_ID, {ENV_PREFIX}_ASP_ID を設定してください');
    process.exit(1);
  }

  // 月ごとにループ (1月〜10月)
  const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  for (const month of months) {
    console.log(\`\\n========================================\`);
    console.log(\`📅 2025年\${month}月のデータを取得中...\`);
    console.log(\`========================================\\n\`);

    const scraper = new {PASCAL}DailyScraper(credentials, { ...config, month });

    try {
      await scraper.initialize();
      await scraper.login();
      await scraper.navigateToDailyReport();
      const data = await scraper.extractDailyData();

      if (data.length > 0) {
        await scraper.saveToSupabase(data);
        console.log(\`✅ \${month}月: \${data.length}件のデータを保存しました\`);
      } else {
        console.log(\`⚠️  \${month}月: データがありません\`);
      }

      await scraper.close();

      // 次の月の前に3秒待機
      if (month !== '10') {
        console.log('\\n⏱️  次の月の取得まで3秒待機...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error(\`❌ \${month}月のデータ取得でエラー:\`, error);
      await scraper.close();
    }
  }

  console.log('\\n✅ すべての月のデータ取得が完了しました！');
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;
`;

function generateMonthlyScraper(asp: typeof ASP_LIST[0]) {
  const content = TEMPLATE
    .replace(/{KEBAB}/g, asp.kebab)
    .replace(/{PASCAL}/g, asp.pascal)
    .replace(/{DISPLAY}/g, asp.display)
    .replace(/{ENV_PREFIX}/g, asp.envPrefix);

  const outputPath = path.join(
    __dirname,
    'asp',
    'monthly',
    asp.kebab,
    'index.ts'
  );

  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`✅ ${asp.kebab}/index.ts を生成しました`);
}

function main() {
  console.log('🚀 月次スクレイパーを一括生成します\n');

  for (const asp of ASP_LIST) {
    generateMonthlyScraper(asp);
  }

  console.log(`\n✅ ${ASP_LIST.length}件の月次スクレイパーを生成しました！`);
}

main();

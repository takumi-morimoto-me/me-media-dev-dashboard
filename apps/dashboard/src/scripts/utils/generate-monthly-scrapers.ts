#!/usr/bin/env tsx
/**
 * 月次スクレイパー生成スクリプト
 * 日次スクレイパーを使って過去データを一括取得する月次スクレイパーを生成
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface AspInfo {
  dirName: string;
  className: string;
  displayName: string;
}

const asps: AspInfo[] = [
  { dirName: 'a8app', className: 'A8AppDailyScraper', displayName: 'A8 App' },
  { dirName: 'accesstrade', className: 'AccesstradeDailyScraper', displayName: 'アクセストレード' },
  { dirName: 'afb', className: 'AfbDailyScraper', displayName: 'afb' },
  { dirName: 'amazon', className: 'AmazonDailyScraper', displayName: 'Amazon Associates' },
  { dirName: 'castalk', className: 'CASTALKDailyScraper', displayName: 'CASTALK' },
  { dirName: 'circuitx', className: 'CircuitXDailyScraper', displayName: 'CircuitX' },
  { dirName: 'dmm', className: 'DmmDailyScraper', displayName: 'DMM' },
  { dirName: 'docomo-affiliate', className: 'DocomoAffiliateDailyScraper', displayName: 'docomoアフィリエイト' },
  { dirName: 'imobile', className: 'IMobileDailyScraper', displayName: 'i-mobile' },
  { dirName: 'janet', className: 'JANetDailyScraper', displayName: 'JANet' },
  { dirName: 'linkshare', className: 'LinkShareDailyScraper', displayName: 'LinkShare' },
  { dirName: 'presco', className: 'PRESCODailyScraper', displayName: 'PRESCO' },
  { dirName: 'ratelad', className: 'RatelADDailyScraper', displayName: 'RatelAD' },
  { dirName: 'rentracks', className: 'RentracksDailyScraper', displayName: 'Rentracks' },
  { dirName: 'skyflag', className: 'SKYFLAGDailyScraper', displayName: 'SKYFLAG' },
  { dirName: 'slvrbullet', className: 'SLVRbulletDailyScraper', displayName: 'SLVRbullet' },
  { dirName: 'smaad', className: 'SmaADDailyScraper', displayName: 'SmaAD' },
  { dirName: 'smartc', className: 'SmartCDailyScraper', displayName: 'Smart-C' },
  { dirName: 'tg-affiliate', className: 'TGAffiliateDailyScraper', displayName: 'TGアフィリエイト' },
  { dirName: 'ultiga', className: 'UltigaDailyScraper', displayName: 'アルテガアフィリエイト' },
  { dirName: 'valuecommerce', className: 'ValueCommerceDailyScraper', displayName: 'ValueCommerce' },
  { dirName: 'zucks', className: 'ZucksDailyScraper', displayName: 'Zucks' },
];

function generateMonthlyScraperCode(asp: AspInfo): string {
  return `import { ${asp.className} } from '../../daily/${asp.dirName}/index';

/**
 * ${asp.displayName} 月次スクレイパー (過去データ一括取得用)
 *
 * 使い方:
 * pnpm exec tsx src/scripts/asp/monthly/${asp.dirName}/index.ts
 *
 * 注意:
 * - credentials, mediaId, accountItemId, aspId は環境変数または直接指定してください
 * - 月の範囲は各ASPの仕様に合わせて調整してください
 */

async function main() {
  console.log('\\n📋 ${asp.displayName} 全期間データ取得');
  console.log('⚠️  このスクリプトは要カスタマイズ: credentials, 期間設定などを実装してください\\n');

  // TODO: 以下の設定を環境に合わせて実装してください
  // const credentials = {
  //   username: process.env.${asp.dirName.toUpperCase()}_USERNAME || '',
  //   password: process.env.${asp.dirName.toUpperCase()}_PASSWORD || '',
  // };

  // const config = {
  //   headless: true,
  //   mediaId: process.env.RERE_MEDIA_ID || '',
  //   accountItemId: process.env.AFFILIATE_ACCOUNT_ITEM_ID || '',
  //   aspId: process.env.${asp.dirName.toUpperCase()}_ASP_ID || '',
  // };

  // 月ごとにループする例 (各ASPの仕様に合わせて調整)
  // const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  //
  // for (const month of months) {
  //   const scraper = new ${asp.className}(credentials, { ...config, month });
  //   try {
  //     await scraper.initialize();
  //     await scraper.login();
  //     await scraper.navigateToDailyReport();
  //     const data = await scraper.extractDailyData();
  //     if (data.length > 0) {
  //       await scraper.saveToSupabase(data);
  //     }
  //     await scraper.close();
  //     await new Promise(resolve => setTimeout(resolve, 3000));
  //   } catch (error) {
  //     console.error(\`❌ \${month}月のデータ取得でエラー:\`, error);
  //     await scraper.close();
  //   }
  // }

  console.log('\\n✅ 実装してから実行してください');
}

if (require.main === module) {
  main().catch(console.error);
}

export default main;
`;
}

// 各ASPの月次スクレイパーを生成
const monthlyDir = join(__dirname, '../asp/monthly');

for (const asp of asps) {
  const aspDir = join(monthlyDir, asp.dirName);
  const indexPath = join(aspDir, 'index.ts');

  try {
    mkdirSync(aspDir, { recursive: true });
    const code = generateMonthlyScraperCode(asp);
    writeFileSync(indexPath, code, 'utf-8');
    console.log(`✅ Created: ${asp.dirName}/index.ts`);
  } catch (error) {
    console.error(`❌ Failed to create ${asp.dirName}:`, error);
  }
}

console.log(`\\n✅ ${asps.length}個の月次スクレイパーを生成しました！`);

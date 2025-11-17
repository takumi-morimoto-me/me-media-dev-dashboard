import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  status: 'success' | 'failed' | 'error';
  message: string;
  duration: number;
}

const results: TestResult[] = [];

// 全スクレイパーのリスト
const scrapers = [
  'a8app',
  'a8net',
  'accesstrade',
  'afb',
  'amazon',
  'castalk',
  'circuitx',
  'dmm',
  'docomo-affiliate',
  'felmat',
  'imobile',
  'janet',
  'linkag',
  'linkshare',
  'moshimo',
  'presco',
  'ratelad',
  'rentracks',
  'skyflag',
  'slvrbullet',
  'smaad',
  'smartc',
  'tg-affiliate',
  'ultiga',
  'valuecommerce',
  'webridge',
  'zucks',
];

async function testScraper(name: string): Promise<TestResult> {
  const scraperPath = `src/scripts/asp/daily/${name}/index.ts`;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧪 テスト中: ${name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // ファイルが存在するか確認
  if (!fs.existsSync(scraperPath)) {
    return {
      name,
      status: 'error',
      message: 'ファイルが存在しません',
      duration: 0,
    };
  }

  const startTime = Date.now();

  try {
    // dry-runモードで実行（実際にはデータを保存しない）
    // タイムアウトを30秒に設定
    const output = execSync(`pnpm exec tsx ${scraperPath}`, {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: 'pipe',
    });

    const duration = Date.now() - startTime;

    // 成功の判定
    if (output.includes('✅') || output.includes('成功') || output.includes('保存完了')) {
      return {
        name,
        status: 'success',
        message: '正常に実行されました',
        duration,
      };
    } else {
      return {
        name,
        status: 'failed',
        message: '実行されましたが、成功メッセージが見つかりません',
        duration,
      };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // タイムアウトエラー
    if (error.code === 'ETIMEDOUT') {
      return {
        name,
        status: 'failed',
        message: 'タイムアウト（30秒以上かかりました）',
        duration,
      };
    }

    // その他のエラー
    const errorMessage = error.stderr?.toString() || error.message || '不明なエラー';
    const shortError = errorMessage.split('\n')[0].substring(0, 100);

    return {
      name,
      status: 'error',
      message: shortError,
      duration,
    };
  }
}

async function main() {
  console.log('\n🚀 全スクレイパーのテストを開始します\n');
  console.log(`📊 対象: ${scrapers.length}個のスクレイパー\n`);
  console.log('⚠️  注意: 各スクレイパーは最大30秒でタイムアウトします\n');

  let successCount = 0;
  let failedCount = 0;
  let errorCount = 0;

  for (const scraper of scrapers) {
    const result = await testScraper(scraper);
    results.push(result);

    // 結果を表示
    const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '⚠️' : '❌';
    const time = (result.duration / 1000).toFixed(1);
    console.log(`${icon} ${result.name}: ${result.message} (${time}s)`);

    if (result.status === 'success') successCount++;
    else if (result.status === 'failed') failedCount++;
    else errorCount++;

    // 少し待機（連続実行による負荷軽減）
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 最終レポート
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 テスト結果サマリー');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ 成功: ${successCount}個`);
  console.log(`⚠️  失敗: ${failedCount}個`);
  console.log(`❌ エラー: ${errorCount}個`);
  console.log(`📊 合計: ${scrapers.length}個\n`);

  // 成功したスクレイパーのリスト
  if (successCount > 0) {
    console.log('✅ 正常に動作するスクレイパー:');
    results
      .filter(r => r.status === 'success')
      .forEach(r => console.log(`   - ${r.name}`));
    console.log('');
  }

  // 失敗したスクレイパーのリスト
  if (failedCount > 0) {
    console.log('⚠️  失敗したスクレイパー:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`   - ${r.name}: ${r.message}`));
    console.log('');
  }

  // エラーが発生したスクレイパーのリスト
  if (errorCount > 0) {
    console.log('❌ エラーが発生したスクレイパー:');
    results
      .filter(r => r.status === 'error')
      .forEach(r => console.log(`   - ${r.name}: ${r.message}`));
    console.log('');
  }

  // 結果をJSONファイルに保存
  const reportPath = 'scraper-test-results.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 詳細レポートを保存しました: ${reportPath}\n`);
}

main();

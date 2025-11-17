import { execSync } from 'child_process';
import * as fs from 'fs';

interface ExecutionResult {
  name: string;
  status: 'success' | 'failed' | 'timeout';
  message: string;
  dataCount?: number;
  duration: number;
}

// 完全実装済みのスクレイパーリスト
const completedScrapers = [
  'a8app',
  'accesstrade',
  'afb',
  'amazon',
  'castalk',
  'circuitx',
  'dmm',
  'docomo-affiliate',
  'imobile',
  'janet',
  'linkshare',
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
  'zucks',
];

const results: ExecutionResult[] = [];

async function runScraper(name: string): Promise<ExecutionResult> {
  const scraperPath = `src/scripts/asp/daily/${name}/index.ts`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 実行中: ${name.toUpperCase()}`);
  console.log(`${'='.repeat(60)}`);

  const startTime = Date.now();

  try {
    // 60秒のタイムアウトで実行（手動ログインが必要な場合があるため長めに設定）
    const output = execSync(`pnpm exec tsx ${scraperPath}`, {
      encoding: 'utf-8',
      timeout: 120000, // 2分
      stdio: 'inherit', // 出力をリアルタイムで表示
    });

    const duration = Date.now() - startTime;

    return {
      name,
      status: 'success',
      message: '実行成功',
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    if (error.code === 'ETIMEDOUT') {
      console.log(`\n⏰ ${name}: タイムアウト (2分経過)`);
      return {
        name,
        status: 'timeout',
        message: 'タイムアウト',
        duration,
      };
    }

    const errorMessage = error.message || '不明なエラー';
    console.log(`\n❌ ${name}: エラー発生`);
    console.log(errorMessage.substring(0, 200));

    return {
      name,
      status: 'failed',
      message: errorMessage.split('\n')[0].substring(0, 100),
      duration,
    };
  }
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 完全実装済みスクレイパー一括実行');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📦 対象: ${completedScrapers.length}個のスクレイパー`);
  console.log(`📅 取得期間: 2025年11月分`);
  console.log(`⏱️  タイムアウト: 各2分\n`);
  console.log(`⚠️  注意: 手動ログインが必要なスクレイパーがあります`);
  console.log(`        ブラウザが開いたら手動でログインしてください\n`);

  const startTime = Date.now();
  let successCount = 0;
  let failedCount = 0;
  let timeoutCount = 0;

  for (let i = 0; i < completedScrapers.length; i++) {
    const scraper = completedScrapers[i];
    console.log(`\n[${i + 1}/${completedScrapers.length}] 処理中...`);

    const result = await runScraper(scraper);
    results.push(result);

    if (result.status === 'success') {
      successCount++;
      console.log(`✅ ${scraper}: 成功 (${(result.duration / 1000).toFixed(1)}s)`);
    } else if (result.status === 'timeout') {
      timeoutCount++;
    } else {
      failedCount++;
    }

    // 次のスクレイパーまで2秒待機
    if (i < completedScrapers.length - 1) {
      console.log('\n⏳ 2秒待機中...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const totalDuration = Date.now() - startTime;

  // 最終レポート
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 実行結果サマリー');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ 成功: ${successCount}個`);
  console.log(`⏰ タイムアウト: ${timeoutCount}個`);
  console.log(`❌ 失敗: ${failedCount}個`);
  console.log(`📊 合計: ${completedScrapers.length}個`);
  console.log(`⏱️  総実行時間: ${(totalDuration / 1000 / 60).toFixed(1)}分\n`);

  // 成功したスクレイパー
  if (successCount > 0) {
    console.log('✅ 成功したスクレイパー:');
    results
      .filter(r => r.status === 'success')
      .forEach(r => console.log(`   - ${r.name}`));
    console.log('');
  }

  // タイムアウトしたスクレイパー
  if (timeoutCount > 0) {
    console.log('⏰ タイムアウトしたスクレイパー（手動ログイン必要の可能性）:');
    results
      .filter(r => r.status === 'timeout')
      .forEach(r => console.log(`   - ${r.name}`));
    console.log('');
  }

  // 失敗したスクレイパー
  if (failedCount > 0) {
    console.log('❌ 失敗したスクレイパー:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`   - ${r.name}: ${r.message}`));
    console.log('');
  }

  // 結果をJSONに保存
  const reportPath = 'scraper-execution-results.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`📄 詳細レポート: ${reportPath}\n`);
}

main();

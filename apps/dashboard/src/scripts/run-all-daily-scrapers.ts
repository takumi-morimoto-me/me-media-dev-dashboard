#!/usr/bin/env tsx
/**
 * 全ASPの日次スクレイパーを一括実行するスクリプト
 *
 * 使い方:
 * pnpm exec tsx src/scripts/run-all-daily-scrapers.ts
 * pnpm exec tsx src/scripts/run-all-daily-scrapers.ts --month=9
 * pnpm exec tsx src/scripts/run-all-daily-scrapers.ts --asp=a8net,moshimo
 */

const ASP_LIST = [
  'a8net',
  'a8app',
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
  'zucks',
];

interface ScraperResult {
  asp: string;
  status: 'success' | 'error' | 'skipped';
  dataCount?: number;
  error?: string;
  duration?: number;
}

async function runScraper(asp: string, month?: string): Promise<ScraperResult> {
  const startTime = Date.now();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 ${asp} のデータ取得を開始...`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // 動的にスクレイパーをインポート
    const scraperModule = await import(`./asp/daily/${asp}/index`);

    // スクレイパーが実行可能かチェック
    if (typeof scraperModule.default !== 'function' && !scraperModule.default?.run) {
      console.log(`⚠️  ${asp}: スクレイパーが実装されていません（スキップ）`);
      return {
        asp,
        status: 'skipped',
        duration: Date.now() - startTime,
      };
    }

    // スクレイパーを実行
    await scraperModule.default();

    const duration = Date.now() - startTime;
    console.log(`\n✅ ${asp}: 成功 (所要時間: ${(duration / 1000).toFixed(1)}秒)\n`);

    return {
      asp,
      status: 'success',
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ ${asp}: エラーが発生しました`);
    console.error(error);
    console.log(`   (所要時間: ${(duration / 1000).toFixed(1)}秒)\n`);

    return {
      asp,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

async function main() {
  // コマンドライン引数を解析
  const args = process.argv.slice(2);
  let targetAsps = ASP_LIST;
  let month: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--asp=')) {
      const aspNames = arg.replace('--asp=', '').split(',');
      targetAsps = ASP_LIST.filter(asp => aspNames.includes(asp));
    } else if (arg.startsWith('--month=')) {
      month = arg.replace('--month=', '');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 全ASP日次スクレイパー一括実行');
  console.log('='.repeat(60));
  console.log(`\n対象ASP: ${targetAsps.length}件`);
  if (month) {
    console.log(`対象月: ${month}月`);
  }
  console.log(`\n${targetAsps.join(', ')}\n`);

  const results: ScraperResult[] = [];
  const totalStartTime = Date.now();

  // 順次実行（並列実行はサーバー負荷を考慮して避ける）
  for (let i = 0; i < targetAsps.length; i++) {
    const asp = targetAsps[i];
    console.log(`\n[${i + 1}/${targetAsps.length}] ${asp} を実行中...`);

    const result = await runScraper(asp, month);
    results.push(result);

    // 次のASPの前に少し待機（サーバー負荷軽減）
    if (i < targetAsps.length - 1) {
      console.log('⏱️  次のASPまで3秒待機...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const totalDuration = Date.now() - totalStartTime;

  // 結果サマリー
  console.log('\n' + '='.repeat(60));
  console.log('📊 実行結果サマリー');
  console.log('='.repeat(60) + '\n');

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  console.log(`✅ 成功: ${successCount}件`);
  console.log(`❌ 失敗: ${errorCount}件`);
  console.log(`⚠️  スキップ: ${skippedCount}件`);
  console.log(`⏱️  合計所要時間: ${(totalDuration / 1000 / 60).toFixed(1)}分\n`);

  if (errorCount > 0) {
    console.log('失敗したASP:');
    results
      .filter(r => r.status === 'error')
      .forEach(r => {
        console.log(`  - ${r.asp}: ${r.error}`);
      });
    console.log('');
  }

  if (skippedCount > 0) {
    console.log('スキップされたASP:');
    results
      .filter(r => r.status === 'skipped')
      .forEach(r => {
        console.log(`  - ${r.asp}`);
      });
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('✅ すべての処理が完了しました！');
  console.log('='.repeat(60) + '\n');

  // エラーがあった場合は終了コード1で終了
  if (errorCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('予期しないエラーが発生しました:', error);
    process.exit(1);
  });
}

export default main;

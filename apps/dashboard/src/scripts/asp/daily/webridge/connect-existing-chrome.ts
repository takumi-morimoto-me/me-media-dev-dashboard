import { chromium } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DailyData {
  date: string;
  confirmedRevenue: string;
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 既存のChromeブラウザに接続します');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📌 事前準備（重要！）:');
  console.log('   1. 既存のChromeを全て閉じる（完全終了）');
  console.log('   2. 新しいターミナルウィンドウを開く');
  console.log('   3. 以下のコマンドをコピー&ペーストして実行:\n');
  console.log('      /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile\n');
  console.log('   4. 起動したChromeでWEBRIDGEにログイン');
  console.log('      URL: https://webridge.net/ja_jp/top/publisher/login');
  console.log('   5. ログイン成功を確認');
  console.log('   6. このターミナルに戻ってEnterキーを押す\n');

  // ユーザーの準備ができるまで待機
  console.log('⏳ Chromeの準備ができたらEnterキーを押してください...');
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve(null));
  });

  // デバッグポートが開いているか確認
  console.log('\n🔍 Chromeのデバッグポートを確認中...');
  const { execSync } = require('child_process');
  try {
    const response = execSync('curl -s http://localhost:9222/json/version', { encoding: 'utf-8' });
    const versionInfo = JSON.parse(response);
    console.log(`✅ Chrome検出: ${versionInfo.Browser}`);
  } catch (error) {
    console.error('\n❌ エラー: Chromeのデバッグポートに接続できません');
    console.error('💡 以下を確認してください:');
    console.error('   1. Chromeが完全に閉じられている');
    console.error('   2. 上記のコマンドでChromeを起動した');
    console.error('   3. エラーメッセージが出ていない\n');
    console.error('🔄 Chromeを再起動してから、もう一度このスクリプトを実行してください。');
    process.exit(1);
  }

  try {
    console.log('\n🔌 Chromeに接続中...');
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    console.log('✅ Chrome接続成功！');

    const contexts = browser.contexts();
    if (contexts.length === 0) {
      console.error('❌ ブラウザコンテキストが見つかりません');
      return;
    }

    const context = contexts[0];
    const pages = context.pages();

    if (pages.length === 0) {
      console.error('❌ 開いているページが見つかりません');
      return;
    }

    const page = pages[0];
    console.log(`📄 現在のページ: ${page.url()}`);

    // WEBRIDGEのページかどうか確認
    if (!page.url().includes('webridge.net')) {
      console.log('\n⚠️  WEBRIDGEのページではありません。');
      console.log('📌 Chromeで https://webridge.net にアクセスしてログインしてください。');
      console.log('⏳ 準備ができたらEnterキーを押してください...');
      await new Promise(resolve => {
        process.stdin.once('data', () => resolve(null));
      });
    }

    console.log(`\n📍 現在のURL: ${page.url()}`);

    // 日別レポートページに移動
    console.log('\n📊 日別レポートページに移動中...');
    await page.goto('https://webridge.net/publisher/report?reportType=DAILY', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/webridge-connected-daily-report.png', fullPage: true });
    console.log('📸 スクリーンショット保存: webridge-connected-daily-report.png');

    console.log(`✅ 日別レポートページ: ${page.url()}`);

    // ページ構造を確認
    const tables = await page.locator('table').count();
    const buttons = await page.locator('button').count();

    console.log(`\nページ要素:`);
    console.log(`  - テーブル数: ${tables}`);
    console.log(`  - ボタン数: ${buttons}`);

    if (tables > 0) {
      console.log('\n📊 テーブルが見つかりました！データ取得を実装できます。');

      // テーブルのヘッダーを確認
      const headers = await page.locator('table th').allTextContents();
      console.log('\nテーブルヘッダー:');
      headers.forEach((header, i) => {
        if (header.trim()) {
          console.log(`  ${i + 1}. ${header.trim()}`);
        }
      });
    }

    console.log('\n✅ 接続テスト完了！');
    console.log('💡 次は、このページからデータを取得する処理を実装します。');

    await browser.close();

  } catch (error: any) {
    if (error.message?.includes('ECONNREFUSED')) {
      console.error('\n❌ Chromeに接続できませんでした。');
      console.error('💡 Chromeがリモートデバッグモードで起動されているか確認してください。');
    } else {
      console.error('\nエラーが発生しました:', error);
    }
  }
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  });
}

import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔍 DMM サイドバー遅延ロード待機\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });

  const page = await context.newPage();

  try {
    console.log('1️⃣ ログイン処理...\n');
    await page.goto('https://www.dmm.com/my/-/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    await page.fill('input[name="login_id"]', process.env.DMM_USERNAME || '');
    await page.fill('input[name="password"]', process.env.DMM_PASSWORD || '');
    await page.waitForTimeout(1000);
    await page.click('button:has-text("ログイン")');
    await page.waitForTimeout(5000);

    console.log('2️⃣ アフィリエイトページに移動...\n');
    await page.goto('https://affiliate.dmm.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // networkidleまで待つ
    console.log('ネットワークアイドル状態まで待機中...');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.log('networkidle timeout - 続行します');
    });
    await page.waitForTimeout(5000);

    // 年齢確認
    const ageButton = page.locator('button:has-text("はい")');
    if (await ageButton.count() > 0) {
      console.log('✓ 年齢確認クリック\n');
      await ageButton.first().click();
      await page.waitForTimeout(3000);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: 'screenshots/dmm-after-age-confirm.png', fullPage: true });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ページのHTML構造を調査');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // iframe をチェック
    const iframes = await page.locator('iframe').count();
    console.log(`iframe数: ${iframes}\n`);

    // ページ全体のHTMLの一部を出力
    const html = await page.content();
    console.log(`HTML長: ${html.length}文字\n`);

    // 「成果」というテキストがHTML内に存在するか直接検索
    if (html.includes('成果')) {
      console.log('✓ HTML内に「成果」のテキストを発見\n');

      // 「成果」を含む行を抽出
      const lines = html.split('\n');
      const seikaLines = lines.filter(line => line.includes('成果'));
      console.log(`「成果」を含む行数: ${seikaLines.length}\n`);
      console.log('最初の5行:\n');
      seikaLines.slice(0, 5).forEach(line => {
        console.log(line.trim().substring(0, 200));
      });
    } else {
      console.log('⚠️ HTML内に「成果」のテキストが見つかりません\n');
    }

    // ページの全テキストコンテンツを取得
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 ページの全テキストコンテンツ（最初の100行）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const bodyText = await page.locator('body').textContent();
    const textLines = bodyText?.split('\n').filter(l => l.trim().length > 0) || [];
    textLines.slice(0, 100).forEach((line, i) => {
      console.log(`${i + 1}. ${line.trim()}`);
    });

    // 成果を検索
    if (bodyText?.includes('成果')) {
      console.log('\n✓ ページテキストに「成果」を発見');
      const seikaIndex = bodyText.indexOf('成果');
      console.log(`位置: ${seikaIndex}`);
      console.log(`前後のテキスト: ${bodyText.substring(seikaIndex - 50, seikaIndex + 100)}`);
    } else {
      console.log('\n⚠️ ページテキストに「成果」が見つかりません');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 サイドバーに関連するクラス名やIDを探索');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // navやasideを探す
    const navs = await page.locator('nav, aside, [role="navigation"]').all();
    console.log(`nav/aside要素数: ${navs.length}\n`);

    for (let i = 0; i < navs.length; i++) {
      const nav = navs[i];
      const tagName = await nav.evaluate(el => el.tagName);
      const className = await nav.getAttribute('class').catch(() => '');
      const id = await nav.getAttribute('id').catch(() => '');
      const text = await nav.textContent().catch(() => '');

      console.log(`${i + 1}. ${tagName}`);
      console.log(`   class: ${className}`);
      console.log(`   id: ${id}`);
      console.log(`   テキスト長: ${text.length}文字`);
      if (text.includes('成果')) {
        console.log(`   ✓ 「成果」を含む！`);
        console.log(`   テキスト: ${text.substring(0, 500)}`);
      }
      console.log('');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏸️ ブラウザで手動確認してください');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('サイドバーに「成果報告」が表示されていますか？\n');
    console.log('Enterキーで終了...\n');

    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });

    await browser.close();

  } catch (error) {
    console.error('\n❌ エラー発生:', error);
    await browser.close();
  }
}

main();

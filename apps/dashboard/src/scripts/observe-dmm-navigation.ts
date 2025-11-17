import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔍 DMMアフィリエイト ナビゲーション観察モード\n');
  console.log('認証情報:');
  console.log(`  Email: ${process.env.DMM_USERNAME}`);
  console.log(`  Password: ${process.env.DMM_PASSWORD?.substring(0, 3)}...`);
  console.log('');

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

  // URL履歴を記録
  let urlHistory: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const url = frame.url();
      if (url !== urlHistory[urlHistory.length - 1]) {
        console.log(`\n📍 ${url}`);
        urlHistory.push(url);
      }
    }
  });

  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ ログイン処理');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await page.goto('https://www.dmm.com/my/-/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    await page.fill('input[name="login_id"]', process.env.DMM_USERNAME || '');
    await page.fill('input[name="password"]', process.env.DMM_PASSWORD || '');
    await page.waitForTimeout(1000);

    await page.click('button:has-text("ログイン")');
    console.log('ログインボタンクリック完了');
    await page.waitForTimeout(5000);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('2️⃣ アフィリエイトページに移動');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await page.goto('https://affiliate.dmm.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    // 年齢確認
    const ageButton = page.locator('button:has-text("はい")');
    if (await ageButton.count() > 0) {
      console.log('年齢確認クリック...');
      await ageButton.first().click();
      await page.waitForTimeout(3000);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('3️⃣ ページ内のナビゲーションリンクを確認');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // メニューやリンクを探す
    const allLinks = await page.locator('a').all();
    console.log(`全リンク数: ${allLinks.length}\n`);

    const relevantLinks = [];
    for (const link of allLinks) {
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text && (
        text.includes('レポート') ||
        text.includes('報酬') ||
        text.includes('成果') ||
        text.includes('データ') ||
        text.includes('統計')
      )) {
        relevantLinks.push({ text: text.trim(), href });
      }
    }

    console.log('📋 レポート関連のリンク:\n');
    relevantLinks.forEach((link, index) => {
      console.log(`  ${index + 1}. "${link.text}"`);
      console.log(`     → ${link.href}`);
      console.log('');
    });

    if (relevantLinks.length === 0) {
      console.log('⚠️ レポート関連のリンクが見つかりません\n');
      console.log('ページの主要なテキスト:\n');
      const bodyText = await page.locator('body').textContent();
      const lines = bodyText?.split('\n').filter(line => line.trim().length > 0) || [];
      lines.slice(0, 30).forEach(line => console.log(`  ${line.trim()}`));
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👆 ブラウザでレポートページに手動で移動してください');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('レポートページに移動したら、このターミナルに戻ってEnterキーを押してください\n');

    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣ レポートページの構造を分析');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const currentUrl = page.url();
    console.log(`現在のURL: ${currentUrl}\n`);

    // テーブルを探す
    const tables = await page.locator('table').count();
    console.log(`テーブル数: ${tables}`);

    // フォームを探す
    const forms = await page.locator('form').count();
    console.log(`フォーム数: ${forms}`);

    // 日付選択要素を探す
    const dateSelectors = await page.locator('input[type="date"], select[name*="date"], select[name*="year"], select[name*="month"]').count();
    console.log(`日付選択要素数: ${dateSelectors}\n`);

    if (dateSelectors > 0) {
      console.log('日付選択要素の詳細:\n');
      const allDateInputs = await page.locator('input[type="date"], select[name*="date"], select[name*="year"], select[name*="month"]').all();
      for (let i = 0; i < allDateInputs.length; i++) {
        const input = allDateInputs[i];
        const name = await input.getAttribute('name').catch(() => '?');
        const id = await input.getAttribute('id').catch(() => '?');
        const type = await input.evaluate(el => el.tagName);
        console.log(`  ${i + 1}. ${type}, name="${name}", id="${id}"`);
      }
      console.log('');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 URL遷移履歴:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    urlHistory.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏸️ Enterキーでブラウザを閉じます...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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

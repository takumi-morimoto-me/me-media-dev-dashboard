import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔍 DMM年齢確認モーダルの確認\n');

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
    console.log('1️⃣ ログインページにアクセス...');
    await page.goto('https://www.dmm.com/my/-/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    console.log('2️⃣ ログイン情報を入力...');
    await page.fill('input[name="login_id"]', process.env.DMM_USERNAME || '');
    await page.fill('input[name="password"]', process.env.DMM_PASSWORD || '');
    await page.waitForTimeout(1000);

    console.log('3️⃣ ログインボタンをクリック...');
    await page.click('button:has-text("ログイン")');
    await page.waitForTimeout(5000);

    console.log(`\n現在のURL: ${page.url()}\n`);

    console.log('4️⃣ アフィリエイトページに移動...');
    await page.goto('https://affiliate.dmm.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    console.log(`\n現在のURL: ${page.url()}\n`);

    // 年齢確認モーダルを探す
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 年齢確認モーダルを探しています...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // モーダルやオーバーレイを探す
    const modals = await page.locator('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]').all();
    console.log(`モーダル要素数: ${modals.length}\n`);

    for (let i = 0; i < modals.length; i++) {
      const modal = modals[i];
      const text = await modal.textContent().catch(() => '');
      const isVisible = await modal.isVisible().catch(() => false);
      console.log(`モーダル ${i + 1}:`);
      console.log(`  表示: ${isVisible}`);
      console.log(`  テキスト: ${text.substring(0, 100)}...`);
      console.log('');
    }

    // 「はい」ボタンを探す
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔘 「はい」ボタンを探しています...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allButtons = await page.locator('button, a[role="button"], input[type="button"]').all();
    console.log(`全ボタン数: ${allButtons.length}\n`);

    let foundAgeButton = false;
    for (let i = 0; i < allButtons.length; i++) {
      const button = allButtons[i];
      const text = await button.textContent().catch(() => '');
      const isVisible = await button.isVisible().catch(() => false);

      if (text.includes('はい') || text.includes('18') || text.includes('年齢')) {
        console.log(`ボタン ${i + 1}:`);
        console.log(`  テキスト: "${text.trim()}"`);
        console.log(`  表示: ${isVisible}`);

        const tagName = await button.evaluate(el => el.tagName);
        const className = await button.getAttribute('class').catch(() => '');
        const id = await button.getAttribute('id').catch(() => '');

        console.log(`  タグ: ${tagName}`);
        console.log(`  class: ${className}`);
        console.log(`  id: ${id}`);
        console.log('');

        if (isVisible && text.includes('はい')) {
          foundAgeButton = true;
          console.log('🎯 このボタンをクリックしてみます...\n');

          try {
            await button.click({ timeout: 5000 });
            await page.waitForTimeout(3000);
            console.log('✅ クリック成功！');
            console.log(`現在のURL: ${page.url()}\n`);
            break;
          } catch (error: any) {
            console.log(`❌ クリック失敗: ${error.message}\n`);
          }
        }
      }
    }

    if (!foundAgeButton) {
      console.log('⚠️ 年齢確認ボタンが見つかりませんでした\n');
      console.log('ページの全テキスト（最初の500文字）:');
      const bodyText = await page.locator('body').textContent();
      console.log(bodyText?.substring(0, 500));
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏸️ Enterキーで終了します...');
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

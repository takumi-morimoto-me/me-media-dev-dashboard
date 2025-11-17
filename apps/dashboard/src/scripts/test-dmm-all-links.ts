import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔍 DMMアフィリエイト 全リンク調査\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
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
    await page.waitForTimeout(3000);

    // 年齢確認
    const ageButton = page.locator('button:has-text("はい")');
    if (await ageButton.count() > 0) {
      console.log('✓ 年齢確認クリック');
      await ageButton.first().click();
      await page.waitForTimeout(3000);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 全リンクのリスト（テキストと URL）');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const allLinks = await page.locator('a').all();
    console.log(`全リンク数: ${allLinks.length}\n`);

    const linkData = [];
    for (let i = 0; i < allLinks.length; i++) {
      const link = allLinks[i];
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');
      const isVisible = await link.isVisible().catch(() => false);

      if (text.trim() || href) {
        linkData.push({
          index: i + 1,
          text: text.trim(),
          href,
          visible: isVisible
        });
      }
    }

    // 表示されているリンクのみフィルタ
    const visibleLinks = linkData.filter(l => l.visible);
    console.log(`表示されているリンク数: ${visibleLinks.length}\n`);

    visibleLinks.forEach((link) => {
      console.log(`${link.index}. "${link.text}"`);
      console.log(`   ${link.href}`);
      console.log('');
    });

    // ナビゲーションバーやヘッダー内のリンクを特定
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧭 ナビゲーションバー内のリンク');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const navLinks = await page.locator('nav a, header a, [role="navigation"] a, [class*="nav"] a, [class*="menu"] a, [class*="header"] a').all();
    console.log(`ナビゲーション内のリンク数: ${navLinks.length}\n`);

    for (let i = 0; i < navLinks.length; i++) {
      const link = navLinks[i];
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');
      const isVisible = await link.isVisible().catch(() => false);

      if (isVisible && (text.trim() || href)) {
        console.log(`${i + 1}. "${text.trim()}"`);
        console.log(`   ${href}`);
        console.log('');
      }
    }

    // スクリーンショット
    await page.screenshot({ path: 'screenshots/dmm-all-links-page.png', fullPage: true });
    console.log('✓ スクリーンショット保存: screenshots/dmm-all-links-page.png\n');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏸️ Enterキーで終了...');
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

import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔍 DMMアフィリエイト サイドバーナビゲーション調査\n');

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
    await page.waitForTimeout(3000);

    // 年齢確認
    const ageButton = page.locator('button:has-text("はい")');
    if (await ageButton.count() > 0) {
      console.log('✓ 年齢確認クリック');
      await ageButton.first().click();
      await page.waitForTimeout(3000);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 サイドバーメニュー項目を探しています...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await page.screenshot({ path: 'screenshots/dmm-before-sidebar-click.png', fullPage: true });

    // サイドバー内の全てのリンクとボタンを探す
    const sidebarLinks = await page.locator('[class*="sidebar"] a, [class*="menu"] a, nav a, aside a').all();
    console.log(`サイドバーリンク数: ${sidebarLinks.length}\n`);

    const menuItems = [];
    for (let i = 0; i < sidebarLinks.length; i++) {
      const link = sidebarLinks[i];
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');
      const isVisible = await link.isVisible().catch(() => false);

      if (text.trim() && isVisible) {
        menuItems.push({ index: i + 1, text: text.trim(), href, link });
        console.log(`${i + 1}. "${text.trim()}"`);
        console.log(`   ${href}`);
        console.log('');
      }
    }

    // 「成果情報」メニューを探してクリック
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 「成果情報」メニューをクリック...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const performanceMenuItem = menuItems.find(item =>
      item.text.includes('成果情報') ||
      item.text.includes('成果') ||
      item.text.includes('レポート')
    );

    if (performanceMenuItem) {
      console.log(`✓ 発見: "${performanceMenuItem.text}"`);
      console.log(`  URL: ${performanceMenuItem.href}\n`);

      await performanceMenuItem.link.click({ timeout: 5000 });
      console.log('✅ クリック完了！\n');
      await page.waitForTimeout(5000);
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      console.log(`現在のURL: ${page.url()}\n`);
      await page.screenshot({ path: 'screenshots/dmm-after-sidebar-click.png', fullPage: true });

      // ページ構造を分析
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 ページ構造分析');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const tables = await page.locator('table').count();
      const forms = await page.locator('form').count();
      const dateInputs = await page.locator('input[type="date"], input[name*="date"], select[name*="date"], select[name*="year"], select[name*="month"]').count();

      console.log(`テーブル数: ${tables}`);
      console.log(`フォーム数: ${forms}`);
      console.log(`日付選択要素数: ${dateInputs}\n`);

      // 主要なテキストを表示
      if (tables > 0) {
        console.log('✓ テーブルを発見！');
        const tableTexts = await page.locator('table').all();
        for (let i = 0; i < Math.min(tableTexts.length, 3); i++) {
          const text = await tableTexts[i].textContent();
          console.log(`\nテーブル ${i + 1}:`);
          console.log(text?.substring(0, 500));
        }
      }

      // ページ内のリンクを確認（タブなどがあるかもしれない）
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔗 ページ内のタブ・リンクを確認');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const allLinks = await page.locator('a').all();
      const relevantLinks = [];

      for (const link of allLinks) {
        const text = await link.textContent().catch(() => '');
        const href = await link.getAttribute('href').catch(() => '');
        const isVisible = await link.isVisible().catch(() => false);

        if (isVisible && text.trim() && (
          text.includes('日次') ||
          text.includes('月次') ||
          text.includes('日別') ||
          text.includes('月別') ||
          text.includes('デイリー') ||
          text.includes('マンスリー') ||
          text.includes('daily') ||
          text.includes('monthly')
        )) {
          relevantLinks.push({ text: text.trim(), href });
        }
      }

      console.log(`日次/月次関連のリンク数: ${relevantLinks.length}\n`);
      relevantLinks.forEach((link, i) => {
        console.log(`${i + 1}. "${link.text}"`);
        console.log(`   ${link.href}`);
        console.log('');
      });

    } else {
      console.log('⚠️ 成果情報メニューが見つかりませんでした\n');

      // 全てのメニュー項目を表示
      console.log('利用可能なメニュー項目:\n');
      menuItems.forEach(item => {
        console.log(`  - ${item.text}`);
      });
    }

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

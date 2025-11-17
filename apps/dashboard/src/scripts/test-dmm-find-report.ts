import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔍 DMMアフィリエイト レポートページ自動検索\n');

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

    console.log('\n3️⃣ レポートページを探しています...\n');

    // ナビゲーションバー、メニュー、ヘッダーを探す
    const navElements = await page.locator('nav, header, [role="navigation"], [class*="nav"], [class*="menu"], [class*="header"]').all();
    console.log(`ナビゲーション要素数: ${navElements.length}\n`);

    // 全てのクリック可能な要素を探す
    const clickableElements = await page.locator('a, button, [role="button"], [class*="link"]').all();
    console.log(`クリック可能な要素数: ${clickableElements.length}\n`);

    const reportRelatedElements = [];
    for (const element of clickableElements) {
      const text = await element.textContent().catch(() => '');
      const ariaLabel = await element.getAttribute('aria-label').catch(() => '');
      const title = await element.getAttribute('title').catch(() => '');
      const combinedText = `${text} ${ariaLabel} ${title}`.toLowerCase();

      if (
        combinedText.includes('レポート') ||
        combinedText.includes('report') ||
        combinedText.includes('統計') ||
        combinedText.includes('成果') ||
        combinedText.includes('実績') ||
        combinedText.includes('売上') ||
        combinedText.includes('データ')
      ) {
        const isVisible = await element.isVisible().catch(() => false);
        const href = await element.getAttribute('href').catch(() => '');

        reportRelatedElements.push({
          text: text.trim(),
          ariaLabel,
          title,
          href,
          visible: isVisible,
          element
        });
      }
    }

    console.log(`📋 レポート関連の要素: ${reportRelatedElements.length}個\n`);

    reportRelatedElements.forEach((item, index) => {
      console.log(`${index + 1}. テキスト: "${item.text}"`);
      if (item.ariaLabel) console.log(`   aria-label: "${item.ariaLabel}"`);
      if (item.title) console.log(`   title: "${item.title}"`);
      if (item.href) console.log(`   href: ${item.href}`);
      console.log(`   表示: ${item.visible}`);
      console.log('');
    });

    // 最も関連性の高い要素をクリック
    let foundReport = false;
    for (const item of reportRelatedElements) {
      if (item.visible && (
        item.text.includes('レポート') ||
        item.text.includes('実績') ||
        item.ariaLabel?.includes('レポート') ||
        item.ariaLabel?.includes('report')
      )) {
        console.log(`\n✓ クリックを試みます: "${item.text || item.ariaLabel}"`);

        try {
          await item.element.click({ timeout: 5000 });
          await page.waitForTimeout(3000);

          const newUrl = page.url();
          console.log(`移動後のURL: ${newUrl}\n`);

          // テーブルやデータがあるか確認
          const tables = await page.locator('table').count();
          const forms = await page.locator('form').count();

          console.log(`テーブル: ${tables}個, フォーム: ${forms}個`);

          if (tables > 0 || forms > 0) {
            console.log('✅ レポートページを発見！\n');
            foundReport = true;
            break;
          }
        } catch (error: any) {
          console.log(`クリック失敗: ${error.message}`);
        }
      }
    }

    if (!foundReport) {
      console.log('\n⚠️ メニューからレポートページが見つかりませんでした');
      console.log('直接URLを試します...\n');

      const reportUrls = [
        'https://affiliate.dmm.com/report/',
        'https://affiliate.dmm.com/reports/',
        'https://affiliate.dmm.com/performance/',
        'https://affiliate.dmm.com/statistics/',
        'https://affiliate.dmm.com/dashboard/',
        'https://affiliate.dmm.com/mypage/',
      ];

      for (const url of reportUrls) {
        try {
          console.log(`試行: ${url}`);
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 10000,
          });
          await page.waitForTimeout(2000);

          const currentUrl = page.url();
          if (currentUrl !== 'https://affiliate.dmm.com/') {
            console.log(`✓ アクセス成功: ${currentUrl}`);

            const tables = await page.locator('table').count();
            const forms = await page.locator('form').count();
            console.log(`  テーブル: ${tables}個, フォーム: ${forms}個`);

            if (tables > 0 || forms > 0) {
              console.log('✅ レポートページを発見！\n');
              foundReport = true;
              break;
            }
          }
        } catch (error) {
          console.log(`  アクセス失敗`);
        }
      }
    }

    if (foundReport) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 レポートページの詳細');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log(`現在のURL: ${page.url()}\n`);

      // ページの主要なテキスト
      const pageText = await page.locator('body').textContent();
      const lines = pageText?.split('\n').filter(l => l.trim().length > 3) || [];
      console.log('ページ内の主要なテキスト（最初の30行）:\n');
      lines.slice(0, 30).forEach(line => console.log(`  ${line.trim()}`));
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

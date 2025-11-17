import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔍 DMM「成果報告」メニュー探索と クリック\n');

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
      console.log('✓ 年齢確認クリック\n');
      await ageButton.first().click();
      await page.waitForTimeout(3000);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 「成果」関連の要素を探しています...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 全ての要素から「成果」を含むテキストを持つものを探す
    const allElements = await page.locator('*').all();
    console.log(`ページ内の全要素数: ${allElements.length}\n`);

    const seikaElements = [];
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];
      const text = await element.textContent().catch(() => '');

      // 「成果」を含み、テキストが短い（メニュー項目らしい）ものを探す
      if (text.includes('成果') && text.length < 50) {
        const isVisible = await element.isVisible().catch(() => false);
        const tagName = await element.evaluate(el => el.tagName).catch(() => '?');
        const className = await element.getAttribute('class').catch(() => '');
        const role = await element.getAttribute('role').catch(() => '');

        if (isVisible) {
          seikaElements.push({
            text: text.trim(),
            tagName,
            className,
            role,
            element
          });
        }
      }
    }

    console.log(`「成果」を含む表示要素: ${seikaElements.length}個\n`);

    seikaElements.forEach((item, index) => {
      console.log(`${index + 1}. テキスト: "${item.text}"`);
      console.log(`   タグ: ${item.tagName}`);
      console.log(`   class: ${item.className}`);
      if (item.role) console.log(`   role: ${item.role}`);
      console.log('');
    });

    // 「成果報告」または「成果情報」を含む要素を探してクリック
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 「成果報告」メニューをクリック...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let clicked = false;
    for (const item of seikaElements) {
      if (item.text === '成果報告' || item.text.includes('成果報告')) {
        console.log(`✓ 発見: "${item.text}" (${item.tagName})`);

        try {
          await item.element.scrollIntoViewIfNeeded().catch(() => {});
          await item.element.click({ timeout: 5000 });
          console.log('✅ クリック成功！\n');
          clicked = true;
          await page.waitForTimeout(5000);
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          break;
        } catch (error: any) {
          console.log(`❌ クリック失敗: ${error.message}`);
          console.log('次の要素を試します...\n');
        }
      }
    }

    if (!clicked) {
      console.log('⚠️ クリック可能な「成果報告」要素が見つかりませんでした\n');

      // テキストベースの検索を試す
      console.log('テキストベースのlocatorで再試行...\n');

      const textLocators = [
        page.locator('text=成果報告'),
        page.locator('text=成果情報'),
        page.getByText('成果報告'),
        page.getByText('成果情報'),
        page.locator('a:has-text("成果報告")'),
        page.locator('button:has-text("成果報告")'),
        page.locator('div:has-text("成果報告")'),
      ];

      for (let i = 0; i < textLocators.length; i++) {
        const locator = textLocators[i];
        const count = await locator.count();

        if (count > 0) {
          console.log(`✓ locator ${i + 1} で ${count}個発見`);

          for (let j = 0; j < count; j++) {
            const element = locator.nth(j);
            const isVisible = await element.isVisible().catch(() => false);
            const text = await element.textContent().catch(() => '');

            console.log(`  ${j + 1}. "${text.trim()}" - 表示: ${isVisible}`);

            if (isVisible && text.trim().length < 50) {
              try {
                await element.click({ timeout: 5000 });
                console.log('  ✅ クリック成功！\n');
                clicked = true;
                await page.waitForTimeout(5000);
                await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
                break;
              } catch (error: any) {
                console.log(`  ❌ クリック失敗: ${error.message}`);
              }
            }
          }

          if (clicked) break;
        }
      }
    }

    if (clicked) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 成果報告ページを分析');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log(`現在のURL: ${page.url()}\n`);
      await page.screenshot({ path: 'screenshots/dmm-seika-page.png', fullPage: true });

      const tables = await page.locator('table').count();
      const forms = await page.locator('form').count();
      const buttons = await page.locator('button').count();

      console.log(`テーブル数: ${tables}`);
      console.log(`フォーム数: ${forms}`);
      console.log(`ボタン数: ${buttons}\n`);

      // ページの主要なテキストを表示
      const bodyText = await page.locator('body').textContent();
      const lines = bodyText?.split('\n').filter(l => l.trim().length > 3) || [];
      console.log('ページ内の主要なテキスト（最初の40行）:\n');
      lines.slice(0, 40).forEach(line => console.log(`  ${line.trim()}`));

      // 日次/月次のタブやボタンを探す
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 日次/月次の切り替え要素を探索');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      const allButtons = await page.locator('button, a, [role="tab"], [role="button"]').all();
      const reportButtons = [];

      for (const button of allButtons) {
        const text = await button.textContent().catch(() => '');
        const isVisible = await button.isVisible().catch(() => false);

        if (isVisible && (
          text.includes('日次') ||
          text.includes('月次') ||
          text.includes('日別') ||
          text.includes('月別') ||
          text.includes('デイリー') ||
          text.includes('マンスリー')
        )) {
          reportButtons.push(text.trim());
        }
      }

      console.log(`日次/月次関連のボタン: ${reportButtons.length}個\n`);
      reportButtons.forEach((text, i) => {
        console.log(`  ${i + 1}. "${text}"`);
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

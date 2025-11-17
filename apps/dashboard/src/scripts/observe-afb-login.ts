import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔍 afbログインフロー観察モード\n');
  console.log('このスクリプトは、手動でログイン操作を行っている間、');
  console.log('URLの遷移とページ構造を記録します。\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });

  const page = await context.newPage();

  // URL変更を監視
  let urlHistory: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const url = frame.url();
      if (!urlHistory.includes(url)) {
        console.log(`\n📍 ページ遷移: ${url}`);
        urlHistory.push(url);
      }
    }
  });

  try {
    console.log('1️⃣ トップページにアクセス中...\n');
    await page.goto('https://www.afi-b.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👆 ブラウザでログインボタンをクリックしてください');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ログインリンクを全て表示
    const allLinks = await page.locator('a').all();
    console.log('📋 ページ内の「ログイン」関連リンク:\n');

    let loginLinkIndex = 0;
    for (const link of allLinks) {
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text && (text.includes('ログイン') || text.includes('パートナー'))) {
        loginLinkIndex++;
        console.log(`  ${loginLinkIndex}. テキスト: "${text.trim()}"`);
        console.log(`     URL: ${href}`);
        console.log('');
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏸️  ログインページが開くまで待機中...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // URLがloginを含むページに遷移するまで待機（最大60秒）
    let loginPageReached = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      const currentUrl = page.url();

      if (currentUrl.includes('login') && !currentUrl.includes('failedlogin')) {
        console.log(`\n✅ ログインページ検出: ${currentUrl}\n`);
        loginPageReached = true;
        break;
      }
    }

    if (loginPageReached) {
      await page.waitForTimeout(2000);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📝 ログインページの構造を分析中...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // フォームフィールドを確認
      const inputs = await page.locator('input').all();
      console.log(`🔍 入力フィールド数: ${inputs.length}\n`);

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const type = await input.getAttribute('type').catch(() => '?');
        const name = await input.getAttribute('name').catch(() => '?');
        const id = await input.getAttribute('id').catch(() => '?');
        const placeholder = await input.getAttribute('placeholder').catch(() => '?');
        const isVisible = await input.isVisible().catch(() => false);

        console.log(`  ${i + 1}. type="${type}", name="${name}", id="${id}"`);
        console.log(`     placeholder="${placeholder}", visible=${isVisible}`);
        console.log('');
      }

      // ログインボタンを確認
      const buttons = await page.locator('button, input[type="submit"]').all();
      console.log(`🔘 ボタン数: ${buttons.length}\n`);

      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const text = await button.textContent().catch(() => '');
        const value = await button.getAttribute('value').catch(() => '?');
        const type = await button.getAttribute('type').catch(() => '?');
        const isVisible = await button.isVisible().catch(() => false);

        console.log(`  ${i + 1}. text="${text.trim()}", value="${value}", type="${type}"`);
        console.log(`     visible=${isVisible}`);
        console.log('');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🤖 自動ログインを試みます...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // 表示されているログインフィールドを探す
      const visibleLoginInputs = [];
      for (const input of inputs) {
        const name = await input.getAttribute('name').catch(() => '');
        const isVisible = await input.isVisible();
        if ((name === 'login_name' || name?.includes('login') || name?.includes('user')) && isVisible) {
          visibleLoginInputs.push(input);
        }
      }

      if (visibleLoginInputs.length > 0) {
        console.log(`✓ 表示されているログインフィールド: ${visibleLoginInputs.length}個`);

        // 最初の表示されているフィールドに入力
        await visibleLoginInputs[0].fill(process.env.AFB_USERNAME || '');
        console.log('✓ ログインID入力完了');
        await page.waitForTimeout(1000);

        // パスワードフィールド
        const visiblePasswordInputs = [];
        for (const input of inputs) {
          const type = await input.getAttribute('type').catch(() => '');
          const isVisible = await input.isVisible();
          if (type === 'password' && isVisible) {
            visiblePasswordInputs.push(input);
          }
        }

        if (visiblePasswordInputs.length > 0) {
          await visiblePasswordInputs[0].fill(process.env.AFB_PASSWORD || '');
          console.log('✓ パスワード入力完了');
          await page.waitForTimeout(1000);

          // 表示されているSubmitボタンを探す
          const visibleSubmitButtons = [];
          for (const button of buttons) {
            const isVisible = await button.isVisible();
            const type = await button.getAttribute('type').catch(() => '');
            if (isVisible && type === 'submit') {
              visibleSubmitButtons.push(button);
            }
          }

          if (visibleSubmitButtons.length > 0) {
            console.log('\n🚀 ログインボタンをクリック...');
            await visibleSubmitButtons[0].click();
            await page.waitForTimeout(5000);

            const finalUrl = page.url();
            console.log(`\n最終URL: ${finalUrl}`);

            if (finalUrl.includes('failedlogin')) {
              console.log('\n❌ 自動ログイン失敗');
            } else if (finalUrl.includes('partner') && !finalUrl.includes('login')) {
              console.log('\n✅ 自動ログイン成功！');
            } else {
              console.log('\n⚠️  不明な状態');
            }
          }
        }
      } else {
        console.log('⚠️  表示されているログインフィールドが見つかりません');
      }
    } else {
      console.log('\n⏰ タイムアウト: ログインページに遷移しませんでした');
    }

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 URL遷移履歴:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    urlHistory.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏸️  Enterキーで終了します...');
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

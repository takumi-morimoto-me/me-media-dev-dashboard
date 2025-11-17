import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔐 afb直接ログインテスト\n');
  console.log('認証情報:');
  console.log(`  Username: ${process.env.AFB_USERNAME}`);
  console.log(`  Password: ${process.env.AFB_PASSWORD?.substring(0, 3)}...`);
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

  try {
    // 試すべきログインURL
    const loginUrls = [
      'https://p.afi-b.com/login',
      'https://www.afi-b.com/general/partner/login',
      'https://www.afi-b.com/partner/login',
    ];

    let successUrl: string | null = null;

    for (const url of loginUrls) {
      console.log(`\n🔗 試行中: ${url}`);

      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        console.log(`   現在のURL: ${currentUrl}`);

        // failedloginにリダイレクトされていないかチェック
        if (!currentUrl.includes('failedlogin')) {
          // ログインフォームがあるか確認
          const loginInput = await page.locator('input[name="login_name"]').count();
          const passwordInput = await page.locator('input[type="password"]').count();

          if (loginInput > 0 && passwordInput > 0) {
            console.log(`   ✅ ログインページ発見！`);
            successUrl = url;
            break;
          }
        } else {
          console.log(`   ❌ failedloginにリダイレクトされました`);
        }
      } catch (error: any) {
        console.log(`   ❌ アクセス失敗: ${error.message}`);
      }
    }

    if (!successUrl) {
      console.log('\n❌ 有効なログインページが見つかりませんでした');
      console.log('👁️  ブラウザを確認してください（60秒後に自動終了）');
      await page.waitForTimeout(60000);
      await browser.close();
      return;
    }

    console.log(`\n✅ 有効なログインURL: ${successUrl}`);
    console.log('\n📋 ページ構造を確認中...\n');

    // フォームの構造を確認
    const inputs = await page.locator('input').all();
    console.log(`入力フィールド数: ${inputs.length}`);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type').catch(() => '?');
      const name = await input.getAttribute('name').catch(() => '?');
      const id = await input.getAttribute('id').catch(() => '?');
      const isVisible = await input.isVisible().catch(() => false);
      console.log(`  ${i + 1}. type="${type}", name="${name}", id="${id}", visible=${isVisible}`);
    }

    console.log('\n🔑 ログイン情報を入力します...\n');

    // 表示されているログインフィールドを探す
    const visibleLoginInput = page.locator('input[name="login_name"]').filter({ hasText: '' });
    const allLoginInputs = await page.locator('input[name="login_name"]').all();

    let targetLoginInput = null;
    for (const input of allLoginInputs) {
      const isVisible = await input.isVisible();
      if (isVisible) {
        targetLoginInput = input;
        console.log('✓ 表示されているログインフィールドを発見');
        break;
      }
    }

    if (!targetLoginInput) {
      console.log('⚠️ 表示されているフィールドがありません。force: trueで入力を試みます');
      targetLoginInput = page.locator('input[name="login_name"]').first();
    }

    // ログインID入力
    await targetLoginInput.fill(process.env.AFB_USERNAME || '', { force: true });
    console.log('✓ ログインID入力完了');
    await page.waitForTimeout(1000);

    // パスワード入力
    const allPasswordInputs = await page.locator('input[type="password"]').all();
    let targetPasswordInput = null;

    for (const input of allPasswordInputs) {
      const isVisible = await input.isVisible();
      if (isVisible) {
        targetPasswordInput = input;
        console.log('✓ 表示されているパスワードフィールドを発見');
        break;
      }
    }

    if (!targetPasswordInput) {
      console.log('⚠️ 表示されているパスワードフィールドがありません。force: trueで入力を試みます');
      targetPasswordInput = page.locator('input[type="password"]').first();
    }

    await targetPasswordInput.fill(process.env.AFB_PASSWORD || '', { force: true });
    console.log('✓ パスワード入力完了');
    await page.waitForTimeout(2000);

    console.log('\n🚀 ログインボタンをクリックします...');

    // ログインボタンを探す
    const submitButtons = await page.locator('input[type="submit"], button[type="submit"]').all();
    console.log(`\nSubmitボタン数: ${submitButtons.length}`);

    let clickedButton = false;
    for (let i = 0; i < submitButtons.length; i++) {
      const button = submitButtons[i];
      const isVisible = await button.isVisible();
      const value = await button.getAttribute('value').catch(() => '');
      console.log(`  ${i + 1}. visible=${isVisible}, value="${value}"`);

      if (isVisible && i === 0) {
        console.log(`  → 最初の表示ボタンをクリック`);
        await button.click({ force: true });
        clickedButton = true;
        break;
      }
    }

    if (!clickedButton) {
      console.log('⚠️ ボタンクリック失敗。Enterキーで送信を試みます');
      await targetPasswordInput.press('Enter');
    }

    console.log('\n⏳ ログイン処理を待機中...');
    await page.waitForTimeout(5000);

    const finalUrl = page.url();
    console.log(`\n最終URL: ${finalUrl}`);

    if (finalUrl.includes('failedlogin')) {
      console.log('\n❌ ログイン失敗\n');

      // エラーメッセージを確認
      const errorMessages = await page.locator('.error, .alert, [class*="error"], [class*="alert"]').allTextContents();
      if (errorMessages.length > 0) {
        console.log('エラーメッセージ:');
        errorMessages.forEach(msg => console.log(`  - ${msg.trim()}`));
      }

      console.log('\nページ内容（最初の500文字）:');
      const bodyText = await page.locator('body').textContent();
      console.log(bodyText?.substring(0, 500));
    } else if (finalUrl.includes('partner') && !finalUrl.includes('login')) {
      console.log('\n✅ ログイン成功！\n');
    } else {
      console.log('\n⚠️ 不明な状態\n');
    }

    console.log('\n👁️  ブラウザを確認してください');
    console.log('📝 認証情報が正しいか、追加の認証ステップがないか確認してください');
    console.log('\n⏸️  Enterキーで終了します...');

    // ユーザー入力待ち
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

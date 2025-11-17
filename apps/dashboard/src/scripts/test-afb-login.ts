import { chromium } from 'playwright';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  console.log('🔐 afbログインテスト開始\n');
  console.log('認証情報:');
  console.log(`  Username: ${process.env.AFB_USERNAME}`);
  console.log(`  Password: ${process.env.AFB_PASSWORD?.substring(0, 3)}...`);
  console.log('');

  const browser = await chromium.launch({
    headless: false, // ブラウザを表示
    slowMo: 1000, // 操作を遅くして確認しやすく
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  });

  const page = await context.newPage();

  try {
    console.log('1️⃣ トップページにアクセス中...');
    await page.goto('https://www.afi-b.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    console.log('2️⃣ ログインボタンを探しています...');

    // ログインリンクを探す
    const loginLinks = await page.locator('a, button').all();
    let loginFound = false;

    for (const link of loginLinks) {
      const text = await link.textContent().catch(() => '');
      if (text && text.includes('ログイン') && text.length < 20) {
        console.log(`   ✓ ログインリンク発見: "${text.trim()}"`);
        await link.click();
        loginFound = true;
        break;
      }
    }

    if (!loginFound) {
      console.log('   ⚠️ ログインリンクが見つかりません。直接ログインページへ...');
      await page.goto('https://p.afi-b.com/login', {
        waitUntil: 'domcontentloaded',
      });
    }

    await page.waitForTimeout(3000);
    console.log(`\n現在のURL: ${page.url()}`);

    console.log('\n3️⃣ ログインフォームを確認中...');

    // フォームの構造を確認
    const inputs = await page.locator('input').all();
    console.log(`\n入力フィールド数: ${inputs.length}`);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type').catch(() => 'unknown');
      const name = await input.getAttribute('name').catch(() => 'unknown');
      const id = await input.getAttribute('id').catch(() => 'unknown');
      const placeholder = await input.getAttribute('placeholder').catch(() => '');
      console.log(`  ${i + 1}. type="${type}", name="${name}", id="${id}", placeholder="${placeholder}"`);
    }

    console.log('\n4️⃣ ログイン情報を入力します...');
    console.log('👁️  ブラウザで動作を確認してください\n');

    // ログインID入力
    const loginInput = page.locator('input[name="login_name"]').first();
    await loginInput.waitFor({ state: 'visible', timeout: 10000 });
    await loginInput.fill(process.env.AFB_USERNAME || '', { force: true });
    console.log('   ✓ ログインID入力完了');
    await page.waitForTimeout(1000);

    // パスワード入力
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(process.env.AFB_PASSWORD || '', { force: true });
    console.log('   ✓ パスワード入力完了');
    await page.waitForTimeout(2000);

    console.log('\n5️⃣ Enterキーでログインを試みます...');
    await passwordInput.press('Enter');

    console.log('\n⏳ ログイン処理を待機中...');
    await page.waitForTimeout(5000);

    const finalUrl = page.url();
    console.log(`\n最終URL: ${finalUrl}`);

    if (finalUrl.includes('failedlogin')) {
      console.log('\n❌ ログイン失敗');
      console.log('\nページの内容:');
      const bodyText = await page.locator('body').textContent();
      console.log(bodyText?.substring(0, 500));
    } else if (finalUrl.includes('partner')) {
      console.log('\n✅ ログイン成功！');
    } else {
      console.log('\n⚠️  不明な状態');
    }

    console.log('\n\n👁️  ブラウザを確認してください。');
    console.log('📝 何か問題があれば、ブラウザの画面を確認してエラーメッセージを見てください。');
    console.log('\n⏸️  Ctrl+Cで終了します...');

    // 無限待機（手動で終了するまで）
    await new Promise(() => {});

  } catch (error) {
    console.error('\n❌ エラー発生:', error);
  } finally {
    // ブラウザは自動では閉じない
  }
}

main();

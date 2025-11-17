import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DmmCredentials {
  username: string;
  password: string;
}

interface DailyData {
  date: string;
  confirmedRevenue: string;
}

interface ScraperConfig {
  headless?: boolean;
  startYearMonth?: string; // YYYYMM format
  endYearMonth?: string; // YYYYMM format
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

export class DmmDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: DmmCredentials;
  private config: ScraperConfig;

  constructor(credentials: DmmCredentials, config: ScraperConfig) {
    this.credentials = credentials;
    this.config = config;
  }

  async initialize() {
    console.log('🚀 ブラウザを起動しています...');
    this.browser = await chromium.launch({
      headless: this.config.headless ?? false,
      slowMo: this.config.headless ? 0 : 500,
    });

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });

    this.page = await context.newPage();
    console.log('✅ ブラウザ起動完了');
  }

  async login() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('🔐 DMMアフィリエイトにログイン中...');

    // DMMアカウントのログインページに直接移動
    const loginUrl = 'https://accounts.dmm.com/service/login/password/=/path=https%3A%2F%2Faffiliate.dmm.com%2F';
    await this.page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(2000);
    await this.screenshot('dmm-login-page.png');

    // ページのHTML構造を確認
    console.log('ページのHTML構造を確認中...');
    const pageContent = await this.page.evaluate(() => document.body.innerText);
    console.log('ページテキスト:', pageContent.substring(0, 500));

    // 全ての入力フィールドを確認
    const allInputs = await this.page.locator('input').count();
    console.log(`全入力フィールド数: ${allInputs}`);

    // 各入力フィールドの詳細を表示
    for (let i = 0; i < allInputs && i < 10; i++) {
      const input = this.page.locator('input').nth(i);
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`  入力${i + 1}: type="${type}", name="${name}", id="${id}", placeholder="${placeholder}"`);
    }

    // ログインフォームを探す
    console.log('\nログインフォームを探しています...');

    // より広範なセレクタで探す
    const textInputs = await this.page.locator('input:not([type="hidden"]):not([type="submit"]):not([type="button"])').count();
    const passwordInputs = await this.page.locator('input[type="password"]').count();
    console.log(`テキスト入力フィールド数: ${textInputs}`);
    console.log(`パスワード入力フィールド数: ${passwordInputs}`);

    if (textInputs === 0 || passwordInputs === 0) {
      console.log('⚠️ ログインフォームが見つかりません。ページURLを確認:', this.page.url());

      // リンクやボタンを探す
      const loginLinks = await this.page.locator('a:has-text("ログイン"), a:has-text("sign in"), button:has-text("ログイン")').count();
      console.log(`ログインリンク/ボタン数: ${loginLinks}`);

      if (loginLinks > 0) {
        console.log('ログインリンクをクリックします');
        await this.page.locator('a:has-text("ログイン"), a:has-text("sign in"), button:has-text("ログイン")').first().click();
        await this.page.waitForTimeout(3000);
        await this.screenshot('dmm-after-login-click.png');
      }
    }

    // 再度入力フィールドを確認
    const loginInputs = await this.page.locator('input[type="text"], input[type="email"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="password"])').count();
    console.log(`ログイン入力フィールド数（再確認）: ${loginInputs}`);

    if (loginInputs > 0) {
      // ログインIDを入力
      const loginInput = this.page.locator('input[type="email"], input[name="login_id"]').first();
      await loginInput.fill(this.credentials.username);
      console.log('ログインID入力完了');
      await this.page.waitForTimeout(500);

      // パスワードを入力
      await this.page.fill('input[type="password"]', this.credentials.password);
      console.log('パスワード入力完了');
      await this.page.waitForTimeout(500);

      // ログインボタンを探してクリック
      const loginButtons = await this.page.locator('button:has-text("ログイン"), input[type="submit"]').count();
      console.log(`ログインボタン数: ${loginButtons}`);

      if (loginButtons > 0) {
        // ナビゲーション完了を待ちながらログインボタンをクリック
        console.log('ログインボタンをクリック中...');
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => console.log('ナビゲーション待機タイムアウト')),
          this.page.locator('button:has-text("ログイン"), input[type="submit"]').first().click()
        ]);
        console.log('ログインボタンクリック完了');
        await this.page.waitForTimeout(3000);
      } else {
        throw new Error('ログインボタンが見つかりません');
      }
    } else {
      throw new Error('ログイン入力フィールドが見つかりません');
    }

    await this.screenshot('dmm-after-login.png');
    console.log(`ログイン後のURL: ${this.page.url()}`);

    // アフィリエイトページに遷移
    console.log('アフィリエイトページに移動中...');
    await this.page.goto('https://affiliate.dmm.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await this.page.waitForTimeout(3000);

    // 年齢確認モーダルを処理（より確実な方法）
    console.log('年齢確認モーダルを確認中...');
    try {
      // 「はい」ボタンが表示されるまで最大10秒待つ
      const ageButton = this.page.locator('button:has-text("はい")');
      const buttonCount = await ageButton.count();

      if (buttonCount > 0) {
        console.log(`✓ 年齢確認ボタンを発見（${buttonCount}個）`);

        // ボタンが表示されるまで待つ
        await ageButton.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
          console.log('⚠️ ボタンの表示待機タイムアウト');
        });

        // クリック可能になるまで待つ
        const isVisible = await ageButton.first().isVisible().catch(() => false);
        if (isVisible) {
          console.log('年齢確認「はい」をクリック中...');
          await ageButton.first().click({ timeout: 5000 });
          console.log('✅ 年齢確認クリック完了');
          await this.page.waitForTimeout(3000);
        } else {
          console.log('⚠️ 年齢確認ボタンが表示されていません');
        }
      } else {
        console.log('✓ 年齢確認モーダルは表示されていません');
      }
    } catch (error: any) {
      console.log(`⚠️ 年齢確認処理エラー: ${error.message}`);
      // エラーでも続行
    }

    // その他のモーダルやオーバーレイを閉じる
    console.log('その他のモーダルを確認中...');
    const closeButtons = await this.page.locator('button:has-text("閉じる"), button:has-text("×"), button[aria-label="Close"], button[class*="close"]').count();
    if (closeButtons > 0) {
      console.log('モーダルを閉じます');
      try {
        await this.page.locator('button:has-text("閉じる"), button:has-text("×"), button[aria-label="Close"]').first().click({ timeout: 3000 });
        await this.page.waitForTimeout(1000);
      } catch (error) {
        console.log('モーダルを閉じられませんでした（続行します）');
      }
    }

    await this.screenshot('dmm-affiliate-top.png');

    console.log('✅ ログイン処理完了');
    console.log(`現在のURL: ${this.page.url()}`);
  }

  async navigateToDailyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日次レポートページに移動中...');

    // まずマイページに移動して年齢確認を済ませる
    await this.page.goto('https://affiliate.dmm.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    await this.page.waitForTimeout(2000);

    // 年齢確認を処理
    const ageButton = this.page.locator('button:has-text("はい")').first();
    if (await ageButton.count() > 0) {
      console.log('年齢確認を処理中...');
      await ageButton.click();
      await this.page.waitForTimeout(2000);
    }

    // DMM アフィリエイトの日別レポートURLに直接移動
    // 通常のレポートページURL構造を試す
    const reportUrls = [
      'https://affiliate.dmm.com/report/top/',
      'https://affiliate.dmm.com/affiliate/report/daily/',
      'https://affiliate.dmm.com/report/daily/',
      'https://affiliate.dmm.com/partner/report/daily/',
    ];

    let navigationSuccess = false;
    for (const url of reportUrls) {
      try {
        console.log(`URLを試行中: ${url}`);
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        await this.page.waitForTimeout(2000);

        console.log(`  現在のURL: ${this.page.url()}`);

        // 年齢確認ページの処理
        const ageVerificationButton = this.page.locator('button:has-text("はい")').first();
        if (await ageVerificationButton.count() > 0) {
          console.log('  年齢確認ページを検出。「はい」をクリック');
          await ageVerificationButton.click();
          await this.page.waitForTimeout(2000);
          console.log(`  クリック後のURL: ${this.page.url()}`);
        }

        // 直接JavaScriptでナビゲート
        console.log('  JavaScriptで/report/top/に移動中...');
        await this.page.evaluate(() => {
          window.location.href = '/report/top/';
        });
        await this.page.waitForTimeout(3000);
        console.log(`  移動後のURL: ${this.page.url()}`);

        // ページにテーブルまたはレポートコンテンツがあるかチェック
        const hasTables = await this.page.locator('table').count() > 0;
        const hasForm = await this.page.locator('form').count() > 0;
        const hasButtons = await this.page.locator('button').count() > 0;

        console.log(`  テーブル: ${hasTables}, フォーム: ${hasForm}, ボタン: ${hasButtons}`);

        if (hasTables || hasForm || hasButtons) {
          console.log(`✅ レポートページを発見: ${url}`);
          await this.screenshot(`dmm-report-found-${reportUrls.indexOf(url)}.png`);
          navigationSuccess = true;
          break;
        }
      } catch (error: any) {
        console.log(`⚠️ ${url} へのアクセス失敗: ${error.message}`);
        continue;
      }
    }

    if (!navigationSuccess) {
      console.log('⚠️ 直接URLでのアクセスに失敗。メニューから探します...');

      // トップページに戻る
      await this.page.goto('https://affiliate.dmm.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await this.page.waitForTimeout(2000);

      // モーダルを閉じる
      try {
        const closeBtn = this.page.locator('button:has-text("閉じる"), button:has-text("×"), button[aria-label="Close"]').first();
        if (await closeBtn.count() > 0) {
          await closeBtn.click({ timeout: 2000 });
          await this.page.waitForTimeout(1000);
        }
      } catch (error) {
        // モーダルがない場合は無視
      }

      // ページ内のすべてのリンクを調査
      console.log('\nページ内の全リンクを調査中...');
      const allLinks = await this.page.locator('a').evaluateAll(links =>
        links.map(link => ({
          text: link.textContent?.trim() || '',
          href: link.getAttribute('href') || ''
        })).filter(l => l.text.length > 0)
      );

      console.log('利用可能なリンク:');
      allLinks.forEach(link => {
        if (link.text.includes('レポート') || link.text.includes('統計') ||
            link.text.includes('報酬') || link.text.includes('実績') ||
            link.text.includes('日別') || link.href.includes('report')) {
          console.log(`  - ${link.text}: ${link.href}`);
        }
      });

      // レポートメニューを探す
      const reportLinks = await this.page.locator('a:has-text("レポート"), a:has-text("統計"), a:has-text("報酬"), a:has-text("実績")').count();
      console.log(`\nレポート関連リンク数: ${reportLinks}`);

      if (reportLinks > 0) {
        // 「日別」や「日次」を含むリンクを優先的にクリック
        const dailyLink = this.page.locator('a:has-text("日別"), a:has-text("日次"), a:has-text("Daily")').first();
        const dailyLinkExists = await dailyLink.count() > 0;

        if (dailyLinkExists) {
          console.log('日別レポートリンクをクリック');
          await dailyLink.click({ force: true });
        } else {
          // レポートメニューをクリック（force: trueで強制クリック）
          console.log('レポートメニューをクリック');
          await this.page.locator('a:has-text("レポート"), a:has-text("統計"), a:has-text("報酬"), a:has-text("実績")').first().click({ force: true });
          await this.page.waitForTimeout(2000);

          // サブメニューから日別レポートを探す
          const subMenuDaily = this.page.locator('a:has-text("日別"), a:has-text("日次"), a:has-text("Daily")').first();
          if (await subMenuDaily.count() > 0) {
            await subMenuDaily.click({ force: true });
          }
        }
      } else {
        console.log('⚠️ レポートメニューが見つかりません');
        // 直接report URLを試す
        const reportPath = allLinks.find(l => l.href.includes('/report/') || l.href.includes('/stats/'));
        if (reportPath) {
          console.log(`見つかったレポートパス: ${reportPath.href}`);
          await this.page.goto(`https://affiliate.dmm.com${reportPath.href}`, { waitUntil: 'domcontentloaded' });
        }
      }
    }

    await this.page.waitForTimeout(3000);
    await this.screenshot('dmm-daily-report.png');

    // 「報酬別レポート」に移動して日別データを取得
    console.log('\n報酬別レポートページに移動中...');
    await this.page.evaluate(() => {
      window.location.href = '/report/pay/';
    });
    await this.page.waitForTimeout(3000);
    console.log(`✓ 報酬別レポートページ: ${this.page.url()}`);
    await this.screenshot('dmm-pay-report.png');

    console.log('✅ 日次レポートページに到達');
    console.log(`現在のURL: ${this.page.url()}`);
  }

  async setReportPeriod(startYear: number, startMonth: number, endYear: number, endMonth: number) {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\n📅 レポート期間を設定中: ${startYear}/${startMonth} ～ ${endYear}/${endMonth}`);

    try {
      // 開始年を選択
      const startYearSelect = this.page.locator('select[name*="year"], select:has(option:text-is("2025"))').first();
      const startYearVisible = await startYearSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (startYearVisible) {
        await startYearSelect.selectOption(startYear.toString());
        console.log(`✓ 開始年: ${startYear}`);
        await this.page.waitForTimeout(500);

        // 開始月を選択
        const startMonthSelect = this.page.locator('select[name*="month"]').first();
        const monthValue = startMonth.toString().padStart(2, '0');
        await startMonthSelect.selectOption(monthValue);
        console.log(`✓ 開始月: ${startMonth}`);
        await this.page.waitForTimeout(500);

        // 終了年を選択
        const endYearSelect = this.page.locator('select[name*="year"]').nth(1);
        await endYearSelect.selectOption(endYear.toString());
        console.log(`✓ 終了年: ${endYear}`);
        await this.page.waitForTimeout(500);

        // 終了月を選択
        const endMonthSelect = this.page.locator('select[name*="month"]').nth(1);
        const endMonthValue = endMonth.toString().padStart(2, '0');
        await endMonthSelect.selectOption(endMonthValue);
        console.log(`✓ 終了月: ${endMonth}`);

        await this.page.waitForTimeout(1000);
        console.log('✅ 期間設定完了');
      } else {
        console.log('⚠️ 期間選択フィールドが表示されていません（デフォルト期間を使用）');
      }
    } catch (error: any) {
      console.log(`⚠️ 期間設定エラー: ${error.message}`);
    }
  }

  async navigateToMonthlyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 月次レポートページに移動中...');

    // DMM アフィリエイトの月別レポートURLに直接移動
    const reportUrls = [
      'https://affiliate.dmm.com/affiliate/report/monthly/',
      'https://affiliate.dmm.com/report/monthly/',
      'https://affiliate.dmm.com/partner/report/monthly/',
    ];

    let navigationSuccess = false;
    for (const url of reportUrls) {
      try {
        console.log(`URLを試行中: ${url}`);
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        await this.page.waitForTimeout(2000);

        const hasTables = await this.page.locator('table').count() > 0;
        const hasForm = await this.page.locator('form').count() > 0;

        if (hasTables || hasForm) {
          console.log(`✅ レポートページを発見: ${url}`);
          navigationSuccess = true;
          break;
        }
      } catch (error) {
        console.log(`⚠️ ${url} へのアクセス失敗`);
        continue;
      }
    }

    if (!navigationSuccess) {
      console.log('⚠️ 直接URLでのアクセスに失敗。メニューから探します...');

      // トップページに戻る
      await this.page.goto('https://affiliate.dmm.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await this.page.waitForTimeout(2000);

      // 月別レポートリンクを探す
      const monthlyLinks = await this.page.locator('a:has-text("月別"), a:has-text("月次"), a:has-text("Monthly")').count();

      if (monthlyLinks > 0) {
        await this.page.locator('a:has-text("月別"), a:has-text("月次"), a:has-text("Monthly")').first().click();
      } else {
        // レポートメニューから探す
        const reportMenu = this.page.locator('a:has-text("レポート"), a:has-text("統計"), a:has-text("報酬"), a:has-text("実績")').first();
        await reportMenu.click();
        await this.page.waitForTimeout(2000);

        await this.page.locator('a:has-text("月別"), a:has-text("月次"), a:has-text("Monthly")').first().click();
      }
    }

    await this.page.waitForTimeout(3000);
    await this.screenshot('dmm-monthly-report.png');
    console.log('✅ 月次レポートページに到達');
    console.log(`現在のURL: ${this.page.url()}`);
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    // ページを待機
    await this.page.waitForTimeout(2000);
    await this.screenshot('dmm-daily-before-search.png');

    // ページの全リンクを確認
    console.log('\n🔍 ページ内のリンクを確認中...');
    const allLinks = await this.page.locator('a').allTextContents();
    const relevantLinks = allLinks.filter(link =>
      link.includes('レポート') ||
      link.includes('統計') ||
      link.includes('日別') ||
      link.includes('報酬') ||
      link.includes('実績')
    );
    if (relevantLinks.length > 0) {
      console.log('関連リンク:', relevantLinks.slice(0, 10));
    }

    // レポート表示ボタンを探す
    console.log('\n🔍 レポート表示ボタンを探しています...');

    const searchButtons = await this.page.locator('button:has-text("検索"), button:has-text("表示"), button:has-text("送信"), input[type="submit"][value*="検索"], input[type="submit"][value*="表示"], input[type="submit"]').count();
    console.log(`検索/表示ボタン数: ${searchButtons}`);

    if (searchButtons > 0) {
      await this.page.locator('button:has-text("検索"), button:has-text("表示"), button:has-text("送信"), input[type="submit"][value*="検索"], input[type="submit"][value*="表示"], input[type="submit"]').first().click();
      console.log('レポート表示ボタンをクリック');
      await this.page.waitForTimeout(5000);
      await this.screenshot('dmm-daily-after-search.png');
    }

    // データテーブルを探す
    console.log('\n📊 データテーブルを探しています...');
    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      const tableClass = await table.getAttribute('class');
      const tableId = await table.getAttribute('id');
      const isVisible = await table.isVisible();

      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr, tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (id: ${tableId}, class: ${tableClass}, rows: ${tbodyRows})`);

      // 最初の数行をチェック
      const firstRow = table.locator('tbody tr, tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();
      console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 30)));

      // ヘッダー行を確認
      const headers = await table.locator('thead th, thead td, tr:first-child th').allTextContents();
      if (headers.length > 0) {
        console.log(`  ヘッダー:`, headers.map(h => h.trim()));
      }

      // 日付パターンをチェック（より柔軟に）
      const hasDatePattern = firstCells.some(cell => {
        const trimmedCell = cell.trim();
        return /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(trimmedCell) ||
               /\d{1,2}[/-]\d{1,2}/.test(trimmedCell) ||
               /\d{4}\.\d{1,2}\.\d{1,2}/.test(trimmedCell);
      });

      // または、ヘッダーに「日付」「年月日」などが含まれているかチェック
      const hasDateHeader = headers.some(h => {
        const trimmed = h.trim();
        return trimmed.includes('日付') ||
               trimmed.includes('年月日') ||
               trimmed.includes('日') ||
               trimmed === '日' ||
               trimmed.toLowerCase().includes('date');
      });

      if (hasDatePattern || hasDateHeader) {
        console.log(`\n🎉 データテーブル発見！`);

        // データを抽出（ヘッダー行をスキップ）
        const startRow = headers.length > 0 ? 1 : 0;

        for (let i = startRow; i < tbodyRows; i++) {
          const row = table.locator('tbody tr, tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          if (cells.length === 0) continue;

          let dateValue = '';
          let revenueValue = '';

          // 最初の日付を取得（より柔軟に）
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j].trim();
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
                /\d{1,2}[/-]\d{1,2}/.test(cell) ||
                /\d{4}\.\d{1,2}\.\d{1,2}/.test(cell)) {
              dateValue = cell.replace(/\./g, '-'); // ドットをハイフンに変換
              break;
            }
          }

          // 金額列を探す（右側の列から、またはヘッダーの「報酬」列）
          const revenueColumnNames = ['報酬', '金額', '売上', '収益', '合計'];
          let revenueColumnIndex = -1;

          // ヘッダーから報酬列を特定
          for (let j = 0; j < headers.length; j++) {
            const header = headers[j].trim();
            if (revenueColumnNames.some(name => header.includes(name))) {
              revenueColumnIndex = j;
              break;
            }
          }

          // 報酬列が見つかった場合はその列から、見つからない場合は右側から探す
          if (revenueColumnIndex >= 0 && revenueColumnIndex < cells.length) {
            const cell = cells[revenueColumnIndex].trim();
            if (/[\d,]+/.test(cell) && cell !== '0') {
              revenueValue = cell;
            }
          }

          // 見つからない場合は最後の金額列を取得
          if (!revenueValue) {
            for (let j = cells.length - 1; j >= 0; j--) {
              const cell = cells[j].trim().replace(/¥/g, '');
              if (/^[\d,]+$/.test(cell) && cell !== '0' && cell.length > 0) {
                revenueValue = cell;
                break;
              }
            }
          }

          if (dateValue && revenueValue) {
            console.log(`✓ ${dateValue}: ${revenueValue}`);
            data.push({
              date: dateValue,
              confirmedRevenue: revenueValue,
            });
          }
        }

        if (data.length > 0) {
          break; // データが見つかったらループを抜ける
        }
      }
    }

    if (data.length === 0) {
      console.log('\n⚠️ データが見つかりません。ページの全テキストを確認:');
      const pageText = await this.page.evaluate(() => document.body.innerText);
      console.log(pageText.substring(0, 1000));
    }

    await this.screenshot('dmm-daily-data-final.png');
    console.log(`\n✅ ${data.length}件のデータを取得しました`);
    return data;
  }

  // Alias for monthly scrapers
  async extractDailyData() {
    return await this.scrapeDailyData();
  }

  async scrapeMonthlyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 月次データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    // ページを待機
    await this.page.waitForTimeout(2000);
    await this.screenshot('dmm-monthly-before-search.png');

    // レポート表示ボタンを探す
    console.log('\n🔍 レポート表示ボタンを探しています...');
    const searchButtons = await this.page.locator('button:has-text("検索"), button:has-text("表示"), input[type="submit"][value*="検索"], input[type="submit"][value*="表示"]').count();

    if (searchButtons > 0) {
      await this.page.locator('button:has-text("検索"), button:has-text("表示"), input[type="submit"][value*="検索"], input[type="submit"][value*="表示"]').first().click();
      console.log('レポート表示ボタンをクリック');
      await this.page.waitForTimeout(5000);
      await this.screenshot('dmm-monthly-after-search.png');
    }

    // データテーブルを探す
    console.log('\n📊 データテーブルを探しています...');
    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      const tableClass = await table.getAttribute('class');
      const isVisible = await table.isVisible();

      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr, tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (class: ${tableClass}, rows: ${tbodyRows})`);

      // 最初の行をチェック
      const firstRow = table.locator('tbody tr, tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();
      console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 30)));

      // 年月パターンをチェック (YYYY/MM 形式)
      const hasYearMonthPattern = firstCells.some(cell =>
        /\d{4}[/-]\d{1,2}/.test(cell) && !/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)
      );

      if (hasYearMonthPattern) {
        console.log(`\n🎉 月次データテーブル発見！`);

        // ヘッダーを確認
        const headers = await table.locator('thead th, thead td, tr:first-child th, tr:first-child td').allTextContents();
        console.log(`ヘッダー:`, headers.map(h => h.trim()));

        // データを抽出
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr, tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          // 最初の年月を取得
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j].trim();
            if (/\d{4}[/-]\d{1,2}/.test(cell) && !/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)) {
              dateValue = cell;
              break;
            }
          }

          // 最後の金額列を取得（報酬合計）
          for (let j = cells.length - 1; j >= 0; j--) {
            const cell = cells[j].trim();
            if (/[¥\\d,]+/.test(cell) && cell.length > 0 && cell !== '0') {
              revenueValue = cell;
              break;
            }
          }

          if (dateValue && revenueValue) {
            console.log(`✓ ${dateValue}: ${revenueValue}`);
            data.push({
              date: dateValue,
              confirmedRevenue: revenueValue,
            });
          }
        }

        break;
      }
    }

    if (data.length === 0) {
      console.log('\n⚠️ データが見つかりません。');
    }

    await this.screenshot('dmm-monthly-data-final.png');
    console.log(`\n✅ ${data.length}件のデータを取得しました`);
    return data;
  }

  async screenshot(filename: string) {
    if (!this.page) return;
    await this.page.screenshot({
      path: `screenshots/${filename}`,
      fullPage: true
    });
    console.log(`📸 スクリーンショット保存: ${filename}`);
  }

  async saveToDatabase(data: DailyData[], tableName: 'daily_actuals' | 'actuals' = 'daily_actuals') {
    console.log(`\n💾 Supabase (${tableName}テーブル) に保存中...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const item of data) {
      // ¥, 円, カンマを削除して数値に変換
      const cleanAmount = item.confirmedRevenue.replace(/[¥,円]/g, '').trim();
      const amount = parseFloat(cleanAmount);

      if (isNaN(amount)) {
        console.error(`❌ ${item.date} の金額変換失敗: "${item.confirmedRevenue}" -> "${cleanAmount}"`);
        failCount++;
        continue;
      }

      const { error } = await supabase
        .from(tableName)
        .upsert({
          date: item.date,
          media_id: this.config.mediaId,
          account_item_id: this.config.accountItemId,
          asp_id: this.config.aspId,
          amount: amount,
        }, {
          onConflict: 'date,media_id,account_item_id,asp_id'
        });

      if (error) {
        console.error(`❌ ${item.date} の保存に失敗:`, error.message);
        failCount++;
      } else {
        successCount++;
      }
    }

    console.log(`\n✅ 保存完了: ${successCount}件成功, ${failCount}件失敗\n`);
    return { successCount, failCount };
  }

  // Alias for monthly scrapers
  async saveToSupabase(data: DailyData[]) {
    return await this.saveToDatabase(data);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 ブラウザを閉じました');
    }
  }
}

// メイン実行
async function main() {
  // Supabaseから必要な情報を取得
  const { data: asp } = await supabase
    .from('asps')
    .select('id')
    .eq('name', 'DMMアフィリエイト')
    .single();

  if (!asp) {
    console.error('DMMアフィリエイトのASP情報が取得できませんでした');
    return;
  }

  // 認証情報を取得
  const { data: credentials } = await supabase
    .from('asp_credentials')
    .select('username_secret_key, password_secret_key')
    .eq('asp_id', asp.id)
    .single();

  if (!credentials) {
    console.error('DMMアフィリエイトの認証情報が取得できませんでした');
    return;
  }

  const mediaId = '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12'; // ReRe
  const accountItemId = 'a6df5fab-2df4-4263-a888-ab63348cccd5'; // アフィリエイト

  console.log('\n📋 DMMアフィリエイト レポート取得');
  console.log(`📱 メディアID: ${mediaId}`);
  console.log(`💰 勘定科目ID: ${accountItemId}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  const scraper = new DmmDailyScraper(
    {
      username: credentials.username_secret_key,
      password: credentials.password_secret_key,
    },
    {
      headless: false, // 最初はfalseでデバッグ
      mediaId: mediaId,
      accountItemId: accountItemId,
      aspId: asp.id,
    }
  );

  let dailySuccessCount = 0;
  let dailyFailCount = 0;
  let monthlySuccessCount = 0;
  let monthlyFailCount = 0;
  let dailyDataCount = 0;
  let monthlyDataCount = 0;

  try {
    await scraper.initialize();
    await scraper.login();

    // 日次レポート取得（2025年1月〜10月）
    console.log('\n' + '='.repeat(50));
    console.log('📅 日次レポートを取得中（2025年1月〜10月）');
    console.log('='.repeat(50) + '\n');

    await scraper.navigateToDailyReport();

    // 2025年1月から10月までの期間を設定
    await scraper.setReportPeriod(2025, 1, 2025, 10);

    const dailyData = await scraper.scrapeDailyData();
    dailyDataCount = dailyData.length;

    if (dailyData.length > 0) {
      const result = await scraper.saveToDatabase(dailyData);
      dailySuccessCount = result.successCount;
      dailyFailCount = result.failCount;
    }

    // 月次レポート取得（2025年1月〜10月）
    console.log('\n' + '='.repeat(50));
    console.log('📅 月次レポートを取得中（2025年1月〜10月）');
    console.log('='.repeat(50) + '\n');

    await scraper.navigateToMonthlyReport();

    // 2025年1月から10月までの期間を設定
    await scraper.setReportPeriod(2025, 1, 2025, 10);

    const monthlyData = await scraper.scrapeMonthlyData();
    monthlyDataCount = monthlyData.length;

    if (monthlyData.length > 0) {
      // 月次データは actuals テーブルに保存（各月の末日として保存）
      const monthlyDataForDb = monthlyData.map(item => {
        const [year, month] = item.date.split('/');
        // その月の最終日を取得
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        return {
          date: `${year}-${month.padStart(2, '0')}-${lastDay}`, // YYYY/MM -> YYYY-MM-末日
          confirmedRevenue: item.confirmedRevenue
        };
      });

      const result = await scraper.saveToDatabase(monthlyDataForDb, 'actuals');
      monthlySuccessCount = result.successCount;
      monthlyFailCount = result.failCount;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 実行結果サマリー');
    console.log('='.repeat(50));
    console.log(`📅 日次データ取得件数: ${dailyDataCount}件`);
    console.log(`💾 日次データ保存: ${dailySuccessCount}件成功, ${dailyFailCount}件失敗`);
    console.log(`📅 月次データ取得件数: ${monthlyDataCount}件`);
    console.log(`💾 月次データ保存: ${monthlySuccessCount}件成功, ${monthlyFailCount}件失敗`);
    console.log('='.repeat(50) + '\n');

    console.log('\n✅ 全ての処理が完了しました！');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

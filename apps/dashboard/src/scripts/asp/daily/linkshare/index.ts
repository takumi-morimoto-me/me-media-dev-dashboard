import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface LinkShareCredentials {
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

export class LinkShareDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: LinkShareCredentials;
  private config: ScraperConfig;

  constructor(credentials: LinkShareCredentials, config: ScraperConfig) {
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

    console.log('🔐 リンクシェア（Rakuten）にログイン中...');
    await this.page.goto('https://cli.linksynergy.com/cli/publisher/links/home.php', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.screenshot('linkshare-login-page.png');

    console.log('ログインフォームを探しています...');

    // テキスト入力フィールドを確認
    const textInputs = await this.page.locator('input[type="text"], input[type="email"]').count();
    const passwordInputs = await this.page.locator('input[type="password"]').count();
    console.log(`テキスト/メール入力フィールド数: ${textInputs}`);
    console.log(`パスワード入力フィールド数: ${passwordInputs}`);

    // 全inputフィールドを確認
    const allInputs = await this.page.locator('input').count();
    console.log(`全inputフィールド数: ${allInputs}`);
    for (let i = 0; i < allInputs; i++) {
      const input = this.page.locator('input').nth(i);
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      console.log(`  ${i + 1}. type: ${type}, name: ${name}, id: ${id}`);
    }

    // メールアドレスフィールドを探す（name="username" を優先）
    const usernameField = this.page.locator('input[name="username"], input[id="username"]').first();
    await usernameField.fill(this.credentials.username);
    console.log(`ログインID入力完了: ${this.credentials.username}`);

    // パスワードを入力
    await this.page.locator('input[name="password"], input[id="password"]').first().fill(this.credentials.password);
    console.log('パスワード入力完了');

    await this.page.waitForTimeout(1000);

    // ログインボタンを探して詳細を確認
    const loginButtons = await this.page.locator('button, input[type="submit"]').count();
    console.log(`ログインボタン数: ${loginButtons}`);

    for (let i = 0; i < loginButtons; i++) {
      const button = this.page.locator('button, input[type="submit"]').nth(i);
      const text = await button.textContent();
      const type = await button.getAttribute('type');
      const name = await button.getAttribute('name');
      const id = await button.getAttribute('id');
      console.log(`  ${i + 1}. text: ${text}, type: ${type}, name: ${name}, id: ${id}`);
    }

    // ログインボタンをクリック（テキストが"ログイン"のボタンを探す）
    const loginButton = this.page.locator('button:has-text("ログイン"), input[type="submit"]').first();
    await loginButton.click();
    console.log('ログインボタンをクリック中...');

    // ログイン完了を待つ（URLが変わるまで、またはエラーを確認）
    await this.page.waitForTimeout(5000);

    // エラーメッセージを確認
    const errorMessages = await this.page.locator('.alert-error, .error, [role="alert"]').allTextContents();
    if (errorMessages.length > 0) {
      console.log('⚠️ ログインエラーメッセージ:');
      errorMessages.forEach(msg => console.log(`  ${msg}`));
    }

    // URLを確認
    const currentUrl = this.page.url();
    console.log(`現在のURL: ${currentUrl}`);

    if (currentUrl.includes('/cli/publisher/')) {
      console.log('✅ ログイン成功 - ダッシュボードに到達');
    } else if (currentUrl.includes('/login') || currentUrl.includes('/auth/')) {
      console.log('⚠️ ログインに失敗しました。ログインページに留まっています。');
      console.log('認証情報を確認してください。');

      // ページ全体のテキストを確認
      const pageText = await this.page.evaluate(() => document.body.innerText);
      console.log('\nページ内容:');
      console.log(pageText.substring(0, 500));
    }

    await this.screenshot('linkshare-after-login.png');
    console.log('✅ ログイン処理完了');
  }

  async navigateToDailyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日次レポートページに移動中...');

    try {
      // レポートメニューをクリック
      const reportMenu = this.page.locator('a:has-text("レポート")').first();
      if (await reportMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('レポートメニューをクリック中...');
        await reportMenu.click();
        await this.page.waitForTimeout(2000);
      }

      // 日別レポートのリンクを探してクリック
      const dailyReportLink = this.page.locator('a:has-text("日別レポート"), a:has-text("Daily Report")').first();
      if (await dailyReportLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('日別レポートリンクをクリック中...');
        await dailyReportLink.click();
        await this.page.waitForTimeout(3000);
      } else {
        // メニューから見つからない場合は直接URLにアクセス
        console.log('日別レポートリンクが見つかりません。直接URLにアクセス中...');
        await this.page.goto('https://cli.linksynergy.com/cli/publisher/reports/reporting.php', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await this.page.waitForTimeout(3000);
      }

      console.log(`現在のURL: ${this.page.url()}`);

    } catch (error: any) {
      console.log(`⚠️ エラー: ${error.message}`);
    }

    await this.screenshot('linkshare-daily-report.png');
    console.log('✅ 日次レポートページに到達');
  }

  async setReportPeriod(startYear: number, startMonth: number, endYear: number, endMonth: number) {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\n📅 レポート期間を設定中: ${startYear}/${startMonth} ～ ${endYear}/${endMonth}`);

    try {
      // レポートタイプを選択（日別レポート）
      const reportTypeSelect = this.page.locator('select[name="report_type"], select#report_type').first();
      const reportTypeVisible = await reportTypeSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (reportTypeVisible) {
        // 日別レポートを選択（オプションから探す）
        const options = await reportTypeSelect.locator('option').allTextContents();
        const dailyOption = options.find(opt => /日別|Daily/i.test(opt));
        if (dailyOption) {
          await reportTypeSelect.selectOption({ label: dailyOption });
          console.log('✓ レポートタイプ: 日別');
        }
        await this.page.waitForTimeout(1000);
      }

      // 開始年を選択
      const startYearSelect = this.page.locator('select[name="start_year"], select[name="startYear"]').first();
      const startYearVisible = await startYearSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (startYearVisible) {
        await startYearSelect.selectOption(startYear.toString());
        console.log(`✓ 開始年: ${startYear}`);
        await this.page.waitForTimeout(500);

        // 開始月を選択
        const startMonthSelect = this.page.locator('select[name="start_month"], select[name="startMonth"]').first();
        const monthValue = startMonth.toString().padStart(2, '0');
        await startMonthSelect.selectOption(monthValue);
        console.log(`✓ 開始月: ${startMonth} (value: ${monthValue})`);
        await this.page.waitForTimeout(500);

        // 終了年を選択
        const endYearSelect = this.page.locator('select[name="end_year"], select[name="endYear"]').first();
        await endYearSelect.selectOption(endYear.toString());
        console.log(`✓ 終了年: ${endYear}`);
        await this.page.waitForTimeout(500);

        // 終了月を選択
        const endMonthSelect = this.page.locator('select[name="end_month"], select[name="endMonth"]').first();
        const endMonthValue = endMonth.toString().padStart(2, '0');
        await endMonthSelect.selectOption(endMonthValue);
        console.log(`✓ 終了月: ${endMonth} (value: ${endMonthValue})`);

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

    // レポートページに直接アクセス
    await this.page.goto('https://cli.linksynergy.com/cli/publisher/reports/reportDisplay.php', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await this.page.waitForTimeout(3000);

    await this.screenshot('linkshare-monthly-report.png');
    console.log('✅ 月次レポートページに到達');
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    // ページを待機（JavaScriptのロード待ち）
    console.log('ページの完全なロード待機中...');
    await this.page.waitForTimeout(10000);

    // ページが完全にロードされるまで待つ - JavaScriptフレームワークのレンダリング待ち
    try {
      await this.page.waitForSelector('button', { timeout: 10000 });
      console.log('✓ ボタン要素の読み込み完了');
    } catch (error) {
      console.log('⚠️ ボタン要素の待機タイムアウト');
    }

    await this.screenshot('linkshare-daily-before-search.png');

    // iframeを確認
    console.log('\n🔍 iframe要素を確認中...');
    const iframes = await this.page.frames();
    console.log(`フレーム総数: ${iframes.length}`);
    for (let i = 0; i < iframes.length; i++) {
      const frame = iframes[i];
      const url = frame.url();
      const name = await frame.evaluate(() => document.title || 'No title').catch(() => 'Error getting title');
      console.log(`  ${i + 1}. ${name} - ${url}`);
    }

    // Reporting UI iframeを取得
    const reportingFrame = iframes.find(f => f.url().includes('reporting-ui.rakutenmarketing.com'));
    if (!reportingFrame) {
      console.log('⚠️ Reporting UI iframeが見つかりません');
      return data;
    }

    console.log('\n✓ Reporting UI iframeを発見！');
    console.log('iframe内のコンテンツを確認中...');

    // iframeのコンテンツを確認
    const iframeContent = await reportingFrame.evaluate(() => document.body.innerText).catch(() => '');
    console.log('iframe内容プレビュー:');
    console.log(iframeContent.substring(0, 1000));

    // ページコンテンツを確認
    const pageContent = await this.page.evaluate(() => document.body.innerText);
    console.log('\n📄 ページ内容プレビュー:');
    console.log(pageContent.substring(0, 1000));

    // iframe内のボタンを確認
    console.log('\n🔍 iframe内の全ボタンを確認:');
    const allButtons = await reportingFrame.locator('button').all();
    console.log(`ボタン総数: ${allButtons.length}`);

    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      const button = allButtons[i];
      const text = await button.textContent();
      const classes = await button.getAttribute('class');
      const isVisible = await button.isVisible().catch(() => false);
      if (text?.trim() || isVisible) {
        console.log(`  ${i + 1}. "${text?.trim()}" (class: ${classes}, visible: ${isVisible})`);
      }
    }

    // レポート選択ドロップダウンを探してクリック
    console.log('\n🔍 iframe内でレポート選択ドロップダウンを探しています...');

    try {
      // iframe内でJavaScriptで要素を検索
      const buttonInfo = await reportingFrame.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.map((btn, idx) => ({
          index: idx,
          text: btn.textContent?.trim() || '',
          className: btn.className,
          visible: btn.offsetParent !== null
        }));
      });

      console.log('iframe内のボタン情報:');
      buttonInfo.forEach(info => {
        if (info.text || info.visible) {
          console.log(`  ${info.index + 1}. "${info.text}" (class: ${info.className}, visible: ${info.visible})`);
        }
      });

      // iframe内でJavaScriptで直接ボタンをクリックする
      const clicked = await reportingFrame.evaluate(() => {
        // すべてのボタンを取得
        const buttons = Array.from(document.querySelectorAll('button'));

        // レポート選択ボタンを探す
        for (const button of buttons) {
          const text = button.textContent || '';
          if ((text.includes('レポートを選択') || text.includes('レポート')) && button.offsetParent !== null) {
            console.log(`Clicking button: ${text.trim()}`);
            button.click();
            return { success: true, text: text.trim() };
          }
        }

        // 見つからない場合、最初の表示されているボタンをクリック
        for (const button of buttons) {
          if (button.offsetParent !== null && button.textContent?.trim()) {
            console.log(`Clicking first visible button: ${button.textContent?.trim()}`);
            button.click();
            return { success: true, text: button.textContent?.trim() || 'unknown' };
          }
        }

        return { success: false, text: '' };
      });

      if (clicked.success) {
        console.log(`✓ ボタンをクリックしました: "${clicked.text}"`);
        await this.page.waitForTimeout(3000);
        await this.screenshot('linkshare-dropdown-opened.png');

        // ドロップダウンのオプションを確認（JavaScript経由）
        const dropdownItems = await reportingFrame.evaluate(() => {
          // ドロップダウンメニューのアイテムを探す
          const items = Array.from(document.querySelectorAll('li, [role="option"], .dropdown-item, .menu-item, a'));
          return items
            .filter(item => item.offsetParent !== null) // 表示されているもののみ
            .map((item, idx) => ({
              index: idx,
              text: item.textContent?.trim() || '',
              tag: item.tagName.toLowerCase()
            }))
            .filter(item => item.text.length > 0);
        });

        console.log(`\nドロップダウンアイテム数: ${dropdownItems.length}`);
        dropdownItems.slice(0, 20).forEach(item => {
          console.log(`  ${item.index + 1}. [${item.tag}] ${item.text}`);
        });

        // 日別レポートを選択
        const dailyReportClicked = await reportingFrame.evaluate(() => {
          const items = Array.from(document.querySelectorAll('li, [role="option"], .dropdown-item, .menu-item, a'));
          for (const item of items) {
            const text = item.textContent || '';
            if ((text.includes('日別') || text.includes('Daily') || text.includes('パフォーマンス')) && item.offsetParent !== null) {
              console.log(`Selecting daily report: ${text.trim()}`);
              (item as HTMLElement).click();
              return { success: true, text: text.trim() };
            }
          }
          return { success: false, text: '' };
        });

        if (dailyReportClicked.success) {
          console.log(`\n✓ 日別レポートを選択しました: "${dailyReportClicked.text}"`);
          await this.page.waitForTimeout(5000);
          await this.screenshot('linkshare-report-selected.png');
        } else {
          console.log('\n⚠️ 日別レポートが見つかりませんでした');
        }
      } else {
        console.log('⚠️ レポート選択ボタンが見つかりません');
      }
    } catch (error: any) {
      console.log(`⚠️ エラー: ${error.message}`);
    }

    // レポート表示ボタンを探す（従来のロジック）
    console.log('\n🔍 レポート表示ボタンを探しています...');

    const submitButtons = await this.page.locator('input[type="submit"], button[type="submit"]').count();
    console.log(`送信ボタン数: ${submitButtons}`);

    let buttonClicked = false;
    if (submitButtons > 0) {
      for (let i = 0; i < submitButtons; i++) {
        const button = this.page.locator('input[type="submit"], button[type="submit"]').nth(i);
        const value = await button.getAttribute('value');
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        console.log(`  ${i + 1}. value: ${value}, text: ${text}, visible: ${isVisible}`);

        if (isVisible && (value?.includes('表示') || value?.includes('検索') || value?.includes('Submit') ||
            text?.includes('表示') || text?.includes('検索') || text?.includes('Submit'))) {
          console.log(`\n✓ レポート表示ボタンをクリックします: ${value || text}`);
          await button.click();

          // レポートの生成を待つ
          console.log('レポート生成を待機中...');
          await this.page.waitForTimeout(5000);
          await this.screenshot('linkshare-daily-after-search.png');
          buttonClicked = true;
          break;
        }
      }
    }

    if (!buttonClicked) {
      console.log('⚠️ レポート表示ボタンが見つからないため、現在のページのデータを抽出します');
    }

    // iframe内のデータテーブルを探す
    console.log('\n📊 iframe内のデータテーブルを探しています...');
    const tables = await reportingFrame.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = reportingFrame.locator('table').nth(tableIndex);
      const tableClass = await table.getAttribute('class');
      const tableId = await table.getAttribute('id');
      const isVisible = await table.isVisible();

      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr, tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (class: ${tableClass}, id: ${tableId}, rows: ${tbodyRows})`);

      // 最初の行をチェック
      const firstRow = table.locator('tbody tr, tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();
      console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 30)));

      // ヘッダーを確認（最初の行がヘッダーの可能性）
      const headers = await table.locator('thead th, thead td, tr:first-child th, tr:first-child td').allTextContents();
      console.log(`  ヘッダー:`, headers.map(h => h.trim().substring(0, 30)));

      // 日付パターンをチェック（ヘッダー以外の行で）
      let hasDatePattern = false;
      let dateColumnIndex = -1;
      let revenueColumnIndex = -1;

      // 2行目以降でデータをチェック
      if (tbodyRows > 1) {
        const secondRow = table.locator('tbody tr, tr').nth(1);
        const secondCells = await secondRow.locator('td, th').allTextContents();
        console.log(`  2行目:`, secondCells.map(c => c.trim().substring(0, 30)));

        for (let j = 0; j < secondCells.length; j++) {
          const cell = secondCells[j].trim();
          // 日付パターン
          if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
              /\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(cell)) {
            hasDatePattern = true;
            dateColumnIndex = j;
            console.log(`  ✓ 日付列発見: 列${j} - ${cell}`);
          }
          // 金額パターン（¥0以外）
          if (/[\$¥]?\d{1,3}(,\d{3})*(\.\d+)?/.test(cell) && cell !== '¥0' && cell !== '$0' && cell !== '0') {
            revenueColumnIndex = j;
            console.log(`  ✓ 金額列候補: 列${j} - ${cell}`);
          }
        }
      } else {
        // 1行しかない場合は1行目をチェック
        hasDatePattern = firstCells.some(cell =>
          /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
          /\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(cell)
        );
      }

      if (hasDatePattern) {
        console.log(`\n🎉 データテーブル発見！`);

        // データを抽出
        const rows = await table.locator('tbody tr, tr').count();
        let startRow = 0;

        // 最初の行がヘッダーかチェック
        const firstRowCells = await table.locator('tbody tr, tr').first().locator('td, th').allTextContents();
        const isHeaderRow = firstRowCells.some(cell =>
          cell.includes('日付') || cell.includes('Date') ||
          cell.includes('売上') || cell.includes('Revenue') ||
          cell.includes('報酬') || cell.includes('Commission') ||
          cell.includes('クリック') || cell.includes('Click')
        );
        if (isHeaderRow) {
          startRow = 1;
          console.log('  最初の行はヘッダーとしてスキップ');
        }

        for (let i = startRow; i < rows; i++) {
          const row = table.locator('tbody tr, tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          // 日付列が特定されている場合
          if (dateColumnIndex >= 0 && dateColumnIndex < cells.length) {
            dateValue = cells[dateColumnIndex].trim();
          } else {
            // 最初の日付を取得
            for (let j = 0; j < cells.length; j++) {
              const cell = cells[j].trim();
              if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
                  /\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(cell)) {
                dateValue = cell;
                dateColumnIndex = j;
                break;
              }
            }
          }

          // 金額列が特定されている場合
          if (revenueColumnIndex >= 0 && revenueColumnIndex < cells.length) {
            revenueValue = cells[revenueColumnIndex].trim();
          } else {
            // 後ろから金額列を探す（最後の金額列が報酬の可能性が高い）
            for (let j = cells.length - 1; j >= 0; j--) {
              const cell = cells[j].trim();
              // 金額パターン: ¥1,234 or $1,234 or 1,234 など（¥0はスキップ）
              if (/[\$¥]?\d{1,3}(,\d{3})*(\.\d+)?/.test(cell) &&
                  cell.length > 0 &&
                  !cell.includes('/') &&
                  cell !== '¥0' && cell !== '$0' && cell !== '0') {
                revenueValue = cell;
                revenueColumnIndex = j;
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
          } else if (dateValue) {
            console.log(`⚠️ ${dateValue}: 金額なし (cells: ${cells.map(c => c.trim()).join(' | ')})`);
          }
        }

        break;
      }
    }

    if (data.length === 0) {
      console.log('\n⚠️ データが見つかりません。ページの全テキストを確認:');
      const pageText = await this.page.evaluate(() => document.body.innerText);
      console.log(pageText.substring(0, 1000));
    }

    await this.screenshot('linkshare-daily-data-final.png');
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
    await this.screenshot('linkshare-monthly-before-search.png');

    // レポートタイプを月別に変更
    try {
      const reportTypeSelect = this.page.locator('select[name="report_type"], select#report_type').first();
      const reportTypeVisible = await reportTypeSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (reportTypeVisible) {
        const options = await reportTypeSelect.locator('option').allTextContents();
        const monthlyOption = options.find(opt => /月別|Monthly/i.test(opt));
        if (monthlyOption) {
          await reportTypeSelect.selectOption({ label: monthlyOption });
          console.log('✓ レポートタイプ: 月別');
        }
        await this.page.waitForTimeout(1000);
      }
    } catch (error) {
      console.log('⚠️ レポートタイプ変更をスキップ');
    }

    // レポート表示ボタンを探す
    console.log('\n🔍 レポート表示ボタンを探しています...');
    const submitButtons = await this.page.locator('input[type="submit"], button[type="submit"]').count();
    console.log(`送信ボタン数: ${submitButtons}`);

    if (submitButtons > 0) {
      for (let i = 0; i < submitButtons; i++) {
        const button = this.page.locator('input[type="submit"], button[type="submit"]').nth(i);
        const value = await button.getAttribute('value');
        const text = await button.textContent();
        const isVisible = await button.isVisible();

        if (isVisible && (value?.includes('表示') || value?.includes('検索') || value?.includes('Submit') ||
            text?.includes('表示') || text?.includes('検索') || text?.includes('Submit'))) {
          console.log(`\n✓ レポート表示ボタンをクリックします: ${value || text}`);
          await button.click();
          console.log('レポート生成を待機中...');
          await this.page.waitForTimeout(5000);
          await this.screenshot('linkshare-monthly-after-search.png');
          break;
        }
      }
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

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (class: ${tableClass}, id: ${tableId}, rows: ${tbodyRows})`);

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
        const rows = await table.locator('tbody tr, tr').count();
        for (let i = 0; i < rows; i++) {
          const row = table.locator('tbody tr, tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          // ヘッダー行をスキップ
          const isHeaderRow = cells.some(cell =>
            cell.includes('月') || cell.includes('Month') ||
            cell.includes('売上') || cell.includes('Revenue') ||
            cell.includes('報酬') || cell.includes('Commission')
          );
          if (isHeaderRow && i === 0) continue;

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

          // 金額列を取得
          for (let j = cells.length - 1; j >= 0; j--) {
            const cell = cells[j].trim();
            if (/[\$¥]?[\d,]+\.?\d*/.test(cell) && cell.length > 0 && !cell.includes('/')) {
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

    await this.screenshot('linkshare-monthly-data-final.png');
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
      // ¥, $, 円, カンマを削除して数値に変換
      const cleanAmount = item.confirmedRevenue.replace(/[\$¥,円]/g, '').trim();
      const amount = parseFloat(cleanAmount);

      if (isNaN(amount)) {
        console.error(`❌ ${item.date} の金額変換失敗: "${item.confirmedRevenue}" -> "${cleanAmount}"`);
        failCount++;
        continue;
      }

      // 日付を正規化（様々な形式に対応）
      let normalizedDate = item.date;

      // MM/DD/YYYY -> YYYY-MM-DD
      if (/\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(item.date)) {
        const parts = item.date.split(/[/-]/);
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parts[2];
        normalizedDate = `${year}-${month}-${day}`;
      }
      // YYYY/MM/DD -> YYYY-MM-DD
      else if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(item.date)) {
        normalizedDate = item.date.replace(/\//g, '-');
        const parts = normalizedDate.split('-');
        normalizedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      // YYYY/MM -> YYYY-MM-末日 (月次データの場合)
      else if (/\d{4}[/-]\d{1,2}$/.test(item.date)) {
        const parts = item.date.split(/[/-]/);
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        normalizedDate = `${year}-${month}-${lastDay}`;
      }

      const { error } = await supabase
        .from(tableName)
        .upsert({
          date: normalizedDate,
          media_id: this.config.mediaId,
          account_item_id: this.config.accountItemId,
          asp_id: this.config.aspId,
          amount: amount,
        }, {
          onConflict: 'date,media_id,account_item_id,asp_id'
        });

      if (error) {
        console.error(`❌ ${normalizedDate} の保存に失敗:`, error.message);
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
    .eq('name', 'リンクシェア')
    .single();

  if (!asp) {
    console.error('ASP情報が取得できませんでした');
    return;
  }

  // 固定値を使用
  const mediaId = '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12'; // ReRe
  const accountItemId = 'a6df5fab-2df4-4263-a888-ab63348cccd5'; // アフィリエイト

  console.log('\n📋 リンクシェア（Rakuten Group）日別レポート取得');
  console.log(`📱 メディアID: ${mediaId}`);
  console.log(`💰 勘定科目ID: ${accountItemId}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  // 認証情報を取得
  const { data: credentials } = await supabase
    .from('asp_credentials')
    .select('username_secret_key, password_secret_key')
    .eq('asp_id', asp.id)
    .single();

  if (!credentials) {
    console.error('認証情報が取得できませんでした');
    return;
  }

  const scraper = new LinkShareDailyScraper(
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
      const result = await scraper.saveToDatabase(dailyData, 'daily_actuals');
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
      const result = await scraper.saveToDatabase(monthlyData, 'actuals');
      monthlySuccessCount = result.successCount;
      monthlyFailCount = result.failCount;
    }

    console.log('\n✅ 全ての処理が完了しました！');
    console.log('\n' + '='.repeat(50));
    console.log('📊 実行結果サマリー');
    console.log('='.repeat(50));
    console.log(`日次データ取得件数: ${dailyDataCount}件`);
    console.log(`日次データ保存成功: ${dailySuccessCount}件`);
    console.log(`日次データ保存失敗: ${dailyFailCount}件`);
    console.log(`月次データ取得件数: ${monthlyDataCount}件`);
    console.log(`月次データ保存成功: ${monthlySuccessCount}件`);
    console.log(`月次データ保存失敗: ${monthlyFailCount}件`);
    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

// メインスクリプトとして実行された場合
if (require.main === module) {
  main();
}

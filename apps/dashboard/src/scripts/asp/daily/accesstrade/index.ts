import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface AccesstradeCredentials {
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

export class AccesstradeDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: AccesstradeCredentials;
  private config: ScraperConfig;

  constructor(credentials: AccesstradeCredentials, config: ScraperConfig) {
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

    console.log('🔐 アクセストレードにログイン中...');

    // AccessTradeのパートナーログインページに移動（複数のURLを試す）
    const loginUrls = [
      'https://member.accesstrade.net/',
      'https://www.accesstrade.ne.jp/partner/login/',
      'https://partner.accesstrade.net/login',
    ];

    let loginPageLoaded = false;
    for (const url of loginUrls) {
      try {
        console.log(`ログインURL試行: ${url}`);
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        await this.page.waitForTimeout(2000);

        // ページがエラーでないか確認
        const bodyText = await this.page.textContent('body').catch(() => '');
        if (!bodyText.includes('404') && !bodyText.includes('Not Found')) {
          console.log(`✅ ログインページに到達: ${url}`);
          loginPageLoaded = true;
          break;
        }
      } catch (error) {
        console.log(`  ${url} への移動失敗`);
        continue;
      }
    }

    if (!loginPageLoaded) {
      throw new Error('ログインページに到達できませんでした');
    }

    await this.page.waitForTimeout(1000);
    await this.screenshot('accesstrade-login-page.png');

    // ログインフォームを探す
    console.log('ログインフォームを探しています...');

    // ページ上のinputフィールドを確認
    const allInputs = await this.page.locator('input').all();
    console.log(`入力フィールド数: ${allInputs.length}`);

    for (let i = 0; i < allInputs.length; i++) {
      const input = allInputs[i];
      const name = await input.getAttribute('name').catch(() => '');
      const type = await input.getAttribute('type').catch(() => '');
      const id = await input.getAttribute('id').catch(() => '');
      console.log(`  ${i + 1}. name="${name}", type="${type}", id="${id}"`);
    }

    // ログインフォームを探す（複数のパターンを試す）
    let loginIdInput = this.page.locator('input[name="userId"]').first();
    let passwordInput = this.page.locator('input[name="userPass"]').first();

    // userId/userPassが見つからない場合、他のパターンを試す
    if (await loginIdInput.count() === 0) {
      console.log('userId フィールドが見つかりません。他のパターンを試します...');

      // id属性で探す
      loginIdInput = this.page.locator('input#loginId, input#userId, input#user_id').first();
      passwordInput = this.page.locator('input#password, input#userPassword, input#user_password').first();

      // まだ見つからない場合、type属性で探す
      if (await loginIdInput.count() === 0) {
        const textInputs = await this.page.locator('input[type="text"], input[type="email"]').all();
        const passwordInputs = await this.page.locator('input[type="password"]').all();

        if (textInputs.length > 0 && passwordInputs.length > 0) {
          console.log(`text/email入力: ${textInputs.length}個, password入力: ${passwordInputs.length}個見つかりました`);
          loginIdInput = this.page.locator('input[type="text"], input[type="email"]').first();
          passwordInput = this.page.locator('input[type="password"]').first();
        }
      }
    }

    // ログインIDを入力
    if (await loginIdInput.count() > 0) {
      await loginIdInput.fill(this.credentials.username);
      console.log('✅ ログインID入力完了');
      await this.page.waitForTimeout(500);
    } else {
      console.log('⚠️ ログインIDフィールドが見つかりません');
      throw new Error('ログインフォームが見つかりません');
    }

    // パスワードを入力
    if (await passwordInput.count() > 0) {
      await passwordInput.fill(this.credentials.password);
      console.log('✅ パスワード入力完了');
      await this.page.waitForTimeout(500);
    } else {
      console.log('⚠️ パスワードフィールドが見つかりません');
      throw new Error('パスワードフィールドが見つかりません');
    }

    await this.screenshot('accesstrade-before-login-click.png');

    // パートナーログインボタンを探す
    // userPassフィールドと同じフォーム内のsubmitボタンを探す
    let loginButton = null;

    // まずuserPassフィールドの親フォームからsubmitボタンを探す
    const passwordField = this.page.locator('input[name="userPass"]');
    if (await passwordField.count() > 0) {
      // XPath で親フォームを探す
      const parentForm = this.page.locator('input[name="userPass"]').locator('xpath=ancestor::form');
      if (await parentForm.count() > 0) {
        loginButton = parentForm.locator('input[type="submit"], button[type="submit"]').first();
        console.log('パートナーフォーム内のsubmitボタンを発見');
      }
    }

    // それでも見つからない場合、全submitボタンの2番目を使用（広告主が1番目、パートナーが2番目）
    if (!loginButton || await loginButton.count() === 0) {
      console.log('フォームから見つからないため、2番目のsubmitボタンを使用');
      const allSubmitButtons = await this.page.locator('input[type="submit"], button[type="submit"]').all();
      console.log(`submitボタン総数: ${allSubmitButtons.length}`);

      if (allSubmitButtons.length >= 2) {
        console.log('2番目のsubmitボタンをクリックします（パートナーログイン）');
        await Promise.all([
          this.page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => console.log('Load state timeout')),
          allSubmitButtons[1].click()
        ]);
        await this.page.waitForTimeout(5000);
      } else {
        throw new Error('パートナーログインボタンが見つかりません');
      }
    } else {
      console.log('パートナーログインボタンをクリック中...');
      await Promise.all([
        this.page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => console.log('Load state timeout')),
        loginButton.click()
      ]);
      await this.page.waitForTimeout(5000);
    }

    await this.screenshot('accesstrade-after-login.png');

    console.log('✅ ログイン処理完了');
    console.log(`現在のURL: ${this.page.url()}`);

    // ログイン後のページの全リンクを確認
    await this.page.waitForTimeout(2000);
    const allLinks = await this.page.locator('a').all();
    console.log('\n📋 ログイン後に利用可能なリンク（最初の50個）:');
    for (let i = 0; i < Math.min(allLinks.length, 50); i++) {
      const text = await allLinks[i].textContent().catch(() => '');
      const href = await allLinks[i].getAttribute('href').catch(() => '');
      if (text?.trim() && href) {
        console.log(`  ${i + 1}. "${text.trim()}" -> ${href}`);
      }
    }
  }

  async navigateToDailyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日次レポートページに移動中...');
    console.log('現在のURL:', this.page.url());

    await this.page.waitForTimeout(2000);

    // まずレポートメニューをクリック
    const reportLink = this.page.locator('a:has-text("レポート")').first();
    if (await reportLink.count() > 0) {
      console.log('レポートメニューをクリック中...');
      await reportLink.click();
      await this.page.waitForTimeout(3000);
      await this.screenshot('accesstrade-report-page.png');
      console.log(`レポートページURL: ${this.page.url()}`);

      // レポートページの全リンクを確認
      const allLinks = await this.page.locator('a').all();
      console.log('\nレポートページの利用可能なリンク:');
      for (let i = 0; i < Math.min(allLinks.length, 40); i++) {
        const text = await allLinks[i].textContent().catch(() => '');
        const href = await allLinks[i].getAttribute('href').catch(() => '');
        if (text?.trim() && href) {
          console.log(`  ${i + 1}. "${text.trim()}" -> ${href}`);
        }
      }

      // 日別レポートリンクを探す
      const dailyLink = this.page.locator('a:has-text("日別"), a:has-text("日次"), a[href*="daily"]').first();
      if (await dailyLink.count() > 0) {
        console.log('\n✅ 日別レポートリンクを発見、クリック中...');
        await dailyLink.click();
        await this.page.waitForTimeout(3000);
      } else {
        console.log('\n⚠️ 日別レポートリンクが見つかりません。サマリーページにそのまま留まります...');
      }
    } else {
      console.log('⚠️ レポートリンクが見つかりません');
    }

    await this.page.waitForTimeout(2000);
    await this.screenshot('accesstrade-daily-report.png');
    console.log('✅ レポートページに到達');
    console.log('現在のURL:', this.page.url());
  }

  async setReportPeriod(startYear: number, startMonth: number, endYear: number, endMonth: number) {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\n📅 レポート期間を設定中: ${startYear}/${startMonth} ～ ${endYear}/${endMonth}`);

    try {
      // 開始年を選択
      const startYearSelect = this.page.locator('select[name="start_year"], select:has-text("年")').first();
      const startYearVisible = await startYearSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (startYearVisible) {
        await startYearSelect.selectOption(startYear.toString());
        console.log(`✓ 開始年: ${startYear}`);
        await this.page.waitForTimeout(500);

        // 開始月を選択
        const startMonthSelect = this.page.locator('select[name="start_month"]').first();
        const monthValue = startMonth.toString().padStart(2, '0');
        await startMonthSelect.selectOption(monthValue);
        console.log(`✓ 開始月: ${startMonth} (value: ${monthValue})`);
        await this.page.waitForTimeout(500);

        // 終了年を選択
        const endYearSelect = this.page.locator('select[name="end_year"]').first();
        await endYearSelect.selectOption(endYear.toString());
        console.log(`✓ 終了年: ${endYear}`);
        await this.page.waitForTimeout(500);

        // 終了月を選択
        const endMonthSelect = this.page.locator('select[name="end_month"]').first();
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
    console.log('現在のURL:', this.page.url());

    await this.page.waitForTimeout(2000);

    // メニュー項目を探す
    const reportLinks = await this.page.locator('a').all();
    let foundReportLink = false;

    for (const link of reportLinks) {
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text?.includes('レポート') || text?.includes('REPORT') || href?.includes('report')) {
        if (href?.includes('monthly') || text?.includes('月別') || text?.includes('月次')) {
          console.log('月別レポートリンクをクリック中...');
          await link.click();
          foundReportLink = true;
          break;
        } else if (text?.includes('レポート') && !foundReportLink) {
          console.log('レポートメニューをクリック中...');
          await link.click();
          await this.page.waitForTimeout(2000);

          const monthlyLink = this.page.locator('a:has-text("月別"), a:has-text("月次"), a[href*="monthly"]').first();
          if (await monthlyLink.count() > 0) {
            console.log('月別レポートリンクをクリック中...');
            await monthlyLink.click();
            foundReportLink = true;
            break;
          }
        }
      }
    }

    await this.page.waitForTimeout(3000);
    await this.screenshot('accesstrade-monthly-report.png');
    console.log('✅ 月次レポートページに到達');
    console.log('現在のURL:', this.page.url());
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    // ページを待機
    await this.page.waitForTimeout(2000);
    await this.screenshot('accesstrade-daily-before-search.png');

    // レポート表示ボタンを探す
    console.log('\n🔍 レポート表示ボタンを探しています...');

    // 検索/表示ボタンを探してクリック
    const buttons = await this.page.locator('button:visible, input[type="submit"]:visible, input[type="button"]:visible, input[type="image"]:visible').all();

    for (const button of buttons) {
      const text = await button.textContent().catch(() => '');
      const value = await button.getAttribute('value').catch(() => '');
      const alt = await button.getAttribute('alt').catch(() => '');

      if (text?.includes('表示') || text?.includes('検索') || value?.includes('表示') || value?.includes('検索') || alt?.includes('表示') || alt?.includes('検索')) {
        console.log(`\n✓ レポート表示ボタンをクリックします: ${text || value || alt}`);
        await button.click();
        console.log('レポート生成を待機中...');
        await this.page.waitForTimeout(5000);
        await this.screenshot('accesstrade-daily-after-search.png');
        break;
      }
    }

    // データテーブルを探す
    console.log('\n📊 データテーブルを探しています...');
    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      const tableClass = await table.getAttribute('class');
      const isVisible = await table.isVisible();

      // 非表示テーブルはスキップ
      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (class: ${tableClass}, rows: ${tbodyRows})`);

      // 最初の行をチェック
      const firstRow = table.locator('tbody tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();
      console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 30)));

      // AccessTrade日別レポートはtableにclass="report"がある
      // ヘッダーを確認して日別データかどうか判定
      const headers = await table.locator('thead th, thead td').allTextContents();
      console.log(`ヘッダー:`, headers.map(h => h.trim()));

      // "日付"または"日"ヘッダーがあれば日別レポート
      const hasDateHeader = headers.some(h => h.includes('日付') || h === '日');

      if (hasDateHeader || tableClass?.includes('report')) {
        console.log(`\n🎉 日別レポートテーブル発見！`);

        // データを抽出（最初の行は"合計"なのでスキップする可能性）
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          // 最初のセルが日付かどうか確認
          const firstCell = cells[0]?.trim();

          // "合計"行はスキップ
          if (firstCell === '合計' || firstCell === '総計') {
            continue;
          }

          let dateValue = '';
          let revenueValue = '';

          // 最初のセルから日付を取得
          if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(firstCell) || /\d{1,2}[/-]\d{1,2}/.test(firstCell)) {
            dateValue = firstCell;
          }

          // 最後の金額列を取得（確定報酬額）
          for (let j = cells.length - 1; j >= 0; j--) {
            const cell = cells[j].trim().replace(/\s+/g, ''); // 改行やスペースを除去
            if (/^[¥￥]?[\d,]+$/.test(cell) && cell.length > 0) {
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
      console.log('\n⚠️ データが見つかりません。ページの全テキストを確認:');
      const pageText = await this.page.evaluate(() => document.body.innerText);
      console.log(pageText.substring(0, 1000));
    }

    await this.screenshot('accesstrade-daily-data-final.png');
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
    await this.screenshot('accesstrade-monthly-before-search.png');

    // レポート表示ボタンを探す
    console.log('\n🔍 レポート表示ボタンを探しています...');
    const buttons = await this.page.locator('button:visible, input[type="submit"]:visible, input[type="button"]:visible, input[type="image"]:visible').all();

    for (const button of buttons) {
      const text = await button.textContent().catch(() => '');
      const value = await button.getAttribute('value').catch(() => '');
      const alt = await button.getAttribute('alt').catch(() => '');

      if (text?.includes('表示') || text?.includes('検索') || value?.includes('表示') || value?.includes('検索') || alt?.includes('表示') || alt?.includes('検索')) {
        console.log(`\n✓ レポート表示ボタンをクリックします: ${text || value || alt}`);
        await button.click();
        console.log('レポート生成を待機中...');
        await this.page.waitForTimeout(5000);
        await this.screenshot('accesstrade-monthly-after-search.png');
        break;
      }
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

      const tbodyRows = await table.locator('tbody tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (class: ${tableClass}, rows: ${tbodyRows})`);

      // 最初の行をチェック
      const firstRow = table.locator('tbody tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();
      console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 30)));

      // 年月パターンをチェック (YYYY/MM 形式)
      const hasYearMonthPattern = firstCells.some(cell =>
        /\d{4}[/-]\d{1,2}/.test(cell) && !/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)
      );

      if (hasYearMonthPattern) {
        console.log(`\n🎉 月次データテーブル発見！`);

        // ヘッダーを確認
        const headers = await table.locator('thead th, thead td').allTextContents();
        console.log(`ヘッダー:`, headers.map(h => h.trim()));

        // データを抽出
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
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
            if (/[¥\\d,]+/.test(cell) && cell.length > 0) {
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

    await this.screenshot('accesstrade-monthly-data-final.png');
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
      // 日付から曜日を削除 (例: "2025/10/01(水)" -> "2025/10/01")
      let cleanDate = item.date.replace(/\([月火水木金土日]\)/g, '').trim();
      // YYYY/MM/DD -> YYYY-MM-DD に変換
      cleanDate = cleanDate.replace(/\//g, '-');

      // ¥, 円, カンマ、￥を削除して数値に変換
      const cleanAmount = item.confirmedRevenue.replace(/[¥￥,円]/g, '').trim();
      const amount = parseFloat(cleanAmount);

      if (isNaN(amount)) {
        console.error(`❌ ${item.date} の金額変換失敗: "${item.confirmedRevenue}" -> "${cleanAmount}"`);
        failCount++;
        continue;
      }

      const { error } = await supabase
        .from(tableName)
        .upsert({
          date: cleanDate,
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
        console.log(`✅ ${cleanDate}: ¥${amount.toLocaleString()}`);
        successCount++;
      }
    }

    console.log(`\n✅ 保存完了: ${successCount}件成功, ${failCount}件失敗\n`);
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
  const { data: media } = await supabase
    .from('media')
    .select('id')
    .eq('name', 'ReRe')
    .single();

  const { data: accountItem } = await supabase
    .from('account_items')
    .select('id')
    .eq('name', 'アフィリエイト')
    .eq('media_id', media!.id)
    .single();

  const { data: asp } = await supabase
    .from('asps')
    .select('id')
    .eq('name', 'アクセストレード')
    .single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    console.log('Media:', media);
    console.log('Account Item:', accountItem);
    console.log('ASP:', asp);
    return;
  }

  // ASP credentialsを取得
  const { data: credentials } = await supabase
    .from('asp_credentials')
    .select('username_secret_key, password_secret_key')
    .eq('asp_id', asp.id)
    .eq('media_id', media.id)
    .single();

  if (!credentials) {
    console.error('アクセストレードの認証情報が取得できませんでした');
    return;
  }

  console.log('\n📋 アクセストレード 日別レポート取得');
  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  const scraper = new AccesstradeDailyScraper(
    {
      username: credentials.username_secret_key,
      password: credentials.password_secret_key,
    },
    {
      headless: false, // 最初はfalseでデバッグ
      mediaId: media.id,
      accountItemId: accountItem.id,
      aspId: asp.id,
    }
  );

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

    if (dailyData.length > 0) {
      await scraper.saveToDatabase(dailyData);
    }

    // 月次レポート取得（2025年1月〜10月）
    console.log('\n' + '='.repeat(50));
    console.log('📅 月次レポートを取得中（2025年1月〜10月）');
    console.log('='.repeat(50) + '\n');

    await scraper.navigateToMonthlyReport();

    // 2025年1月から10月までの期間を設定
    await scraper.setReportPeriod(2025, 1, 2025, 10);

    const monthlyData = await scraper.scrapeMonthlyData();

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

      await scraper.saveToDatabase(monthlyDataForDb, 'actuals');
    }

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

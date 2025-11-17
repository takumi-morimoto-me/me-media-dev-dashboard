import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface AmazonCredentials {
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

export class AmazonDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: AmazonCredentials;
  private config: ScraperConfig;

  constructor(credentials: AmazonCredentials, config: ScraperConfig) {
    this.credentials = credentials;
    this.config = config;
  }

  async initialize() {
    console.log('ブラウザを起動しています...');
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
    console.log('ブラウザ起動完了');
  }

  async login() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('Amazonアソシエイトにログイン中...');

    // 直接ログインページにアクセス
    await this.page.goto('https://affiliate.amazon.co.jp/home', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(3000);
    await this.screenshot('amazon-home-before-login.png');

    const currentUrl = this.page.url();
    console.log(`現在のURL: ${currentUrl}`);

    // Amazonのログインページにリダイレクトされた場合
    if (currentUrl.includes('signin') || currentUrl.includes('login') || currentUrl.includes('ap/signin')) {
      console.log('ログインページを検出しました');

      // メールアドレス/電話番号を入力
      const emailSelector = 'input[type="email"], input[name="email"], input#ap_email';
      await this.page.waitForSelector(emailSelector, { timeout: 10000 });
      await this.page.fill(emailSelector, this.credentials.username);
      console.log('メールアドレス入力完了');

      await this.screenshot('amazon-email-entered.png');

      // 続行ボタンをクリック（Amazonは2段階ログイン）
      const continueButton = this.page.locator('input[type="submit"], button[type="submit"]').first();
      if (await continueButton.isVisible()) {
        await continueButton.click();
        console.log('続行ボタンをクリック');
        await this.page.waitForTimeout(3000);
        await this.screenshot('amazon-password-page.png');
      }

      // パスワードを入力
      const passwordSelector = 'input[type="password"], input[name="password"], input#ap_password';
      await this.page.waitForSelector(passwordSelector, { timeout: 10000 });
      await this.page.fill(passwordSelector, this.credentials.password);
      console.log('パスワード入力完了');

      await this.screenshot('amazon-password-entered.png');

      // ログインボタンをクリックして、ナビゲーションを待つ
      console.log('ログインボタンをクリック中...');

      // Enterキーを押してフォームを送信する方法も試す
      await this.page.press(passwordSelector, 'Enter');
      console.log('Enterキーでフォーム送信');

      // ナビゲーションを待つ（最大30秒）
      await this.page.waitForTimeout(5000);
      await this.screenshot('amazon-after-login.png');

      console.log('ログイン処理完了');
      console.log(`現在のURL: ${this.page.url()}`);

      // ログイン後のページを確認
      const afterLoginUrl = this.page.url();
      if (afterLoginUrl.includes('signin') || afterLoginUrl.includes('ap/')) {
        console.log('警告: まだログインページにいる可能性があります');
        const pageText = await this.page.evaluate(() => document.body.innerText);
        console.log('ページテキスト:', pageText.substring(0, 800));

        // エラーメッセージを確認
        const errorMessages = await this.page.locator('.a-alert-error, .error-message, [class*="error"]').allTextContents();
        if (errorMessages.length > 0) {
          console.log('エラーメッセージ:', errorMessages);
        }

        // 2FAやセキュリティチェックの可能性を確認
        if (pageText.includes('コードを入力') || pageText.includes('認証') || pageText.includes('OTP') || pageText.includes('セキュリティ')) {
          console.log('2FAまたはセキュリティチェックが必要です。手動で対応してください。');
          console.log('60秒待機します...');
          await this.page.waitForTimeout(60000); // 60秒待機して手動入力を許可
          await this.screenshot('amazon-after-2fa.png');
          console.log(`2FA後のURL: ${this.page.url()}`);
        } else if (pageText.includes('パスワード') && pageText.includes('ログイン')) {
          console.log('エラー: ログインに失敗しました。認証情報を確認してください。');
          console.log('パスワードが正しいか、CAPTCHAが表示されていないか確認してください。');
        }
      } else {
        console.log('ログイン成功: Amazon Associatesホームページに到達しました');
      }
    } else {
      console.log('すでにログイン済み、またはログインページにリダイレクトされませんでした');
      console.log('ページテキスト:', await this.page.evaluate(() => document.body.innerText.substring(0, 500)));
    }
  }

  async navigateToDailyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('日次レポートページに移動中...');

    // まずホームページに移動
    await this.page.goto('https://affiliate.amazon.co.jp/home', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(3000);
    await this.screenshot('amazon-home-after-login.png');

    console.log('現在のURL:', this.page.url());

    // ハンバーガーメニューまたはレポートリンクを探す
    try {
      // レポートメニューを探す（テキストベース）
      const reportLinks = await this.page.locator('a:has-text("レポート"), a:has-text("Report"), a[href*="report"]').all();
      console.log(`レポートリンク数: ${reportLinks.length}`);

      if (reportLinks.length > 0) {
        console.log('レポートリンクをクリック');
        await reportLinks[0].click();
        await this.page.waitForTimeout(3000);
        await this.screenshot('amazon-report-menu.png');
      } else {
        // ハンバーガーメニューを開く
        const menuButton = this.page.locator('button[class*="menu"], button[class*="hamburger"], .hamburger-menu, [class*="nav-toggle"]').first();
        if (await menuButton.isVisible()) {
          console.log('メニューボタンをクリック');
          await menuButton.click();
          await this.page.waitForTimeout(2000);
          await this.screenshot('amazon-menu-opened.png');

          // メニュー内のレポートリンクを探す
          const menuReportLinks = await this.page.locator('a:has-text("レポート"), a:has-text("Report")').all();
          if (menuReportLinks.length > 0) {
            console.log('メニュー内のレポートリンクをクリック');
            await menuReportLinks[0].click();
            await this.page.waitForTimeout(3000);
            await this.screenshot('amazon-report-page.png');
          }
        }
      }
    } catch (error: any) {
      console.log(`ナビゲーションエラー: ${error.message}`);
    }

    await this.page.waitForTimeout(3000);
    await this.screenshot('amazon-daily-report.png');
    console.log('日次レポートページ到達（現在のURL: ' + this.page.url() + '）');
  }

  async navigateToMonthlyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('月次レポートページに移動中...');

    // 既にレポートページにいる場合は、月次タブを探す
    const currentUrl = this.page.url();
    if (!currentUrl.includes('report')) {
      // ホームページから再度レポートに移動
      await this.navigateToDailyReport();
    }

    // 月次レポートタブまたはリンクを探す
    try {
      const monthlyLinks = await this.page.locator('a:has-text("月次"), a:has-text("Monthly"), a[href*="monthly"]').all();
      console.log(`月次リンク数: ${monthlyLinks.length}`);

      if (monthlyLinks.length > 0) {
        console.log('月次レポートリンクをクリック');
        await monthlyLinks[0].click();
        await this.page.waitForTimeout(3000);
      }
    } catch (error: any) {
      console.log(`月次レポートナビゲーションエラー: ${error.message}`);
    }

    await this.page.waitForTimeout(3000);
    await this.screenshot('amazon-monthly-report.png');
    console.log('月次レポートページに到達（現在のURL: ' + this.page.url() + '）');
  }

  async setReportPeriod(startYear: number, startMonth: number, endYear: number, endMonth: number) {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\nレポート期間を設定中: ${startYear}/${startMonth} ～ ${endYear}/${endMonth}`);

    try {
      // Amazonアソシエイトの期間選択要素を探す
      // 実際のセレクタは画面を見て調整が必要
      const dateSelectors = await this.page.locator('select, input[type="date"]').count();
      console.log(`日付選択要素数: ${dateSelectors}`);

      if (dateSelectors > 0) {
        // 期間選択の実装
        // Amazonの具体的なUIに応じて調整
        await this.page.waitForTimeout(1000);
        console.log('期間設定完了');
      } else {
        console.log('期間選択フィールドが表示されていません（デフォルト期間を使用）');
      }
    } catch (error: any) {
      console.log(`期間設定エラー: ${error.message}`);
    }
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    // ページを待機
    await this.page.waitForTimeout(3000);
    await this.screenshot('amazon-daily-before-search.png');

    // ページの全テキストを確認（デバッグ用）
    const pageText = await this.page.evaluate(() => document.body.innerText);
    console.log('\n=== ページテキスト（最初の500文字）===');
    console.log(pageText.substring(0, 500));
    console.log('================================\n');

    // データテーブルを探す
    console.log('データテーブルを探しています...');
    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    if (tables === 0) {
      // テーブルがない場合、他の要素を探す
      console.log('\nテーブルが見つかりません。他のデータ構造を探しています...');

      // divベースのグリッドやリストを探す
      const dataRows = await this.page.locator('[class*="row"], [class*="item"], [class*="data"]').count();
      console.log(`データ行候補: ${dataRows}件`);
    }

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      const isVisible = await table.isVisible();

      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr').count();
      const theadRows = await table.locator('thead tr').count();

      if (tbodyRows === 0 && theadRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (rows: ${tbodyRows})`);

      // ヘッダーを確認
      const headers = await table.locator('thead th, thead td').allTextContents();
      console.log(`ヘッダー:`, headers.map(h => h.trim()));

      // 最初の行をチェック
      if (tbodyRows > 0) {
        const firstRow = table.locator('tbody tr').first();
        const firstCells = await firstRow.locator('td, th').allTextContents();
        console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 50)));

        // 日付パターンをチェック（より柔軟に）
        const hasDatePattern = firstCells.some(cell =>
          /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
          /\d{1,2}[/-]\d{1,2}/.test(cell) ||
          /\d{4}年\d{1,2}月\d{1,2}日/.test(cell)
        );

        const hasRevenueHeader = headers.some(h =>
          h.includes('紹介料') ||
          h.includes('収益') ||
          h.includes('報酬') ||
          h.includes('Revenue') ||
          h.includes('Earnings')
        );

        if (hasDatePattern || hasRevenueHeader || headers.some(h => h.includes('日付') || h.includes('Date'))) {
          console.log(`\nデータテーブル発見！`);

          // データを抽出
          for (let i = 0; i < tbodyRows; i++) {
            const row = table.locator('tbody tr').nth(i);
            const cells = await row.locator('td, th').allTextContents();

            let dateValue = '';
            let revenueValue = '';

            // 最初の日付を取得
            for (let j = 0; j < cells.length; j++) {
              const cell = cells[j].trim();
              if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
                  /\d{1,2}[/-]\d{1,2}/.test(cell) ||
                  /\d{4}年\d{1,2}月\d{1,2}日/.test(cell)) {
                dateValue = cell;
                break;
              }
            }

            // 金額列を取得（報酬、紹介料など）
            // 複数の金額がある場合は、最後の列を優先
            for (let j = cells.length - 1; j >= 0; j--) {
              const cell = cells[j].trim();
              // ¥マーク、カンマ、数字を含む、または純粋な数字
              if (/[¥$]\s*[\d,]+/.test(cell) || /^[\d,]+\.?\d*円?$/.test(cell)) {
                revenueValue = cell;
                break;
              }
            }

            if (dateValue && revenueValue) {
              console.log(`${dateValue}: ${revenueValue}`);
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
    }

    if (data.length === 0) {
      console.log('\nデータが見つかりません。');
      console.log('ページのHTMLを確認してください。');
    }

    await this.screenshot('amazon-daily-data-final.png');
    console.log(`\n${data.length}件のデータを取得しました`);
    return data;
  }

  // Alias for monthly scrapers
  async extractDailyData() {
    return await this.scrapeDailyData();
  }

  async scrapeMonthlyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('月次データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    // ページを待機
    await this.page.waitForTimeout(2000);
    await this.screenshot('amazon-monthly-before-search.png');

    // データテーブルを探す
    console.log('\nデータテーブルを探しています...');
    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      const isVisible = await table.isVisible();

      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (rows: ${tbodyRows})`);

      // ヘッダーを確認
      const headers = await table.locator('thead th, thead td').allTextContents();
      console.log(`ヘッダー:`, headers.map(h => h.trim()));

      // 最初の行をチェック
      const firstRow = table.locator('tbody tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();
      console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 30)));

      // 年月パターンをチェック (YYYY/MM 形式または YYYY年MM月 形式)
      const hasYearMonthPattern = firstCells.some(cell =>
        (/\d{4}[/-]\d{1,2}/.test(cell) && !/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)) ||
        /\d{4}年\d{1,2}月/.test(cell)
      );

      if (hasYearMonthPattern || headers.some(h => h.includes('月') || h.includes('Month'))) {
        console.log(`\n月次データテーブル発見！`);

        // データを抽出
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          // 最初の年月を取得
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j].trim();
            if ((/\d{4}[/-]\d{1,2}/.test(cell) && !/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)) ||
                /\d{4}年\d{1,2}月/.test(cell)) {
              dateValue = cell;
              break;
            }
          }

          // 最後の金額列を取得（報酬合計）
          for (let j = cells.length - 1; j >= 0; j--) {
            const cell = cells[j].trim();
            if (/[¥$]\s*[\d,]+/.test(cell) || /^[\d,]+円?$/.test(cell)) {
              revenueValue = cell;
              break;
            }
          }

          if (dateValue && revenueValue) {
            console.log(`${dateValue}: ${revenueValue}`);
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
      console.log('\nデータが見つかりません。');
    }

    await this.screenshot('amazon-monthly-data-final.png');
    console.log(`\n${data.length}件のデータを取得しました`);
    return data;
  }

  async screenshot(filename: string) {
    if (!this.page) return;
    await this.page.screenshot({
      path: `screenshots/${filename}`,
      fullPage: true
    });
    console.log(`スクリーンショット保存: ${filename}`);
  }

  async saveToDatabase(data: DailyData[], tableName: 'daily_actuals' | 'actuals' = 'daily_actuals') {
    console.log(`\nSupabase (${tableName}テーブル) に保存中...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const item of data) {
      // ¥, $, 円, カンマを削除して数値に変換
      const cleanAmount = item.confirmedRevenue.replace(/[¥$,円]/g, '').trim();
      const amount = parseFloat(cleanAmount);

      if (isNaN(amount)) {
        console.error(`${item.date} の金額変換失敗: "${item.confirmedRevenue}" -> "${cleanAmount}"`);
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
        console.error(`${item.date} の保存に失敗:`, error.message);
        failCount++;
      } else {
        successCount++;
      }
    }

    console.log(`\n保存完了: ${successCount}件成功, ${failCount}件失敗\n`);
  }

  // Alias for monthly scrapers
  async saveToSupabase(data: DailyData[]) {
    return await this.saveToDatabase(data);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('ブラウザを閉じました');
    }
  }
}

// メイン実行
async function main() {
  // Supabaseから必要な情報を取得
  const { data: asp, error: aspError } = await supabase
    .from('asps')
    .select('id')
    .eq('name', 'Amazonアソシエイト')
    .single();

  if (aspError) {
    console.error('ASP検索エラー:', aspError);
    return;
  }

  if (!asp) {
    console.error('Amazonアソシエイトの情報が取得できませんでした');
    return;
  }

  console.log('ASP ID:', asp.id);

  const { data: credentials, error: credError } = await supabase
    .from('asp_credentials')
    .select('username_secret_key, password_secret_key')
    .eq('asp_id', asp.id)
    .eq('media_id', '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12')
    .single();

  if (credError) {
    console.error('認証情報検索エラー:', credError);
    return;
  }

  if (!credentials) {
    console.error('認証情報が取得できませんでした');
    return;
  }

  console.log('認証情報を取得しました');

  // 固定値
  const mediaId = '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12'; // ReRe
  const accountItemId = 'a6df5fab-2df4-4263-a888-ab63348cccd5'; // アフィリエイト

  console.log('\nAmazonアソシエイト 日別レポート取得');
  console.log(`メディアID: ${mediaId}`);
  console.log(`勘定科目ID: ${accountItemId}`);
  console.log(`ASP ID: ${asp.id}\n`);

  const scraper = new AmazonDailyScraper(
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

  try {
    await scraper.initialize();
    await scraper.login();

    // 日次レポート取得（2025年1月〜10月）
    console.log('\n' + '='.repeat(50));
    console.log('日次レポートを取得中（2025年1月〜10月）');
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
    console.log('月次レポートを取得中（2025年1月〜10月）');
    console.log('='.repeat(50) + '\n');

    await scraper.navigateToMonthlyReport();

    // 2025年1月から10月までの期間を設定
    await scraper.setReportPeriod(2025, 1, 2025, 10);

    const monthlyData = await scraper.scrapeMonthlyData();

    if (monthlyData.length > 0) {
      // 月次データは actuals テーブルに保存（各月の末日として保存）
      const monthlyDataForDb = monthlyData.map(item => {
        // YYYY/MM または YYYY年MM月 形式から変換
        let year: string, month: string;

        if (item.date.includes('年')) {
          // YYYY年MM月 形式
          const match = item.date.match(/(\d{4})年(\d{1,2})月/);
          if (match) {
            year = match[1];
            month = match[2];
          } else {
            return item;
          }
        } else {
          // YYYY/MM または YYYY-MM 形式
          const parts = item.date.split(/[/-]/);
          year = parts[0];
          month = parts[1];
        }

        // その月の最終日を取得
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        return {
          date: `${year}-${month.padStart(2, '0')}-${lastDay}`, // YYYY-MM-末日
          confirmedRevenue: item.confirmedRevenue
        };
      });

      await scraper.saveToDatabase(monthlyDataForDb, 'actuals');
    }

    console.log('\n全ての処理が完了しました！');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

// 直接実行
if (require.main === module) {
  main();
}

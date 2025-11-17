import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface FelmatCredentials {
  username: string;
  password: string;
}

interface DailyData {
  date: string;
  confirmedRevenue: string;
}

interface ScraperConfig {
  headless?: boolean;
  startYearMonth?: string; // YYYYMM format (e.g., "202501")
  endYearMonth?: string; // YYYYMM format (e.g., "202502")
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

export class FelmatDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: FelmatCredentials;
  private config: ScraperConfig;

  constructor(credentials: FelmatCredentials, config: ScraperConfig) {
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

    console.log('🔐 felmatにログイン中...');

    await this.page.goto('https://www.felmat.net/publisher/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await this.page.waitForTimeout(3000);

    await this.page.screenshot({ path: 'screenshots/felmat-login-page.png', fullPage: true });
    console.log('📸 ログインページのスクリーンショット保存');

    // ログインIDとパスワードを入力
    const loginIdInput = this.page.locator('input[name="login_id"], input[type="text"]').first();
    const passwordInput = this.page.locator('input[name="password"], input[type="password"]').first();

    if (await loginIdInput.count() > 0) {
      await loginIdInput.fill(this.credentials.username);
      console.log('ログインID入力完了');
    }

    if (await passwordInput.count() > 0) {
      await passwordInput.fill(this.credentials.password);
      console.log('パスワード入力完了');
    }

    await this.page.waitForTimeout(1000);

    // ログインボタンをクリック (テキストは "LOG IN")
    const loginButton = this.page.locator('button:has-text("LOG IN"), input[type="submit"]').first();
    if (await loginButton.count() > 0) {
      console.log('ログインボタンをクリック中...');
      await loginButton.click();
      await this.page.waitForTimeout(5000);

      await this.page.screenshot({ path: 'screenshots/felmat-after-login.png', fullPage: true });
      console.log('📸 ログイン後のスクリーンショット保存');
    } else {
      console.log('⚠️  ログインボタンが見つかりません');
    }

    console.log('✅ ログイン処理完了');
  }

  async navigateToDailyReport() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 日別レポートページに移動中...');

    // レポートメニューをクリック
    const reportMenu = this.page.locator('a:has-text("レポート")').first();
    if (await reportMenu.count() > 0) {
      console.log('レポートメニューをクリック中...');
      await reportMenu.click();
      await this.page.waitForTimeout(2000);
    }

    // 日別レポートリンクを探してクリック（ドロップダウンメニュー内の「日別」）
    const dailyReportLink = this.page.locator('a:has-text("日別")').first();
    if (await dailyReportLink.count() > 0) {
      console.log('日別レポートをクリック中...');
      await dailyReportLink.click();
      await this.page.waitForTimeout(3000);
    } else {
      console.log('⚠️  日別レポートリンクが見つかりません');
    }

    await this.page.screenshot({ path: 'screenshots/felmat-daily-page.png', fullPage: true });
    console.log('📸 日別レポートページのスクリーンショット保存');

    // 期間選択がある場合
    if (this.config.startYearMonth && this.config.endYearMonth) {
      console.log(`📅 期間選択: ${this.config.startYearMonth} ～ ${this.config.endYearMonth}`);

      // YYYYMM形式をYYYY-MM-DDに変換
      const formatStartDate = (yyyymm: string) => {
        const year = yyyymm.substring(0, 4);
        const month = yyyymm.substring(4, 6);
        return `${year}-${month}-01`;
      };

      const formatEndDate = (yyyymm: string) => {
        const year = parseInt(yyyymm.substring(0, 4));
        const month = parseInt(yyyymm.substring(4, 6));
        const lastDay = new Date(year, month, 0).getDate();
        return `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
      };

      const startFormatted = formatStartDate(this.config.startYearMonth);
      const endFormatted = formatEndDate(this.config.endYearMonth);

      console.log(`📅 日付範囲: ${startFormatted} ～ ${endFormatted}`);

      // 表示期間の入力フィールドを探して入力
      // 表示期間セクション内のinputフィールドを探す（name属性で特定）
      const startDateInput = this.page.locator('input').filter({ hasText: /^\d{4}-\d{2}-\d{2}$/ }).first();
      const endDateInput = this.page.locator('input').filter({ hasText: /^\d{4}-\d{2}-\d{2}$/ }).nth(1);

      // または、すべてのvisibleなinputフィールドを取得して、日付フォーマットのものだけ抽出
      const allInputs = await this.page.locator('input[type="text"]:visible').all();

      let startInput = null;
      let endInput = null;

      for (const input of allInputs) {
        const value = await input.inputValue().catch(() => '');
        if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          if (!startInput) {
            startInput = input;
          } else if (!endInput) {
            endInput = input;
            break;
          }
        }
      }

      if (startInput && endInput) {
        // 開始日入力
        await startInput.click();
        await this.page.waitForTimeout(300);
        await startInput.fill('');
        await this.page.waitForTimeout(200);
        await startInput.fill(startFormatted);
        console.log(`開始日入力完了: ${startFormatted}`);

        // Tabキーで次のフィールドに移動（カレンダーを閉じる）
        await this.page.keyboard.press('Tab');
        await this.page.waitForTimeout(500);

        // 終了日入力
        await endInput.click();
        await this.page.waitForTimeout(300);
        await endInput.fill('');
        await this.page.waitForTimeout(200);
        await endInput.fill(endFormatted);
        console.log(`終了日入力完了: ${endFormatted}`);

        // カレンダーを閉じるために、ページの他の部分をクリック
        await this.page.locator('body').click({ position: { x: 0, y: 0 } });
        await this.page.waitForTimeout(500);
      } else {
        console.log('⚠️  日付入力フィールドが見つかりません');
      }

      await this.page.waitForTimeout(1000);

      // 抽出ボタンをクリック
      const allButtons = await this.page.locator('button:visible').all();

      let searchButtonFound = false;
      for (const button of allButtons) {
        const buttonText = await button.textContent().catch(() => '');
        if (buttonText && buttonText.includes('上記条件で一覧を抽出')) {
          console.log('🔍 データ抽出中...');
          await button.click();
          await this.page.waitForTimeout(3000);
          console.log('✅ データ抽出完了');
          searchButtonFound = true;
          break;
        }
      }

      if (!searchButtonFound) {
        console.log('⚠️  抽出ボタンが見つかりませんでした。');
      }

      await this.page.screenshot({ path: 'screenshots/felmat-daily-report-result.png', fullPage: true });
      console.log('📸 日別レポート結果のスクリーンショット保存');
    }
  }

  async extractDailyData(): Promise<DailyData[]> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 日別データ取得中...');

    const data: DailyData[] = [];

    // テーブルを探す（ヘッダーに「年月日」が含まれるテーブル）
    const tables = await this.page.locator('table').count();
    console.log(`\nテーブル数: ${tables}`);

    if (tables === 0) {
      console.log('⚠️  テーブルが見つかりません');
      return data;
    }

    // 日別レポートのテーブルを取得（最初のテーブルがデータテーブル）
    const table = this.page.locator('table').first();

    const rows = await table.locator('tbody tr').count();
    console.log(`テーブル行数: ${rows}\n`);

    // 各行からデータを抽出
    for (let i = 0; i < rows; i++) {
      const row = table.locator('tbody tr').nth(i);
      const cells = await row.locator('td').allTextContents();

      if (cells.length >= 9) {
        const dateText = cells[0]?.trim();

        // 日付フォーマット: 2025年10月31日（金） → 2025-10-31
        const dateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

        if (dateMatch) {
          const year = dateMatch[1];
          const month = dateMatch[2].padStart(2, '0');
          const day = dateMatch[3].padStart(2, '0');
          const formattedDate = `${year}-${month}-${day}`;

          // 承認報酬（税抜）は8番目の列（インデックス8）
          const confirmedRevenue = cells[8]?.trim() || '0';
          const revenue = confirmedRevenue.replace(/[,円]/g, '');

          console.log(`${formattedDate}: ${confirmedRevenue}`);

          data.push({
            date: formattedDate,
            confirmedRevenue: revenue,
          });
        }
      }
    }

    console.log(`\n✅ ${data.length}件のデータを取得しました`);
    return data;
  }

  async navigateToMonthlyReport() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 月別レポートページに移動中...');

    // レポートメニューをクリック
    const reportMenu = this.page.locator('a:has-text("レポート")').first();
    if (await reportMenu.count() > 0) {
      console.log('レポートメニューをクリック中...');
      await reportMenu.click();
      await this.page.waitForTimeout(2000);
    }

    // 月別レポートリンクを探してクリック（ドロップダウンメニュー内の「月別」）
    const monthlyReportLink = this.page.locator('a:has-text("月別")').first();
    if (await monthlyReportLink.count() > 0) {
      console.log('月別レポートをクリック中...');
      await monthlyReportLink.click();
      await this.page.waitForTimeout(3000);
    } else {
      console.log('⚠️  月別レポートリンクが見つかりません');
    }

    await this.page.screenshot({ path: 'screenshots/felmat-monthly-page.png', fullPage: true });
    console.log('📸 月別レポートページのスクリーンショット保存');
    console.log('✅ 月別レポートページに到達');
  }

  async scrapeMonthlyData(): Promise<DailyData[]> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 月別データ取得中...');

    const data: DailyData[] = [];

    // テーブルを探す
    const tables = await this.page.locator('table').count();
    console.log(`\nテーブル数: ${tables}`);

    if (tables === 0) {
      console.log('⚠️  テーブルが見つかりません');
      return data;
    }

    // 月別レポートのテーブルを取得
    const table = this.page.locator('table').first();
    const rows = await table.locator('tbody tr').count();
    console.log(`テーブル行数: ${rows}\n`);

    // 各行からデータを抽出
    for (let i = 0; i < rows; i++) {
      const row = table.locator('tbody tr').nth(i);
      const cells = await row.locator('td').allTextContents();

      if (cells.length >= 8) {
        const dateText = cells[0]?.trim();

        // 日付フォーマット: 2025年10月 → 2025/10
        const dateMatch = dateText.match(/(\d{4})年(\d{1,2})月/);

        if (dateMatch) {
          const year = dateMatch[1];
          const month = dateMatch[2].padStart(2, '0');
          const formattedDate = `${year}/${month}`;

          // 承認報酬（税抜）を取得
          const confirmedRevenue = cells[8]?.trim() || '0';
          const revenue = confirmedRevenue.replace(/[,円]/g, '');

          console.log(`${formattedDate}: ${confirmedRevenue}`);

          data.push({
            date: formattedDate,
            confirmedRevenue: revenue,
          });
        }
      }
    }

    console.log(`\n✅ ${data.length}件のデータを取得しました`);
    return data;
  }

  async saveToSupabase(data: DailyData[], tableName: 'daily_actuals' | 'actuals' = 'daily_actuals') {
    const { createClient } = await import('@supabase/supabase-js');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`\n💾 Supabase (${tableName}テーブル) に保存中...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const item of data) {
      const amount = parseInt(item.confirmedRevenue, 10);

      if (isNaN(amount)) {
        console.log(`⚠️  スキップ: ${item.date} - 無効な金額`);
        errorCount++;
        continue;
      }

      const { error } = await supabase.from(tableName).upsert(
        {
          date: item.date,
          amount,
          media_id: this.config.mediaId,
          account_item_id: this.config.accountItemId,
          asp_id: this.config.aspId,
        },
        {
          onConflict: 'date,media_id,account_item_id,asp_id',
        }
      );

      if (error) {
        console.error(`❌ エラー (${item.date}):`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }

    console.log(`\n✅ 保存完了: ${successCount}件成功, ${errorCount}件失敗\n`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('✅ 全ての処理が完了しました！');
      console.log('🔒 ブラウザを閉じました');
    }
  }
}

// メイン処理
async function main() {
  console.log('\n📋 felmat 日別レポート取得');

  const credentials: FelmatCredentials = {
    username: 'rere-dev',
    password: '6345ejrfideg',
  };

  const config: ScraperConfig = {
    headless: true,
    mediaId: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    accountItemId: 'a6df5fab-2df4-4263-a888-ab63348cccd5', // アフィリエイト
    aspId: 'b754b95f-01d0-4994-92f7-892f8c8aa760', // felmat
  };

  console.log(`📱 メディアID: ${config.mediaId}`);
  console.log(`💰 勘定科目ID: ${config.accountItemId}`);
  console.log(`🔗 ASP ID: ${config.aspId}\n`);

  const scraper = new FelmatDailyScraper(credentials, config);

  try {
    await scraper.initialize();
    await scraper.login();

    console.log('現在のURL:', await scraper['page']?.url());

    // 日別レポートページに移動
    await scraper.navigateToDailyReport();

    // 日別データを抽出・保存
    const dailyData = await scraper.extractDailyData();
    console.log(`\n取得したデータ件数: ${dailyData.length}`);

    if (dailyData.length > 0) {
      await scraper.saveToSupabase(dailyData, 'daily_actuals');
    }

    // 月別レポートページに移動
    await scraper.navigateToMonthlyReport();

    // 月別データを抽出・保存
    const monthlyData = await scraper.scrapeMonthlyData();
    console.log(`\n取得したデータ件数: ${monthlyData.length}`);

    if (monthlyData.length > 0) {
      // 月次データは YYYY/MM → YYYY-MM-末日 に変換
      const monthlyDataForDb = monthlyData.map(item => {
        const [year, month] = item.date.split('/');
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        return {
          date: `${year}-${month.padStart(2, '0')}-${lastDay}`,
          confirmedRevenue: item.confirmedRevenue
        };
      });

      await scraper.saveToSupabase(monthlyDataForDb, 'actuals');
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

main().catch(console.error);

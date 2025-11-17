import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface AfbCredentials {
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

export class AfbDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: AfbCredentials;
  private config: ScraperConfig;

  constructor(credentials: AfbCredentials, config: ScraperConfig) {
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

    console.log('🔐 afbにログイン中...');

    try {
      // トップページにアクセス（ここに直接ログインフォームがある）
      await this.page.goto('https://www.afi-b.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // ページが完全に読み込まれるのを待つ
      await this.page.waitForTimeout(3000);
      await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await this.screenshot('afb-top-page.png');

      console.log('ログインフォームを探しています...');

      // ログインフォームがページ内にあるか確認
      const loginInputs = await this.page.locator('input[name="login_name"]').count();
      console.log(`ログインフィールド数: ${loginInputs}`);

      if (loginInputs === 0) {
        throw new Error('ログインフォームが見つかりません');
      }

      // 表示されているログインフィールドを探す
      const allLoginInputs = await this.page.locator('input[name="login_name"]').all();
      let visibleLoginInput = null;

      for (const input of allLoginInputs) {
        const isVisible = await input.isVisible().catch(() => false);
        if (isVisible) {
          visibleLoginInput = input;
          console.log('✓ 表示されているログインフィールドを発見');
          break;
        }
      }

      if (!visibleLoginInput) {
        console.log('⚠️ 表示されているフィールドが見つかりません。最初のフィールドを使用します');
        visibleLoginInput = this.page.locator('input[name="login_name"]').first();
      }

      // ログインID入力
      await visibleLoginInput.scrollIntoViewIfNeeded().catch(() => {});
      await visibleLoginInput.fill(this.credentials.username);
      console.log('✓ ログインID入力完了');
      await this.page.waitForTimeout(500);

      // パスワードフィールドを探す
      const allPasswordInputs = await this.page.locator('input[type="password"]').all();
      let visiblePasswordInput = null;

      for (const input of allPasswordInputs) {
        const isVisible = await input.isVisible().catch(() => false);
        if (isVisible) {
          visiblePasswordInput = input;
          console.log('✓ 表示されているパスワードフィールドを発見');
          break;
        }
      }

      if (!visiblePasswordInput) {
        console.log('⚠️ 表示されているパスワードフィールドが見つかりません。最初のフィールドを使用します');
        visiblePasswordInput = this.page.locator('input[type="password"]').first();
      }

      // パスワード入力
      await visiblePasswordInput.scrollIntoViewIfNeeded().catch(() => {});
      await visiblePasswordInput.fill(this.credentials.password);
      console.log('✓ パスワード入力完了');
      await this.page.waitForTimeout(1000);

      await this.screenshot('afb-before-login-submit.png');

      // ログインボタンを探す（パートナー会員のログインボタン）
      console.log('ログインボタンを探しています...');

      // ボタンを探す（テキストが「ログイン」、type="submit"、またはボタン要素）
      const loginButtons = await this.page.locator('button:has-text("ログイン"), input[type="submit"][value*="ログイン"]').all();
      console.log(`ログインボタン候補数: ${loginButtons.length}`);

      let clickedButton = false;
      for (let i = 0; i < loginButtons.length; i++) {
        const button = loginButtons[i];
        const isVisible = await button.isVisible().catch(() => false);

        if (isVisible) {
          console.log(`✓ ${i + 1}番目の表示されているログインボタンをクリック`);
          await button.scrollIntoViewIfNeeded().catch(() => {});
          await button.click();
          clickedButton = true;
          break;
        }
      }

      if (!clickedButton) {
        console.log('⚠️ ログインボタンが見つかりません。Enterキーで送信を試みます');
        await visiblePasswordInput.press('Enter');
      }

      // ログイン処理を待つ
      console.log('ログイン処理を待機中...');
      await this.page.waitForTimeout(5000);
      await this.screenshot('afb-after-login.png');

      const currentUrl = this.page.url();
      console.log('✅ ログイン処理完了');
      console.log(`現在のURL: ${currentUrl}`);

      // ログイン失敗を確認
      if (currentUrl.includes('failedlogin') || currentUrl.includes('error')) {
        throw new Error('ログインに失敗しました。認証情報を確認してください。');
      }

      // ログイン成功の確認（URLがpartnerページに遷移したか）
      if (!currentUrl.includes('partner') && !currentUrl.includes('p.afi-b')) {
        console.log('⚠️ ログイン後のページ遷移が確認できません');
        // 5秒待ってもう一度確認
        await this.page.waitForTimeout(5000);
        const finalUrl = this.page.url();
        console.log(`最終URL: ${finalUrl}`);

        if (finalUrl === 'https://www.afi-b.com/') {
          throw new Error('ログイン後もトップページのままです。認証情報を確認してください。');
        }
      }

    } catch (error) {
      console.error('ログイン処理でエラー:', error);
      await this.screenshot('afb-login-error.png');
      throw error;
    }
  }

  async navigateToDailyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日次レポートページに移動中...');

    // レポートメニューにホバー
    const reportMenu = await this.page.locator('text=レポート').first();
    await reportMenu.hover();
    await this.page.waitForTimeout(2000);

    // 日別レポートをクリック
    await this.page.click('text=日別レポート');
    await this.page.waitForTimeout(3000);

    await this.screenshot('afb-daily-report.png');
    console.log('✅ 日次レポートページに到達');
  }

  async setReportPeriod(startYear: number, startMonth: number, endYear: number, endMonth: number) {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\n📅 レポート期間を設定中: ${startYear}/${startMonth} ～ ${endYear}/${endMonth}`);

    try {
      // 開始年を選択
      const startYearSelect = this.page.locator('select[name="start_year"]:visible').first();
      const startYearVisible = await startYearSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (startYearVisible) {
        await startYearSelect.selectOption(startYear.toString());
        console.log(`✓ 開始年: ${startYear}`);
        await this.page.waitForTimeout(500);

        // 開始月を選択（値が"1"か"01"かを確認）
        const startMonthSelect = this.page.locator('select[name="start_month"]:visible').first();
        const monthOptions = await startMonthSelect.locator('option').allTextContents();
        console.log(`月の選択肢: ${monthOptions.slice(0, 5).join(', ')}`);

        // 0埋めした値を試す
        const monthValue = startMonth.toString().padStart(2, '0');
        await startMonthSelect.selectOption(monthValue);
        console.log(`✓ 開始月: ${startMonth} (value: ${monthValue})`);
        await this.page.waitForTimeout(500);

        // 終了年を選択
        const endYearSelect = this.page.locator('select[name="end_year"]:visible').first();
        await endYearSelect.selectOption(endYear.toString());
        console.log(`✓ 終了年: ${endYear}`);
        await this.page.waitForTimeout(500);

        // 終了月を選択（0埋め）
        const endMonthSelect = this.page.locator('select[name="end_month"]:visible').first();
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

    // レポートメニューにホバー
    const reportMenu = await this.page.locator('text=レポート').first();
    await reportMenu.hover();
    await this.page.waitForTimeout(2000);

    // 月別レポートをクリック（force: trueで強制的にクリック）
    await this.page.locator('text=月別レポート').first().click({ force: true });
    await this.page.waitForTimeout(3000);

    await this.screenshot('afb-monthly-report.png');
    console.log('✅ 月次レポートページに到達');
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    // ページを待機
    await this.page.waitForTimeout(2000);
    await this.screenshot('afb-daily-before-search.png');

    // レポート表示ボタンを探す（画像ボタンの可能性）
    console.log('\n🔍 レポート表示ボタンを探しています...');

    // inputタグのimageタイプを探す
    const imageInputs = await this.page.locator('input[type="image"]').count();
    console.log(`画像型inputボタン数: ${imageInputs}`);

    if (imageInputs > 0) {
      for (let i = 0; i < imageInputs; i++) {
        const input = this.page.locator('input[type="image"]').nth(i);
        const src = await input.getAttribute('src');
        const alt = await input.getAttribute('alt');
        const isVisible = await input.isVisible();
        console.log(`  ${i + 1}. src: ${src}, alt: ${alt}, visible: ${isVisible}`);

        if (isVisible && (alt?.includes('表示') || alt?.includes('検索') || src?.includes('disp') || src?.includes('search'))) {
          console.log(`\n✓ レポート表示ボタンをクリックします: ${alt}`);
          await input.click();

          // レポートの生成を待つ
          console.log('レポート生成を待機中...');
          await this.page.waitForTimeout(5000);
          await this.screenshot('afb-daily-after-search.png');
          break;
        }
      }
    }

    // 通常のボタンも探す
    const buttons = await this.page.locator('button:visible, input[type="submit"]:visible, input[type="button"]:visible').count();
    console.log(`\n可視ボタン数: ${buttons}`);

    // データテーブルを探す
    console.log('\n📊 データテーブルを探しています...');
    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      const tableClass = await table.getAttribute('class');
      const isVisible = await table.isVisible();

      // フィルタテーブルはスキップ
      if (tableClass && (tableClass.includes('search_main') || tableClass.includes('reportDispBtn'))) {
        continue;
      }

      // 非表示テーブルはスキップ
      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (class: ${tableClass}, rows: ${tbodyRows})`);

      // 最初の行をチェック
      const firstRow = table.locator('tbody tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();
      console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 30)));

      // 日付パターンをチェック
      const hasDatePattern = firstCells.some(cell =>
        /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
        /\d{1,2}[/-]\d{1,2}/.test(cell)
      );

      if (hasDatePattern) {
        console.log(`\n🎉 データテーブル発見！`);

        // ヘッダーを確認
        const headers = await table.locator('thead th, thead td').allTextContents();
        console.log(`ヘッダー:`, headers.map(h => h.trim()));

        // データを抽出 - 各行の最初の日付と最後の金額を取得
        // デバイス別の行（PC, SP, TEL等）はスキップして、合計行のみ取得
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          // Dev列（3列目）をチェック - PC, SP, TEL, TAB等の場合はスキップ
          if (cells.length >= 3) {
            const devCell = cells[2]?.trim();
            if (devCell && ['PC', 'SP', 'TEL', 'TAB'].includes(devCell.toUpperCase())) {
              continue; // デバイス別行はスキップ
            }
          }

          let dateValue = '';
          let revenueValue = '';

          // 最初の日付を取得
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j].trim();
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) || /\d{1,2}[/-]\d{1,2}/.test(cell)) {
              dateValue = cell;
              break; // 最初の日付のみ
            }
          }

          // 最後の金額列を取得（報酬合計）
          for (let j = cells.length - 1; j >= 0; j--) {
            const cell = cells[j].trim();
            if (/[¥\\d,]+/.test(cell) && cell.length > 0) {
              revenueValue = cell;
              break; // 最後の金額のみ
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

    await this.screenshot('afb-daily-data-final.png');
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
    await this.screenshot('afb-monthly-before-search.png');

    // レポート表示ボタンを探す
    console.log('\n🔍 レポート表示ボタンを探しています...');
    const imageInputs = await this.page.locator('input[type="image"]').count();
    console.log(`画像型inputボタン数: ${imageInputs}`);

    if (imageInputs > 0) {
      for (let i = 0; i < imageInputs; i++) {
        const input = this.page.locator('input[type="image"]').nth(i);
        const src = await input.getAttribute('src');
        const alt = await input.getAttribute('alt');
        const isVisible = await input.isVisible();

        if (isVisible && (alt?.includes('表示') || alt?.includes('検索'))) {
          console.log(`\n✓ レポート表示ボタンをクリックします: ${alt}`);
          await input.click();
          console.log('レポート生成を待機中...');
          await this.page.waitForTimeout(5000);
          await this.screenshot('afb-monthly-after-search.png');
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
      const isVisible = await table.isVisible();

      // フィルタテーブルはスキップ
      if (tableClass && (tableClass.includes('search_main') || tableClass.includes('reportDispBtn'))) {
        continue;
      }

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

        // データを抽出 - デバイス別の行をスキップ
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          // Dev列（2列目）をチェック - PC, SP, TEL, TAB等の場合はスキップ
          if (cells.length >= 2) {
            const devCell = cells[1]?.trim();
            if (devCell && ['PC', 'SP', 'TEL', 'TAB'].includes(devCell.toUpperCase())) {
              continue; // デバイス別行はスキップ
            }
          }

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

    await this.screenshot('afb-monthly-data-final.png');
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
    .eq('name', '売上')
    .eq('media_id', media?.id)
    .single();

  const { data: asp } = await supabase
    .from('asps')
    .select('id')
    .eq('name', 'afb')
    .single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    return;
  }

  console.log('\n📋 afb 日別レポート取得');
  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  const scraper = new AfbDailyScraper(
    {
      username: process.env.AFB_USERNAME || '',
      password: process.env.AFB_PASSWORD || '',
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

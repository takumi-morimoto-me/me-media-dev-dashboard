import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface A8AppCredentials {
  username: string;
  password: string;
}

interface DailyData {
  date: string;
  amount: number;
}

interface ScraperConfig {
  headless?: boolean;
  mediaId: string;
  accountItemId: string;
  aspId: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

/**
 * A8app 履歴データスクレイパー
 * 日付範囲指定、CSV出力、複数レポート形式を試行して履歴データを取得
 */
export class A8AppHistoricalScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: A8AppCredentials;
  private config: ScraperConfig;

  constructor(credentials: A8AppCredentials, config: ScraperConfig) {
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
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'ja-JP',
      timezoneId: 'Asia/Tokyo',
    });

    this.page = await context.newPage();
    console.log('✅ ブラウザ起動完了');
  }

  async login() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('🔐 A8app (SeedApp)にログイン中...');
    await this.page.goto('https://admin.seedapp.jp/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(3000);

    const loginIdInput = this.page.locator('input[type="email"], input[type="text"], input[name="email"]').first();
    const passwordInput = this.page.locator('input[type="password"]').first();

    if (await loginIdInput.count() > 0) {
      await loginIdInput.fill(this.credentials.username);
      console.log('ログインID入力完了');
      await this.page.waitForTimeout(500);
    }

    if (await passwordInput.count() > 0) {
      await passwordInput.fill(this.credentials.password);
      console.log('パスワード入力完了');
      await this.page.waitForTimeout(500);
    }

    const loginButton = this.page.locator('button[type="submit"], input[type="submit"]').first();
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await this.page.waitForTimeout(5000);
    }

    await this.screenshot('a8app-historical-after-login.png');
    console.log('✅ ログイン処理完了');
  }

  /**
   * 利用可能なレポートタイプを探索
   */
  async exploreReportTypes() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('\n🔍 利用可能なレポートタイプを探索中...');

    // すべてのリンクを取得
    const links = await this.page.locator('a').all();
    const reportLinks: { text: string; href: string }[] = [];

    for (const link of links) {
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text && (
        text.includes('レポート') ||
        text.includes('報告') ||
        text.includes('履歴') ||
        text.includes('データ') ||
        text.includes('CSV') ||
        text.includes('ダウンロード') ||
        text.includes('エクスポート') ||
        text.includes('月別') ||
        text.includes('日別')
      )) {
        reportLinks.push({ text: text.trim(), href: href || '' });
      }
    }

    console.log('\n📋 見つかったレポート関連リンク:');
    reportLinks.forEach((link, index) => {
      console.log(`  ${index + 1}. ${link.text} (${link.href})`);
    });

    await this.screenshot('a8app-available-reports.png');
    return reportLinks;
  }

  /**
   * 日付範囲セレクタを探索
   */
  async exploreDateRangeSelectors() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('\n🔍 日付範囲セレクタを探索中...');

    // 日別レポートページに移動
    const dailyReportLink = this.page.locator('a:has-text("日別レポート")');
    if (await dailyReportLink.count() > 0) {
      await dailyReportLink.click();
      await this.page.waitForTimeout(3000);
    }

    await this.screenshot('a8app-daily-report-page.png');

    // 日付入力フィールドを探す
    const dateInputs = await this.page.locator('input[type="date"], input[type="text"]').all();
    console.log(`\n📅 見つかった入力フィールド: ${dateInputs.length}件`);

    for (let i = 0; i < dateInputs.length; i++) {
      const input = dateInputs[i];
      const type = await input.getAttribute('type').catch(() => '');
      const name = await input.getAttribute('name').catch(() => '');
      const placeholder = await input.getAttribute('placeholder').catch(() => '');
      const value = await input.getAttribute('value').catch(() => '');

      console.log(`  ${i + 1}. type="${type}", name="${name}", placeholder="${placeholder}", value="${value}"`);
    }

    // セレクトボックスを探す
    const selects = await this.page.locator('select').all();
    console.log(`\n📋 見つかったセレクトボックス: ${selects.length}件`);

    for (let i = 0; i < selects.length; i++) {
      const select = selects[i];
      const name = await select.getAttribute('name').catch(() => '');
      const options = await select.locator('option').allTextContents();

      console.log(`  ${i + 1}. name="${name}", options: ${options.join(', ')}`);
    }

    // ボタンを探す
    const buttons = await this.page.locator('button').all();
    console.log(`\n🔘 見つかったボタン: ${buttons.length}件`);

    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent().catch(() => '');
      const type = await button.getAttribute('type').catch(() => '');

      if (text && (
        text.includes('検索') ||
        text.includes('表示') ||
        text.includes('取得') ||
        text.includes('更新') ||
        text.includes('CSV') ||
        text.includes('ダウンロード') ||
        text.includes('エクスポート')
      )) {
        console.log(`  ${i + 1}. "${text.trim()}" (type="${type}")`);
      }
    }

    await this.screenshot('a8app-date-range-controls.png');
  }

  /**
   * CSV出力機能を探索して実行
   */
  async tryCSVExport(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('\n🔍 CSV出力機能を探索中...');

    // CSV、ダウンロード、エクスポート関連のボタンやリンクを探す
    const csvButtons = await this.page.locator('button, a').all();

    for (const element of csvButtons) {
      const text = await element.textContent().catch(() => '');

      if (text && (
        text.includes('CSV') ||
        text.includes('ダウンロード') ||
        text.includes('エクスポート') ||
        text.toLowerCase().includes('download') ||
        text.toLowerCase().includes('export')
      )) {
        console.log(`✓ CSV関連ボタン発見: "${text.trim()}"`);

        try {
          await element.click();
          console.log('クリック実行...');

          // クリック後に画面が変わる場合があるので待機
          await this.page.waitForTimeout(3000);

          await this.screenshot('a8app-after-csv-click.png');
          console.log('⚠️ CSV機能は確認できましたが、自動ダウンロードは行いません');
          return false; // 手動での対応が必要
        } catch (error) {
          console.log(`⚠️ CSVクリック失敗: ${error}`);
        }
      }
    }

    console.log('❌ CSV出力機能が見つかりませんでした');
    return false;
  }

  /**
   * 特定の日付範囲でデータを試行取得
   */
  async tryDateRangeQuery(startDate: string, endDate: string): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\n🔍 日付範囲 ${startDate} 〜 ${endDate} でデータ取得を試行...`);

    // A8appの日付形式は YYYY/MM/DD
    const formattedStart = startDate.replace(/-/g, '/');
    const formattedEnd = endDate.replace(/-/g, '/');

    try {
      // flatpickrで readonly になっているため JavaScript で直接値を設定
      console.log(`開始日を設定: ${formattedStart}`);
      await this.page.evaluate((date) => {
        const input = document.querySelector('input[name="config_mo_daily_reports[start_date]"]') as HTMLInputElement;
        if (input) {
          input.value = date;
          input.removeAttribute('readonly');
          // flatpickr の内部状態も更新
          if ((input as any)._flatpickr) {
            (input as any)._flatpickr.setDate(date, true);
          }
          // change イベントを発火
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, formattedStart);
      await this.page.waitForTimeout(500);

      console.log(`終了日を設定: ${formattedEnd}`);
      await this.page.evaluate((date) => {
        const input = document.querySelector('input[name="config_mo_daily_reports[end_date]"]') as HTMLInputElement;
        if (input) {
          input.value = date;
          input.removeAttribute('readonly');
          // flatpickr の内部状態も更新
          if ((input as any)._flatpickr) {
            (input as any)._flatpickr.setDate(date, true);
          }
          // change イベントを発火
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, formattedEnd);
      await this.page.waitForTimeout(500);

      await this.screenshot(`a8app-date-set-${startDate}-to-${endDate}.png`);

      // フォーム送信（検索実行）
      // submitボタンまたはEnterキーで送信
      const submitButton = this.page.locator('button[type="submit"], input[type="submit"]');
      if (await submitButton.count() > 0) {
        console.log('検索ボタンをクリック...');
        await submitButton.first().click();
        await this.page.waitForTimeout(3000);
      } else {
        // submitボタンがない場合はEnterキーで送信
        console.log('Enterキーで送信...');
        await endDateInput.press('Enter');
        await this.page.waitForTimeout(3000);
      }

      await this.screenshot(`a8app-results-${startDate}-to-${endDate}.png`);

      // データを取得
      return await this.extractTableData();
    } catch (error) {
      console.error(`❌ 日付範囲クエリ失敗: ${error}`);
    }

    return [];
  }

  /**
   * テーブルからデータを抽出
   */
  async extractTableData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    const data: DailyData[] = [];

    const tables = await this.page.locator('table').count();
    console.log(`テーブル数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      if (!await table.isVisible()) continue;

      const rows = await table.locator('tbody tr').count();
      if (rows === 0) continue;

      const firstRow = table.locator('tbody tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();

      const hasDatePattern = firstCells.some(cell =>
        /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)
      );

      if (hasDatePattern) {
        const headerRow = table.locator('thead tr, tbody tr').first();
        const headerCells = await headerRow.locator('th, td').allTextContents();

        let revenueColumnIndex = -1;
        for (let i = 0; i < headerCells.length; i++) {
          if (headerCells[i].includes('成果報酬額') || headerCells[i].includes('報酬額') || headerCells[i].includes('金額')) {
            revenueColumnIndex = i;
            break;
          }
        }

        if (revenueColumnIndex === -1) continue;

        const dataStartIndex = headerCells.some(cell => /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)) ? 0 : 1;

        for (let i = dataStartIndex; i < rows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          for (const cell of cells) {
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell.trim())) {
              dateValue = cell.trim().replace(/\//g, '-');
              break;
            }
          }

          const revenueValue = cells[revenueColumnIndex]?.trim() || '';

          if (dateValue && revenueValue && revenueValue !== '合計') {
            const cleanAmount = revenueValue.replace(/[¥,円]/g, '').trim();
            const amount = parseFloat(cleanAmount);

            if (!isNaN(amount)) {
              data.push({ date: dateValue, amount });
              console.log(`✓ ${dateValue}: ¥${amount.toLocaleString()}`);
            }
          }
        }
        break;
      }
    }

    return data;
  }

  /**
   * 複数の月を順次取得
   */
  async scrapeHistoricalData(startYear: number, startMonth: number, endYear: number, endMonth: number): Promise<DailyData[]> {
    console.log(`\n📊 履歴データ取得: ${startYear}/${startMonth} 〜 ${endYear}/${endMonth}`);

    let allData: DailyData[] = [];
    let currentYear = startYear;
    let currentMonth = startMonth;

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      const monthStr = currentMonth.toString().padStart(2, '0');
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();

      const startDate = `${currentYear}-${monthStr}-01`;
      const endDate = `${currentYear}-${monthStr}-${lastDay}`;

      console.log(`\n📅 ${currentYear}年${currentMonth}月のデータを取得中...`);

      try {
        const monthData = await this.tryDateRangeQuery(startDate, endDate);

        if (monthData.length > 0) {
          console.log(`✅ ${monthData.length}件のデータを取得`);
          allData = [...allData, ...monthData];
        } else {
          console.log(`⚠️ データが見つかりませんでした`);
        }

        await this.page.waitForTimeout(2000); // レート制限対策
      } catch (error) {
        console.error(`❌ ${currentYear}/${currentMonth} の取得エラー:`, error);
      }

      // 次の月へ
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }

    console.log(`\n✅ 合計 ${allData.length}件の履歴データを取得しました`);
    return allData;
  }

  async saveToDatabase(data: DailyData[]) {
    console.log('\n💾 Supabase (daily_actuals) に保存中...');

    let inserted = 0;
    let errors = 0;

    for (const item of data) {
      const { error } = await supabase
        .from('daily_actuals')
        .upsert({
          date: item.date,
          media_id: this.config.mediaId,
          account_item_id: this.config.accountItemId,
          asp_id: this.config.aspId,
          amount: item.amount,
        }, {
          onConflict: 'date,media_id,account_item_id,asp_id'
        });

      if (error) {
        console.error(`  ❌ ${item.date} の保存エラー:`, error.message);
        errors++;
      } else {
        inserted++;
      }
    }

    console.log(`\n✅ 保存完了: ${inserted}件成功, ${errors}件失敗`);
  }

  async screenshot(filename: string) {
    if (!this.page) return;
    await this.page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 ブラウザを閉じました');
    }
  }
}

async function main() {
  const { data: media } = await supabase.from('media').select('id').eq('name', 'ReRe').single();
  const { data: accountItem } = await supabase.from('account_items').select('id').eq('name', 'アフィリエイト').eq('media_id', media!.id).single();
  const { data: asp } = await supabase.from('asps').select('id').eq('name', 'A8app').single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    return;
  }

  const { data: credentials } = await supabase
    .from('asp_credentials')
    .select('username_secret_key, password_secret_key')
    .eq('asp_id', asp.id)
    .eq('media_id', media.id)
    .single();

  if (!credentials?.username_secret_key) {
    console.error('A8appの認証情報が取得できませんでした');
    return;
  }

  console.log('\n📋 A8app 履歴データ取得');
  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}`);
  console.log('📅 対象期間: 2025年1月〜現在\n');

  const scraper = new A8AppHistoricalScraper(
    { username: credentials.username_secret_key, password: credentials.password_secret_key },
    { headless: false, mediaId: media.id, accountItemId: accountItem.id, aspId: asp.id }
  );

  try {
    await scraper.initialize();
    await scraper.login();

    // ステップ1: 利用可能なレポートタイプを探索
    console.log('\n========================================');
    console.log('ステップ1: レポートタイプの探索');
    console.log('========================================');
    await scraper.exploreReportTypes();

    // ステップ2: 日付範囲セレクタを探索
    console.log('\n========================================');
    console.log('ステップ2: 日付範囲セレクタの探索');
    console.log('========================================');
    await scraper.exploreDateRangeSelectors();

    // ステップ3: CSV出力を試行
    console.log('\n========================================');
    console.log('ステップ3: CSV出力の試行');
    console.log('========================================');
    const csvExported = await scraper.tryCSVExport();

    if (!csvExported) {
      // ステップ4: 日付範囲指定で履歴データ取得
      console.log('\n========================================');
      console.log('ステップ4: 日付範囲指定での履歴データ取得');
      console.log('========================================');

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const historicalData = await scraper.scrapeHistoricalData(2025, 1, currentYear, currentMonth);

      if (historicalData.length > 0) {
        await scraper.saveToDatabase(historicalData);
      }
    }

    console.log('\n✅ 全ての処理が完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    await scraper.screenshot('a8app-historical-error.png');
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

export default A8AppHistoricalScraper;

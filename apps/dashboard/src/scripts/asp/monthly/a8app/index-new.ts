import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface A8AppCredentials {
  username: string;
  password: string;
}

interface MonthlyData {
  yearMonth: string; // YYYY/MM
  confirmedRevenue: number;
}

interface ScraperConfig {
  headless?: boolean;
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

/**
 * A8app 月次スクレイパー（月次集計データ取得版）
 * 日次データを取得して月ごとに集計し、actualsテーブルに保存
 */
export class A8AppMonthlyScraper {
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
      headless: this.config.headless ?? true,
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
    await this.page.goto('https://app-af.a8.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(2000);

    const emailInput = this.page.locator('input[type="email"]');
    if (await emailInput.count() > 0) {
      await emailInput.fill(this.credentials.username);
      console.log('ログインID入力完了');
      await this.page.waitForTimeout(500);
    }

    const passwordInput = this.page.locator('input[type="password"]');
    if (await passwordInput.count() > 0) {
      await passwordInput.fill(this.credentials.password);
      console.log('パスワード入力完了');
      await this.page.waitForTimeout(500);
    }

    const loginButton = this.page.locator('button[type="submit"], input[type="submit"]');
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await this.page.waitForTimeout(3000);
    }

    console.log('✅ ログイン処理完了');
  }

  async getDailyDataForMonth(year: number, month: number): Promise<number> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`  📊 ${year}年${month}月の日次データを取得中...`);

    // レポートページに移動
    const reportLinks = await this.page.locator('a').all();
    for (const link of reportLinks) {
      const text = await link.textContent().catch(() => '');
      if (text?.includes('日別') || text?.includes('レポート')) {
        await link.click();
        await this.page.waitForTimeout(2000);
        break;
      }
    }

    // テーブルからデータを取得
    const tables = await this.page.locator('table').count();
    if (tables === 0) {
      console.log('  ⚠️  テーブルが見つかりません');
      return 0;
    }

    const table = this.page.locator('table').first();
    const rows = await table.locator('tbody tr').count();

    let monthTotal = 0;
    const targetYearMonth = `${year}/${month.toString().padStart(2, '0')}`;

    for (let i = 0; i < rows; i++) {
      const row = table.locator('tbody tr').nth(i);
      const cells = await row.locator('td, th').allTextContents();

      // 日付を探す
      let dateValue = '';
      for (const cell of cells) {
        if (/\d{4}\/\d{1,2}\/\d{1,2}/.test(cell.trim())) {
          dateValue = cell.trim();
          break;
        }
      }

      // 対象月のデータのみ集計
      if (dateValue.startsWith(targetYearMonth)) {
        // 報酬額を探す（最後の数値列）
        for (let j = cells.length - 1; j >= 0; j--) {
          const cellText = cells[j].trim().replace(/[,円]/g, '');
          const amount = parseFloat(cellText);
          if (!isNaN(amount)) {
            monthTotal += amount;
            break;
          }
        }
      }
    }

    return monthTotal;
  }

  async scrapeMonthlyData(startYear: number, startMonth: number, endYear: number, endMonth: number): Promise<MonthlyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 月次データを集計中...\n');
    const monthlyData: MonthlyData[] = [];

    let currentYear = startYear;
    let currentMonth = startMonth;

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
      try {
        const total = await this.getDailyDataForMonth(currentYear, currentMonth);

        const yearMonth = `${currentYear}/${currentMonth.toString().padStart(2, '0')}`;
        monthlyData.push({
          yearMonth,
          confirmedRevenue: total
        });

        console.log(`  ✓ ${yearMonth}: ¥${total.toLocaleString()}`);

        // 次の月へ
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      } catch (error) {
        console.error(`  ❌ ${currentYear}/${currentMonth} の取得エラー:`, error);
      }
    }

    console.log(`\n✅ ${monthlyData.length}件の月次データを取得しました`);
    return monthlyData;
  }

  async saveToActuals(data: MonthlyData[]) {
    console.log('\n💾 Supabase (actualsテーブル) に保存中...');

    let inserted = 0;
    let errors = 0;

    for (const item of data) {
      // 年月をYYYY-MM-DD形式に変換（月末の日付として保存）
      const [year, month] = item.yearMonth.split('/');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const formattedDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      const { error } = await supabase
        .from('actuals')
        .upsert(
          {
            date: formattedDate,
            amount: item.confirmedRevenue,
            media_id: this.config.mediaId,
            account_item_id: this.config.accountItemId,
            asp_id: this.config.aspId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'date,media_id,account_item_id,asp_id',
          }
        );

      if (error) {
        console.error(`  ❌ ${item.yearMonth} の保存エラー:`, error.message);
        errors++;
      } else {
        inserted++;
      }
    }

    console.log(`\n✅ 保存完了: ${inserted}件成功, ${errors}件失敗`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('🔒 ブラウザを閉じました');
    }
  }

  async screenshot(filename: string) {
    if (this.page) {
      await this.page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
    }
  }
}

async function main() {
  const credentials: A8AppCredentials = {
    username: process.env.A8APP_USERNAME || '',
    password: process.env.A8APP_PASSWORD || '',
  };

  if (!credentials.username || !credentials.password) {
    console.error('❌ A8APP_USERNAME と A8APP_PASSWORD を .env.local に設定してください');
    return;
  }

  const config: ScraperConfig = {
    headless: false,
    mediaId: process.env.RERE_MEDIA_ID || '',
    accountItemId: process.env.AFFILIATE_ACCOUNT_ITEM_ID || '',
    aspId: process.env.A8APP_ASP_ID || '',
  };

  if (!config.mediaId || !config.accountItemId || !config.aspId) {
    console.error('❌ RERE_MEDIA_ID, AFFILIATE_ACCOUNT_ITEM_ID, A8APP_ASP_ID を設定してください');
    return;
  }

  console.log('\n📋 A8app 月次データ取得');
  console.log(`📱 メディアID: ${config.mediaId}`);
  console.log(`💰 勘定科目ID: ${config.accountItemId}`);
  console.log(`🔗 ASP ID: ${config.aspId}`);
  console.log('📅 対象期間: 2025年1月〜現在\n');

  const scraper = new A8AppMonthlyScraper(credentials, config);

  try {
    await scraper.initialize();
    await scraper.login();

    // 現在の年月を取得
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 2025年1月から現在まで
    const data = await scraper.scrapeMonthlyData(2025, 1, currentYear, currentMonth);

    if (data.length > 0) {
      await scraper.saveToActuals(data);
    }

    console.log('\n✅ 全ての処理が完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    await scraper.screenshot('a8app-monthly-error.png');
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

export default A8AppMonthlyScraper;

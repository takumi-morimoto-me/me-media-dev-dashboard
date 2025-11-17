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
  confirmedRevenue: string;
}

interface ScraperConfig {
  headless?: boolean;
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

export class A8AppDailyScraper {
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
    await this.screenshot('a8app-login-page.png');

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

    await this.screenshot('a8app-before-login-click.png');

    const loginButton = this.page.locator('button[type="submit"], input[type="submit"]').first();
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await this.page.waitForTimeout(5000);
    }

    await this.screenshot('a8app-after-login.png');
    console.log('✅ ログイン処理完了');
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別レポートページに移動中...');

    // 左メニューの「日別レポート」をクリック
    const dailyReportLink = this.page.locator('a:has-text("日別レポート")');
    if (await dailyReportLink.count() > 0) {
      console.log('日別レポートリンクをクリック');
      await dailyReportLink.click();
      await this.page.waitForTimeout(3000);
    }

    await this.screenshot('a8app-daily-report-page.png');
    console.log('📊 日別データ取得中...');
    const data: DailyData[] = [];

    await this.page.waitForTimeout(2000);

    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

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
        // ヘッダー行から「成果報酬額」列のインデックスを見つける
        const headerRow = table.locator('thead tr, tbody tr').first();
        const headerCells = await headerRow.locator('th, td').allTextContents();

        let revenueColumnIndex = -1;
        for (let i = 0; i < headerCells.length; i++) {
          if (headerCells[i].includes('成果報酬額') || headerCells[i].includes('報酬額')) {
            revenueColumnIndex = i;
            console.log(`成果報酬額列を発見: ${i}列目 - ${headerCells[i]}`);
            break;
          }
        }

        if (revenueColumnIndex === -1) {
          console.log('⚠️ 成果報酬額列が見つかりませんでした');
          continue;
        }

        // データ行を取得（ヘッダー行をスキップ）
        const dataStartIndex = headerCells.some(cell => /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)) ? 0 : 1;

        for (let i = dataStartIndex; i < rows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';

          // 日付を探す
          for (const cell of cells) {
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell.trim())) {
              dateValue = cell.trim();
              break;
            }
          }

          // 成果報酬額列からデータを取得
          const revenueValue = cells[revenueColumnIndex]?.trim() || '';

          if (dateValue && revenueValue && revenueValue !== '合計') {
            console.log(`✓ ${dateValue}: ${revenueValue}`);
            data.push({ date: dateValue, confirmedRevenue: revenueValue });
          }
        }
        break;
      }
    }

    console.log(`\n✅ ${data.length}件のデータを取得しました`);
    return data;
  }

  // Alias for monthly scrapers
  async extractDailyData() {
    return await this.scrapeDailyData();
  }

  async screenshot(filename: string) {
    if (!this.page) return;
    await this.page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
  }

  async saveToDatabase(data: DailyData[]) {
    console.log(`\n💾 Supabaseに保存中...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const item of data) {
      const cleanAmount = item.confirmedRevenue.replace(/[¥,円]/g, '').trim();
      const amount = parseFloat(cleanAmount);

      if (isNaN(amount)) {
        failCount++;
        continue;
      }

      const { error } = await supabase
        .from('daily_actuals')
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

  const scraper = new A8AppDailyScraper(
    { username: credentials.username_secret_key, password: credentials.password_secret_key },
    { headless: false, mediaId: media.id, accountItemId: accountItem.id, aspId: asp.id }
  );

  try {
    await scraper.initialize();
    await scraper.login();
    const data = await scraper.scrapeDailyData();
    if (data.length > 0) await scraper.saveToDatabase(data);
  } catch (error) {
    console.error('エラー:', error);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

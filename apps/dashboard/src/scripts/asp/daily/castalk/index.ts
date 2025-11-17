import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface CASTALKCredentials {
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

export class CASTALKDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: CASTALKCredentials;
  private config: ScraperConfig;

  constructor(credentials: CASTALKCredentials, config: ScraperConfig) {
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

    console.log('🔐 CASTALKにログイン中...');

    await this.page.goto('https://castalk-partner.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(3000);
    await this.screenshot('castalk-login-page.png');

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

    await this.screenshot('castalk-before-login-click.png');

    const loginButton = this.page.locator('button[type="submit"], input[type="submit"]').first();
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await this.page.waitForTimeout(5000);
    }

    await this.screenshot('castalk-after-login.png');
    console.log('✅ ログイン処理完了');
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別レポートに移動中...');

    await this.page.waitForTimeout(2000);

    try {
      // 左メニューの「レポート管理」をクリックして展開
      const reportMenu = this.page.locator('text=レポート管理').first();
      if (await reportMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
        await reportMenu.click();
        await this.page.waitForTimeout(1000);
        console.log('✅ レポート管理メニューをクリック');
      }

      // 「日別レポート」リンクをクリック
      const dailyReportLink = this.page.locator('a:has-text("日別レポート"), a[href*="date_log"]').first();
      if (await dailyReportLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dailyReportLink.click();
        await this.page.waitForTimeout(3000);
        console.log('✅ 日別レポートページに移動');
      } else {
        console.log('⚠️ 日別レポートリンクが見つかりません。ホームページのデータを取得します');
      }
    } catch (error) {
      console.log('⚠️ ナビゲーションエラー。ホームページのデータを取得します:', error);
    }

    await this.screenshot('castalk-report-page.png');
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    const data: DailyData[] = [];

    await this.page.waitForTimeout(2000);
    await this.screenshot('castalk-data-page.png');

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
        console.log(`\n🎉 データテーブル発見！`);

        for (let i = 0; i < rows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          // 日付を取得 (2025/10/29 形式)
          for (const cell of cells) {
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell.trim())) {
              dateValue = cell.trim().replace(/\//g, '-'); // スラッシュをダッシュに変換
              break;
            }
          }

          // 報酬合計（最後の列）を取得
          const lastCell = cells[cells.length - 1].trim();
          if (lastCell && /\d+円/.test(lastCell)) {
            revenueValue = lastCell;
          }

          if (dateValue && revenueValue) {
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
  const { data: asp } = await supabase.from('asps').select('id').eq('name', 'CASTALK').single();

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
    console.error('CASTALKの認証情報が取得できませんでした');
    return;
  }

  const scraper = new CASTALKDailyScraper(
    { username: credentials.username_secret_key, password: credentials.password_secret_key },
    { headless: false, mediaId: media.id, accountItemId: accountItem.id, aspId: asp.id }
  );

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToReportPage();
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

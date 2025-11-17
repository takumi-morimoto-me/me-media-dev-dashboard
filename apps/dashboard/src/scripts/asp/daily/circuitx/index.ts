import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface CircuitXCredentials {
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

export class CircuitXDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: CircuitXCredentials;
  private config: ScraperConfig;

  constructor(credentials: CircuitXCredentials, config: ScraperConfig) {
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

    console.log('🔐 CircuitXにログイン中...');
    console.log('⚠️  CircuitXは非公開(クローズドASP)のため、ログインURLを直接指定する必要があります');

    // CircuitX requires a specific login URL
    // Try common ASP login URL patterns
    const possibleUrls = [
      'https://www.circuit-x.jp/login',
      'https://www.circuit-x.jp/member/login',
      'https://member.circuit-x.jp/login',
      'https://partner.circuit-x.jp/login',
    ];

    let loginSuccess = false;
    for (const url of possibleUrls) {
      try {
        console.log(`Trying login URL: ${url}`);
        await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 10000
        });

        await this.page.waitForTimeout(2000);

        // Check if we found a login page
        const loginIdInput = this.page.locator('input[type="email"], input[type="text"], input[name*="id"], input[name*="login"]').first();
        if (await loginIdInput.count() > 0) {
          console.log(`✓ Login page found at: ${url}`);
          loginSuccess = true;
          break;
        }
      } catch (error) {
        console.log(`✗ Failed to access: ${url}`);
        continue;
      }
    }

    if (!loginSuccess) {
      console.log('⚠️ Could not find CircuitX login page. Please check the login URL manually.');
      await this.screenshot('circuitx-login-page.png');
      return;
    }

    await this.screenshot('circuitx-login-page.png');

    const loginIdInput = this.page.locator('input[type="email"], input[type="text"], input[name*="id"], input[name*="login"]').first();
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

    await this.screenshot('circuitx-before-login-click.png');

    const loginButton = this.page.locator('button[type="submit"], input[type="submit"]').first();
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await this.page.waitForTimeout(5000);
    }

    await this.screenshot('circuitx-after-login.png');
    console.log('✅ ログイン処理完了');
    console.log(`現在のURL: ${this.page.url()}`);
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 レポートページに移動中...');

    await this.page.waitForTimeout(2000);

    // Look for report/data links
    const reportLinks = await this.page.locator('a').all();

    for (const link of reportLinks) {
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text?.includes('レポート') || text?.includes('成果') || text?.includes('実績') ||
          href?.includes('report') || href?.includes('stats') || href?.includes('performance')) {
        console.log(`レポートリンク発見: "${text}" (href: ${href})`);

        if (href?.includes('daily') || text?.includes('日別') || text?.includes('日次')) {
          console.log('日別レポートリンクをクリック中...');
          await link.click();
          await this.page.waitForTimeout(3000);
          break;
        } else if (text?.includes('レポート') || text?.includes('成果')) {
          console.log('レポートメニューをクリック中...');
          await link.click();
          await this.page.waitForTimeout(2000);
          break;
        }
      }
    }

    await this.page.waitForTimeout(2000);
    console.log('✅ レポートページに移動完了');
    console.log(`現在のURL: ${this.page.url()}`);
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    const data: DailyData[] = [];

    await this.page.waitForTimeout(2000);
    await this.screenshot('circuitx-data-page.png');

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
        for (let i = 0; i < rows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          for (const cell of cells) {
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell.trim())) {
              dateValue = cell.trim();
              break;
            }
          }

          for (let j = cells.length - 1; j >= 0; j--) {
            if (/[¥\\d,]+/.test(cells[j].trim())) {
              revenueValue = cells[j].trim();
              break;
            }
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
  const { data: asp } = await supabase.from('asps').select('id').eq('name', 'CircuitX').single();

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
    console.error('CircuitXの認証情報が取得できませんでした');
    return;
  }

  const scraper = new CircuitXDailyScraper(
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

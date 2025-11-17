import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface UltigaCredentials {
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

export class UltigaDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: UltigaCredentials;
  private config: ScraperConfig;

  constructor(credentials: UltigaCredentials, config: ScraperConfig) {
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

    console.log('🔐 アルテガアフィリエイトにログイン中...');

    // Access Ultelo login page
    await this.page.goto('https://ultelo.jp/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(3000);
    await this.screenshot('ultiga-login-page.png');

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

    await this.screenshot('ultiga-before-login-click.png');

    const loginButton = this.page.locator('button[type="submit"], input[type="submit"]').first();
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await this.page.waitForTimeout(5000);
    }

    await this.screenshot('ultiga-after-login.png');
    console.log('✅ ログイン処理完了');
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 レポートページに移動中...');

    await this.page.waitForTimeout(2000);

    // Try to find and click "成果管理" or "レポート管理" menu
    try {
      const menuLinks = await this.page.locator('a, button, div[role="button"]').all();

      for (const link of menuLinks) {
        const text = await link.textContent().catch(() => '');

        if (text?.includes('成果管理') || text?.includes('レポート管理')) {
          console.log(`メニュー発見: "${text}"`);
          await link.click();
          await this.page.waitForTimeout(2000);
          break;
        }
      }

      // Then look for "成果報酬" or "成果実績" submenu
      const subMenuLinks = await this.page.locator('a').all();

      for (const link of subMenuLinks) {
        const text = await link.textContent().catch(() => '');
        const href = await link.getAttribute('href').catch(() => '');

        if (text?.includes('成果報酬') || text?.includes('成果実績') ||
            href?.includes('result') || href?.includes('report')) {
          console.log(`サブメニュー発見: "${text}" (href: ${href})`);
          await link.click();
          await this.page.waitForTimeout(3000);
          break;
        }
      }
    } catch (error) {
      console.log('⚠️ メニューナビゲーション中にエラー:', error);
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
    await this.screenshot('ultiga-data-page.png');

    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    // 日付ごとの報酬を集計するためのMap
    const dailyRevenue = new Map<string, number>();

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
            // 日時から日付のみを抽出（YYYY/MM/DD HH:MM:SS → YYYY-MM-DD）
            const dateMatch = dateValue.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
            if (dateMatch) {
              const year = dateMatch[1];
              const month = dateMatch[2].padStart(2, '0');
              const day = dateMatch[3].padStart(2, '0');
              const formattedDate = `${year}-${month}-${day}`;

              // 金額をクリーンアップして数値に変換
              const cleanAmount = revenueValue.replace(/[¥,円]/g, '').trim();
              const amount = parseFloat(cleanAmount);

              if (!isNaN(amount)) {
                // 既存の金額に加算
                const currentAmount = dailyRevenue.get(formattedDate) || 0;
                dailyRevenue.set(formattedDate, currentAmount + amount);
              }
            }
          }
        }
        break;
      }
    }

    // Mapをソートされた配列に変換
    const sortedDates = Array.from(dailyRevenue.keys()).sort();
    for (const date of sortedDates) {
      const revenue = dailyRevenue.get(date)!;
      console.log(`✓ ${date}: ${revenue.toLocaleString()}円`);
      data.push({ date, confirmedRevenue: revenue.toString() });
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
  console.log('\n📋 Ultiga 日別レポート取得\n');

  const { data: media } = await supabase.from('media').select('id').eq('name', 'ReRe').single();
  const { data: accountItem } = await supabase.from('account_items').select('id').eq('name', 'アフィリエイト').eq('media_id', media!.id).single();
  const { data: asp } = await supabase.from('asps').select('id').eq('name', 'アルテガアフィリエイト').single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    return;
  }

  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  // Get credentials from database
  const { data: credData } = await supabase
    .from('asp_credentials')
    .select('username_secret_key, password_secret_key')
    .eq('asp_id', asp.id)
    .eq('media_id', media.id)
    .single();

  if (!credData) {
    console.error('❌ 認証情報が見つかりませんでした');
    return;
  }

  const credentials: UltigaCredentials = {
    username: credData.username_secret_key,
    password: credData.password_secret_key,
  };

  const scraper = new UltigaDailyScraper(
    credentials,
    { headless: false, mediaId: media.id, accountItemId: accountItem.id, aspId: asp.id }
  );

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToReportPage();
    const data = await scraper.scrapeDailyData();
    if (data.length > 0) {
      await scraper.saveToDatabase(data);
    } else {
      console.log('⚠️  取得したデータが0件です');
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

main().catch(console.error);

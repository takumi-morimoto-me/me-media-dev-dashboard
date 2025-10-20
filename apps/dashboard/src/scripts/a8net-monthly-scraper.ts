import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface A8NetCredentials {
  username: string;
  password: string;
}

interface MonthlyData {
  yearMonth: string;
  confirmedRevenue: string;
}

interface ScraperConfig {
  headless?: boolean;
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

export class A8NetMonthlyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: A8NetCredentials;
  private config: ScraperConfig;

  constructor(credentials: A8NetCredentials, config: ScraperConfig) {
    this.credentials = credentials;
    this.config = config;
  }

  async initialize() {
    console.log('🚀 ブラウザを起動しています...');
    this.browser = await chromium.launch({
      headless: this.config.headless ?? true,
      slowMo: this.config.headless ? 0 : 500,
    });

    this.page = await this.browser.newPage();
    console.log('✅ ブラウザ起動完了');
  }

  async login() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('🔐 A8.netにログイン中...');
    await this.page.goto('https://www.a8.net/', { waitUntil: 'domcontentloaded' });

    await this.page.fill('input[name="login"]', this.credentials.username);
    await this.page.fill('input[name="passwd"]', this.credentials.password);
    await this.page.click('input[name="login_as_btn"]');
    await this.page.waitForTimeout(3000);

    console.log('✅ ログイン成功');
  }

  async navigateToMonthlyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 月別レポートページに移動中...');

    // レポートメニューをクリック
    await this.page.click('text=レポート');
    await this.page.waitForTimeout(2000);

    // 成果報酬をクリック
    await this.page.click('text=成果報酬');
    await this.page.waitForTimeout(2000);

    // 月別をクリック
    console.log('📅 月別タブをクリック');
    await this.page.click('text=月別');
    await this.page.waitForTimeout(3000);

    await this.screenshot('monthly-report.png');
  }

  async extractMonthlyData(): Promise<MonthlyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 月別データ取得中...\n');

    const tables = await this.page.locator('table').count();
    console.log(`テーブル数: ${tables}`);

    if (tables === 0) {
      console.log('⚠️  テーブルが見つかりません');
      return [];
    }

    // 2つ目のテーブル（成果確定レポート：月別）を取得
    const reportTable = tables >= 2 ? this.page.locator('table').nth(1) : this.page.locator('table').first();
    const rows = await reportTable.locator('tr').count();
    console.log(`テーブル行数: ${rows}\n`);

    const monthlyData: MonthlyData[] = [];

    for (let i = 1; i < rows; i++) {
      const row = reportTable.locator('tr').nth(i);
      const cells = await row.locator('td, th').allTextContents();

      if (cells.length >= 2) {
        const yearMonth = cells[0].trim();
        // 確定報酬額・税別のカラム（3列目）を取得
        const revenue = cells.length >= 4 ? cells[3].trim() : cells[cells.length - 1].trim();

        // 2025年1月以降のデータのみ取得
        // 形式: "2025年10月" または "2025/10"
        const match = yearMonth.match(/(\d{4})年(\d{1,2})月/) || yearMonth.match(/(\d{4})\/(\d{1,2})/);

        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);

          if (year >= 2025 && month >= 1) {
            const formattedYearMonth = `${year}/${month.toString().padStart(2, '0')}`;
            monthlyData.push({
              yearMonth: formattedYearMonth,
              confirmedRevenue: revenue
            });
            console.log(`${formattedYearMonth}: ${revenue}`);
          }
        }
      }
    }

    console.log(`\n✅ ${monthlyData.length}件のデータを取得しました`);
    return monthlyData;
  }

  async saveToSupabase(data: MonthlyData[]) {
    console.log('\n💾 Supabase (actualsテーブル) に保存中...');

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let inserted = 0;
    let errors = 0;

    for (const item of data) {
      // 年月をYYYY-MM-DD形式に変換（月末の日付として保存）
      const [year, month] = item.yearMonth.split('/');
      // 月の最終日を計算（new Date(year, month, 0) で前月の最終日 = 当月の最終日）
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const formattedDate = `${year}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

      // 金額を数値に変換（カンマと円を削除）
      const amount = parseInt(item.confirmedRevenue.replace(/[,円]/g, ''), 10);

      // Upsert（存在すれば更新、なければ挿入）
      const { error } = await supabase
        .from('actuals')
        .upsert(
          {
            date: formattedDate,
            amount,
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
        console.error(`❌ ${item.yearMonth} の保存エラー:`, error.message);
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

  async screenshot(path: string) {
    if (this.page) {
      await this.page.screenshot({ path });
      console.log(`📸 スクリーンショット保存: ${path}`);
    }
  }
}

async function main() {
  const credentials: A8NetCredentials = {
    username: process.env.A8NET_USERNAME || '',
    password: process.env.A8NET_PASSWORD || '',
  };

  if (!credentials.username || !credentials.password) {
    console.error('❌ A8NET_USERNAMEとA8NET_PASSWORDを.env.localに設定してください');
    return;
  }

  const config: ScraperConfig = {
    headless: false,
    mediaId: process.env.RERE_MEDIA_ID || '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12',
    accountItemId: process.env.AFFILIATE_ACCOUNT_ITEM_ID || 'a6df5fab-2df4-4263-a888-ab63348cccd5',
    aspId: process.env.A8NET_ASP_ID || 'a51cdc80-0924-4d03-a764-81dd77cda4f7',
  };

  console.log('\n📋 月別レポート取得');
  console.log(`📱 メディアID: ${config.mediaId}`);
  console.log(`💰 勘定科目ID: ${config.accountItemId}`);
  console.log(`🔗 ASP ID: ${config.aspId}\n`);

  const scraper = new A8NetMonthlyScraper(credentials, config);

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToMonthlyReport();

    const data = await scraper.extractMonthlyData();

    if (data.length > 0) {
      await scraper.saveToSupabase(data);
    }

    console.log('\n✅ 全ての処理が完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    await scraper.screenshot('monthly-error.png');
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

export default A8NetMonthlyScraper;

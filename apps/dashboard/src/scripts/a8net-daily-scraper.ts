import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface A8NetCredentials {
  username: string;
  password: string;
}

interface DailyData {
  date: string;
  confirmedRevenue: string;
}

interface ScraperConfig {
  headless?: boolean;
  month?: string; // '9' or '10' etc
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

export class A8NetDailyScraper {
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
    await this.page.goto('https://www.a8.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.fill('input[name="login"]', this.credentials.username);
    await this.page.fill('input[name="passwd"]', this.credentials.password);
    await this.page.click('input[name="login_as_btn"]');
    await this.page.waitForTimeout(3000);

    console.log('✅ ログイン成功');
  }

  async navigateToDailyReport() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別レポートページに移動中...');

    // レポートメニューをクリック
    await this.page.click('text=レポート');
    await this.page.waitForTimeout(2000);

    // 成果報酬をクリック
    await this.page.click('text=成果報酬');
    await this.page.waitForTimeout(3000);

    // 日別をクリック
    console.log('📅 日別タブをクリック');
    await this.page.click('text=日別');
    await this.page.waitForTimeout(3000);

    // 月を選択（指定があれば）
    if (this.config.month) {
      console.log(`📆 ${this.config.month}月に変更中...`);
      const monthSelector = this.page.locator('select[name="ym"]');

      // 年を取得（2025年を想定）
      const currentYear = new Date().getFullYear();
      // 月を2桁にゼロパディング
      const monthPadded = this.config.month.padStart(2, '0');
      await monthSelector.selectOption({ label: `${currentYear}/${monthPadded}月` });
      await this.page.waitForTimeout(1000);

      console.log('🔍 検索ボタンをクリック');
      await this.page.click('button:has-text("検索"), input[value="検索"]');
      await this.page.waitForTimeout(3000);
    }

    await this.screenshot('daily-report.png');
  }

  async extractDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...\n');

    const tables = await this.page.locator('table').count();
    console.log(`テーブル数: ${tables}`);

    if (tables === 0) {
      console.log('⚠️  テーブルが見つかりません');
      return [];
    }

    // 最初のテーブル（成果確定レポート：日別）を取得
    const reportTable = this.page.locator('table').first();
    const rows = await reportTable.locator('tr').count();
    console.log(`テーブル行数: ${rows}\n`);

    const dailyData: DailyData[] = [];

    for (let i = 1; i < rows; i++) {
      const row = reportTable.locator('tr').nth(i);
      const cells = await row.locator('td, th').allTextContents();

      if (cells.length >= 2) {
        const dateText = cells[0].trim(); // "2025/10/01"
        // 合計確定報酬額のカラム（最後の列）を取得
        const revenue = cells[cells.length - 1].trim();

        // 日付形式を変換
        const match = dateText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        if (match) {
          const [, year, month, day] = match;
          const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          dailyData.push({
            date: formattedDate,
            confirmedRevenue: revenue
          });
          console.log(`${formattedDate}: ${revenue}`);
        }
      }
    }

    console.log(`\n✅ ${dailyData.length}件のデータを取得しました`);
    return dailyData;
  }

  async saveToSupabase(data: DailyData[]) {
    console.log('\n💾 Supabase (daily_actualsテーブル) に保存中...');

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let inserted = 0;
    let errors = 0;

    for (const item of data) {
      // 金額を数値に変換（カンマと円を削除）
      const amount = parseInt(item.confirmedRevenue.replace(/[,円]/g, ''), 10);

      // Upsert（存在すれば更新、なければ挿入）
      const { error } = await supabase
        .from('daily_actuals')
        .upsert(
          {
            date: item.date,
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
        console.error(`❌ ${item.date} の保存エラー:`, error.message);
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

  // コマンドライン引数から月を取得
  const args = process.argv.slice(2);
  const monthArg = args.find(arg => arg.startsWith('--month='));
  const month = monthArg ? monthArg.split('=')[1] : undefined;

  const config: ScraperConfig = {
    headless: true,
    month,
    mediaId: process.env.RERE_MEDIA_ID || '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12',
    accountItemId: process.env.AFFILIATE_ACCOUNT_ITEM_ID || 'a6df5fab-2df4-4263-a888-ab63348cccd5',
    aspId: process.env.A8NET_ASP_ID || 'a51cdc80-0924-4d03-a764-81dd77cda4f7',
  };

  console.log('\n📋 日別レポート取得');
  if (month) {
    console.log(`📅 対象月: ${month}月`);
  }
  console.log(`📱 メディアID: ${config.mediaId}`);
  console.log(`💰 勘定科目ID: ${config.accountItemId}`);
  console.log(`🔗 ASP ID: ${config.aspId}\n`);

  const scraper = new A8NetDailyScraper(credentials, config);

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToDailyReport();

    const data = await scraper.extractDailyData();

    if (data.length > 0) {
      await scraper.saveToSupabase(data);
    }

    console.log('\n✅ 全ての処理が完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    await scraper.screenshot('daily-error.png');
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

export default A8NetDailyScraper;

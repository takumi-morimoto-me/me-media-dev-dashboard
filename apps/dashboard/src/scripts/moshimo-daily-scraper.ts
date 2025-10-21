import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface MoshimoCredentials {
  username: string;
  password: string;
}

interface DailyData {
  date: string;
  confirmedRevenue: string;
}

interface ScraperConfig {
  headless?: boolean;
  month?: string;
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

export class MoshimoDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: MoshimoCredentials;
  private config: ScraperConfig;

  constructor(credentials: MoshimoCredentials, config: ScraperConfig) {
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

    console.log('🔐 もしもアフィリエイトにログイン中...');

    // ログインページにアクセス
    await this.page.goto('https://af.moshimo.com/af/shop/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await this.page.waitForTimeout(5000);

    // ユーザー名とパスワードを入力
    await this.page.fill('input[name="account"]', this.credentials.username);
    await this.page.fill('input[name="password"]', this.credentials.password);

    // ログインボタンをクリック
    await this.page.click('input[name="login"]', { noWaitAfter: true });

    // ページ遷移を待機
    await this.page.waitForURL('**/af/shop/**', { timeout: 60000 });
    await this.page.waitForTimeout(3000);

    console.log('✅ ログイン成功');
  }

  async navigateToDailyReport() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 売上レポートページに移動中...');

    // 売上レポートページに移動
    await this.page.goto('https://af.moshimo.com/af/shop/report/kpi/site', {
      waitUntil: 'domcontentloaded',
    });
    await this.page.waitForTimeout(5000);

    // 「日次」タブをクリック
    console.log('📅 日次タブをクリック中...');
    const dailyTab = this.page.locator('a:has-text("日次"), button:has-text("日次")');
    if (await dailyTab.count() > 0) {
      await dailyTab.first().click();
      await this.page.waitForTimeout(5000);
      console.log('✅ 日次タブをクリックしました');
    } else {
      console.log('⚠️  日次タブが見つかりません');
    }

    // 月を選択（指定されている場合）
    if (this.config.month) {
      console.log(`📅 ${this.config.month}月を選択中...`);
      const currentYear = new Date().getFullYear();
      const monthPadded = this.config.month.padStart(2, '0');

      // 「期間」ラベルの近くにあるセレクトボックスを探す
      // 年のセレクトボックス（2025年など）
      const yearSelects = await this.page.locator('select').all();
      let yearSelect = null;
      let monthSelect = null;

      // セレクトボックスを順番に確認
      for (let i = 0; i < yearSelects.length; i++) {
        const options = await yearSelects[i].locator('option').allTextContents();
        // 年のセレクトボックスは "2024", "2025" などの値を持つ
        if (options.some(opt => opt.match(/^\d{4}$/))) {
          yearSelect = yearSelects[i];
          // 年の次のセレクトボックスが月
          if (i + 1 < yearSelects.length) {
            monthSelect = yearSelects[i + 1];
          }
          break;
        }
      }

      if (yearSelect) {
        await yearSelect.selectOption(currentYear.toString());
        await this.page.waitForTimeout(1000);
        console.log(`  年: ${currentYear}を選択`);
      }

      if (monthSelect) {
        await monthSelect.selectOption(monthPadded);
        await this.page.waitForTimeout(1000);
        console.log(`  月: ${monthPadded}を選択`);
      }

      // レポート表示ボタンをクリック
      const reportButton = this.page.locator('button:has-text("レポート表示")');
      if (await reportButton.count() > 0) {
        await reportButton.first().click();
        await this.page.waitForTimeout(5000);
        console.log(`✅ ${this.config.month}月のレポートを表示しました`);
      }
    }

    // スクリーンショットを保存
    await this.page.screenshot({ path: 'moshimo-daily-report.png', fullPage: true });
    console.log('📸 スクリーンショット保存: moshimo-daily-report.png');
  }

  async extractDailyData(): Promise<DailyData[]> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 日別データ取得中...');

    const data: DailyData[] = [];

    // テーブルを探す
    const tables = await this.page.locator('table').count();
    console.log(`\nテーブル数: ${tables}`);

    if (tables === 0) {
      console.log('⚠️  テーブルが見つかりません');
      return data;
    }

    // 最初のテーブルを取得（もしもアフィリエイトの日別レポート）
    const table = this.page.locator('table').first();
    const rows = await table.locator('tbody tr').count();
    console.log(`テーブル行数: ${rows}\n`);

    // 各行からデータを抽出
    for (let i = 0; i < rows; i++) {
      const row = table.locator('tbody tr').nth(i);
      const cells = await row.locator('td').allTextContents();

      if (cells.length >= 2) {
        // 日付と報酬を抽出
        const dateText = cells[0]?.trim();
        const revenueText = cells[cells.length - 1]?.trim() || '0円'; // 報酬額は最後の列

        // 日付フォーマット: 「2025年10月01日」→「2025-10-01」
        const dateMatch = dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

        if (dateMatch) {
          const year = dateMatch[1];
          const month = dateMatch[2].padStart(2, '0');
          const day = dateMatch[3].padStart(2, '0');
          const formattedDate = `${year}-${month}-${day}`;

          const revenue = revenueText.replace(/[,円]/g, '');

          console.log(`${formattedDate}: ${revenueText}`);

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

  async saveToSupabase(data: DailyData[]) {
    const { createClient } = await import('@supabase/supabase-js');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('\n💾 Supabase (daily_actualsテーブル) に保存中...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const item of data) {
      const amount = parseInt(item.confirmedRevenue, 10);

      if (isNaN(amount)) {
        console.log(`⚠️  スキップ: ${item.date} - 無効な金額`);
        errorCount++;
        continue;
      }

      const { error } = await supabase.from('daily_actuals').upsert(
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
  console.log('\n📋 もしもアフィリエイト 日別レポート取得');

  const credentials: MoshimoCredentials = {
    username: 'reredev',
    password: 'Pa7MHBCe',
  };

  const config: ScraperConfig = {
    headless: true,
    mediaId: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    accountItemId: 'a6df5fab-2df4-4263-a888-ab63348cccd5', // アフィリエイト
    aspId: 'e3996740-ccb3-4755-8afc-763ea299e5aa', // もしもアフィリエイト
  };

  console.log(`📱 メディアID: ${config.mediaId}`);
  console.log(`💰 勘定科目ID: ${config.accountItemId}`);
  console.log(`🔗 ASP ID: ${config.aspId}\n`);

  const scraper = new MoshimoDailyScraper(credentials, config);

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToDailyReport();

    const data = await scraper.extractDailyData();

    if (data.length > 0) {
      await scraper.saveToSupabase(data);
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

main().catch(console.error);

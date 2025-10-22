import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface LinkAGCredentials {
  username: string;
  password: string;
}

interface MonthlyData {
  yearMonth: string; // YYYY-MM format
  confirmedRevenue: string;
}

interface ScraperConfig {
  headless?: boolean;
  startYearMonth: string; // YYYYMM format (e.g., "202501")
  endYearMonth: string; // YYYYMM format (e.g., "202510")
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

export class LinkAGMonthlyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: LinkAGCredentials;
  private config: ScraperConfig;

  constructor(credentials: LinkAGCredentials, config: ScraperConfig) {
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

    console.log('🔐 Link-AGにログイン中...');

    // Link-AGのログインページにアクセス
    await this.page.goto('https://link-ag.net/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await this.page.waitForTimeout(3000);

    // パートナーログインセクションの入力フィールドを探す
    const textInputs = await this.page.locator('input[type="text"], input[type="email"], input:not([type])').all();
    const passwordInputs = await this.page.locator('input[type="password"]').all();

    if (textInputs.length >= 2 && passwordInputs.length >= 2) {
      await textInputs[0].fill(this.credentials.username);
      await passwordInputs[0].fill(this.credentials.password);
      await this.page.waitForTimeout(1000);

      const loginButtons = await this.page.locator('button:has-text("ログイン"), input[type="submit"][value*="ログイン"], a:has-text("ログイン")').all();

      if (loginButtons.length > 0) {
        await loginButtons[0].click();
        await this.page.waitForTimeout(5000);
      }
    }

    console.log('✅ ログイン処理完了');
  }

  async navigateToMonthlyReport() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 月別レポートページに移動中...');

    // 月別レポートページに直接移動
    await this.page.goto('https://link-ag.net/partner/summaries', {
      waitUntil: 'domcontentloaded',
    });
    await this.page.waitForTimeout(3000);

    await this.page.screenshot({ path: 'screenshots/linkag-monthly-page.png', fullPage: true });
    console.log('📸 月別レポートページのスクリーンショット保存');

    // 期間選択
    console.log(`📅 期間選択: ${this.config.startYearMonth} ～ ${this.config.endYearMonth}`);

    // YYYYMM形式をYYYY-MM形式に変換
    const formatYearMonth = (yyyymm: string) => {
      const year = yyyymm.substring(0, 4);
      const month = yyyymm.substring(4, 6);
      return `${year}-${month}`;
    };

    const startFormatted = formatYearMonth(this.config.startYearMonth);
    const endFormatted = formatYearMonth(this.config.endYearMonth);

    // 期間選択の入力フィールドを探す（type="month"または特定のvalue）
    const inputs = await this.page.locator('input[type="text"], input[type="month"], input:not([type="hidden"]):not([type="submit"]):not([type="button"])').all();

    console.log(`入力フィールド数: ${inputs.length}`);

    // 期間フィールドを順番に探す
    let foundStartField = false;
    for (let i = 0; i < inputs.length; i++) {
      const value = await inputs[i].inputValue();
      const type = await inputs[i].getAttribute('type');

      // 現在の値がYYYY-MMの形式の場合、期間フィールドと判断
      if (value.match(/^\d{4}-\d{2}$/)) {
        if (!foundStartField) {
          console.log(`開始期間を入力中... (現在値: ${value})`);
          await inputs[i].fill(startFormatted);
          await this.page.waitForTimeout(500);
          foundStartField = true;
        } else {
          console.log(`終了期間を入力中... (現在値: ${value})`);
          await inputs[i].fill(endFormatted);
          await this.page.waitForTimeout(500);
          break;
        }
      }
    }

    // 検索ボタンをクリック
    const searchButton = this.page.locator('button:has-text("検索"), input[type="submit"][value*="検索"], button:has-text("表示")');
    if (await searchButton.count() > 0) {
      console.log('🔍 検索ボタンをクリック中...');
      await searchButton.first().click({ force: true });
      await this.page.waitForTimeout(5000);
    }

    await this.page.screenshot({ path: 'screenshots/linkag-monthly-result.png', fullPage: true });
    console.log('📸 月別レポート結果のスクリーンショット保存');
  }

  async extractMonthlyData(): Promise<MonthlyData[]> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 月別データ取得中...');

    const data: MonthlyData[] = [];

    // テーブルを探す
    const tables = await this.page.locator('table').count();
    console.log(`\nテーブル数: ${tables}`);

    if (tables === 0) {
      console.log('⚠️  テーブルが見つかりません');
      return data;
    }

    // 月別レポートのテーブルを取得
    const table = this.page.locator('table').last();
    const rows = await table.locator('tbody tr').count();
    console.log(`テーブル行数: ${rows}\n`);

    // 各行からデータを抽出
    for (let i = 0; i < rows; i++) {
      const row = table.locator('tbody tr').nth(i);
      const cells = await row.locator('td').allTextContents();

      if (cells.length >= 7) {
        // 月別テーブルの構造（推定）
        // 0: 年月, 1: imp, 2: クリック数, 3: CTR, 4: 発生数, 5: CVR, 6: 発生額金額, 7: 成果数, 8: 成果期待金額, 9: EPC
        const yearMonthText = cells[0]?.trim(); // 年月 (2025/01形式)
        const confirmedRevenue = cells[8]?.trim() || '0'; // 成果期待金額(税抜)

        // 年月フォーマット: 2025/01 → 2025-01
        const yearMonthMatch = yearMonthText.match(/(\d{4})\/(\d{1,2})/);

        if (yearMonthMatch) {
          const year = yearMonthMatch[1];
          const month = yearMonthMatch[2].padStart(2, '0');
          const formattedYearMonth = `${year}-${month}`;

          const revenue = confirmedRevenue.replace(/[,]/g, '');

          console.log(`${formattedYearMonth}: ${confirmedRevenue}円`);

          data.push({
            yearMonth: formattedYearMonth,
            confirmedRevenue: revenue,
          });
        }
      }
    }

    console.log(`\n✅ ${data.length}件のデータを取得しました`);
    return data;
  }

  async saveToSupabase(data: MonthlyData[]) {
    const { createClient } = await import('@supabase/supabase-js');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('\n💾 Supabase (actualsテーブル) に保存中...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const item of data) {
      const amount = parseInt(item.confirmedRevenue, 10);

      if (isNaN(amount)) {
        console.log(`⚠️  スキップ: ${item.yearMonth} - 無効な金額`);
        errorCount++;
        continue;
      }

      // 月の最初の日をdateとして使用
      const date = `${item.yearMonth}-01`;

      const { error } = await supabase.from('actuals').upsert(
        {
          date,
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
        console.error(`❌ エラー (${item.yearMonth}):`, error.message);
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
  console.log('\n📋 Link-AG 月別レポート取得');

  const credentials: LinkAGCredentials = {
    username: 'rere-dev',
    password: 'ydh563czoq',
  };

  const config: ScraperConfig = {
    headless: false, // デバッグ用にfalse
    startYearMonth: '202501',
    endYearMonth: '202510',
    mediaId: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    accountItemId: 'a6df5fab-2df4-4263-a888-ab63348cccd5', // アフィリエイト
    aspId: '88256cb4-d177-47d3-bf04-db48bf859843', // Link-AG
  };

  console.log(`📱 メディアID: ${config.mediaId}`);
  console.log(`💰 勘定科目ID: ${config.accountItemId}`);
  console.log(`🔗 ASP ID: ${config.aspId}`);
  console.log(`📅 期間: ${config.startYearMonth} ～ ${config.endYearMonth}\n`);

  const scraper = new LinkAGMonthlyScraper(credentials, config);

  try {
    await scraper.initialize();
    await scraper.login();

    await scraper.navigateToMonthlyReport();
    const data = await scraper.extractMonthlyData();

    if (data.length > 0) {
      await scraper.saveToSupabase(data);
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

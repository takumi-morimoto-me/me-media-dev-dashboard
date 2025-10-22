import { chromium, type Browser, type Page } from 'playwright';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface LinkAGCredentials {
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

export class LinkAGDailyScraper {
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
      headless: this.config.headless ?? false, // デバッグのためfalse
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

    // スクリーンショット（デバッグ用）
    await this.page.screenshot({ path: 'linkag-login-page.png', fullPage: true });
    console.log('📸 ログインページのスクリーンショット保存');

    // パートナーログインセクションの入力フィールドを探す
    // text/email/password inputのみを取得
    const textInputs = await this.page.locator('input[type="text"], input[type="email"], input:not([type])').all();
    const passwordInputs = await this.page.locator('input[type="password"]').all();

    console.log(`テキスト入力フィールド数: ${textInputs.length}`);
    console.log(`パスワード入力フィールド数: ${passwordInputs.length}`);

    if (textInputs.length >= 2 && passwordInputs.length >= 2) {
      // 最初の2つがパートナーログイン（ログインID、パスワード）
      console.log('パートナーログインにログインID入力中...');
      await textInputs[0].fill(this.credentials.username);

      console.log('パスワード入力中...');
      await passwordInputs[0].fill(this.credentials.password);

      await this.page.waitForTimeout(1000);

      // ログインボタンをクリック
      // button, input[type="submit"], aタグなど色々な可能性がある
      const loginButtons = await this.page.locator('button:has-text("ログイン"), input[type="submit"][value*="ログイン"], a:has-text("ログイン")').all();
      console.log(`ログインボタン数: ${loginButtons.length}`);

      if (loginButtons.length > 0) {
        console.log('パートナーログインボタンをクリック中...');
        await loginButtons[0].click();
        await this.page.waitForTimeout(5000);

        await this.page.screenshot({ path: 'linkag-after-login.png', fullPage: true });
        console.log('📸 ログイン後のスクリーンショット保存');
      } else {
        console.log('⚠️  ログインボタンが見つかりません');
        // すべてのbuttonとinput[type="submit"]を探す
        const allButtons = await this.page.locator('button, input[type="submit"]').all();
        console.log(`全ボタン数: ${allButtons.length}`);

        if (allButtons.length >= 2) {
          console.log('最初のボタン（パートナーログイン用と推定）をクリック中...');
          await allButtons[0].click();
          await this.page.waitForTimeout(5000);

          await this.page.screenshot({ path: 'linkag-after-login.png', fullPage: true });
          console.log('📸 ログイン後のスクリーンショット保存');
        }
      }
    } else {
      console.log('⚠️  ログインフィールドが見つかりませんでした');
    }

    console.log('✅ ログイン処理完了');
  }

  async extractDailyData(): Promise<DailyData[]> {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 日別データ取得中...');

    const data: DailyData[] = [];

    // ダッシュボードに日別レポートのテーブルがある
    // テーブルを探す
    const tables = await this.page.locator('table').count();
    console.log(`\nテーブル数: ${tables}`);

    if (tables === 0) {
      console.log('⚠️  テーブルが見つかりません');
      return data;
    }

    // 日別レポートのテーブルを取得（通常は最後のテーブル）
    const table = this.page.locator('table').last();
    const rows = await table.locator('tbody tr').count();
    console.log(`テーブル行数: ${rows}\n`);

    // 各行からデータを抽出
    for (let i = 0; i < rows; i++) {
      const row = table.locator('tbody tr').nth(i);
      const cells = await row.locator('td').allTextContents();

      if (cells.length >= 7) {
        // Link-AGのテーブル構造:
        // 0: 日付, 1: imp, 2: クリック数, 3: CTR, 4: 発生数, 5: CVR, 6: 発生額金額(税抜), 7: 成果数, 8: 成果期待金額(税抜), 9: EPC
        const dateText = cells[0]?.trim(); // 日付 (2025/10/01形式)
        const confirmedRevenue = cells[8]?.trim() || '0'; // 成果期待金額(税抜)

        // 日付フォーマット: 2025/10/01 → 2025-10-01
        const dateMatch = dateText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);

        if (dateMatch) {
          const year = dateMatch[1];
          const month = dateMatch[2].padStart(2, '0');
          const day = dateMatch[3].padStart(2, '0');
          const formattedDate = `${year}-${month}-${day}`;

          const revenue = confirmedRevenue.replace(/[,]/g, '');

          console.log(`${formattedDate}: ${confirmedRevenue}円`);

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
  console.log('\n📋 Link-AG 日別レポート取得');

  const credentials: LinkAGCredentials = {
    username: 'rere-dev',
    password: 'ydh563czoq',
  };

  const config: ScraperConfig = {
    headless: true,
    mediaId: '4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12', // ReRe
    accountItemId: 'a6df5fab-2df4-4263-a888-ab63348cccd5', // アフィリエイト
    aspId: '88256cb4-d177-47d3-bf04-db48bf859843', // Link-AG
  };

  console.log(`📱 メディアID: ${config.mediaId}`);
  console.log(`💰 勘定科目ID: ${config.accountItemId}`);
  console.log(`🔗 ASP ID: ${config.aspId}\n`);

  const scraper = new LinkAGDailyScraper(credentials, config);

  try {
    await scraper.initialize();
    await scraper.login();

    // ログイン後、URLを確認
    console.log('現在のURL:', await scraper['page']?.url());

    // ダッシュボードに日別レポートが表示されているので、データを抽出
    const data = await scraper.extractDailyData();

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

import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface IMobileCredentials {
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

export class IMobileDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: IMobileCredentials;
  private config: ScraperConfig;

  constructor(credentials: IMobileCredentials, config: ScraperConfig) {
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

    console.log('🔐 i-mobileにログイン中...');

    // i-mobileのログインページに移動
    // Partner login URL
    await this.page.goto('https://sppartner.i-mobile.co.jp/login.aspx', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(3000);
    await this.screenshot('imobile-login-page.png');

    // ログインフォームを探す
    console.log('ログインフォームを探しています...');

    // ログインIDとパスワードのフィールドを探す
    const loginIdInput = this.page.locator('input[name*="login"], input[name*="id"], input[type="text"]').first();
    const passwordInput = this.page.locator('input[name*="password"], input[type="password"]').first();

    // ログインIDを入力
    if (await loginIdInput.count() > 0) {
      await loginIdInput.fill(this.credentials.username);
      console.log('ログインID入力完了');
      await this.page.waitForTimeout(500);
    }

    // パスワードを入力
    if (await passwordInput.count() > 0) {
      await passwordInput.fill(this.credentials.password);
      console.log('パスワード入力完了');
      await this.page.waitForTimeout(500);
    }

    await this.screenshot('imobile-before-login-click.png');

    // ログインボタンをクリック
    const loginButton = this.page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').first();
    if (await loginButton.count() > 0) {
      console.log('ログインボタンをクリック中...');
      await loginButton.click();
      await this.page.waitForTimeout(5000);
    }

    await this.screenshot('imobile-after-login.png');

    console.log('✅ ログイン処理完了');
    console.log(`現在のURL: ${this.page.url()}`);
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 レポートページに移動中...');
    console.log('現在のURL:', this.page.url());

    await this.page.waitForTimeout(2000);

    // レポートメニューを探す
    const reportLinks = await this.page.locator('a').all();

    for (const link of reportLinks) {
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text?.includes('レポート') || text?.includes('REPORT') || text?.includes('成果') || href?.includes('report')) {
        console.log(`レポートリンク発見: "${text}" (href: ${href})`);

        if (href?.includes('daily') || text?.includes('日別') || text?.includes('日次')) {
          console.log('日別レポートリンクをクリック中...');
          await link.click();
          await this.page.waitForTimeout(2000);
          break;
        }
      }
    }

    await this.page.waitForTimeout(3000);
    await this.screenshot('imobile-report-page.png');
    console.log('✅ レポートページに到達');
    console.log('現在のURL:', this.page.url());
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    await this.page.waitForTimeout(2000);
    await this.screenshot('imobile-before-search.png');

    // 検索/表示ボタンを探してクリック
    const buttons = await this.page.locator('button:visible, input[type="submit"]:visible, input[type="button"]:visible').all();

    for (const button of buttons) {
      const text = await button.textContent().catch(() => '');
      const value = await button.getAttribute('value').catch(() => '');

      if (text?.includes('表示') || text?.includes('検索') || value?.includes('表示') || value?.includes('検索')) {
        console.log(`\n✓ レポート表示ボタンをクリックします: ${text || value}`);
        await button.click();
        await this.page.waitForTimeout(5000);
        await this.screenshot('imobile-after-search.png');
        break;
      }
    }

    // データテーブルを探す
    console.log('\n📊 データテーブルを探しています...');
    const tables = await this.page.locator('table').count();
    console.log(`テーブル総数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      const isVisible = await table.isVisible();

      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (rows: ${tbodyRows})`);

      // 最初の行をチェック
      const firstRow = table.locator('tbody tr').first();
      const firstCells = await firstRow.locator('td, th').allTextContents();
      console.log(`  最初の行:`, firstCells.map(c => c.trim().substring(0, 30)));

      // 日付パターンをチェック（年月日形式にも対応）
      const hasDatePattern = firstCells.some(cell =>
        /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
        /\d{1,2}[/-]\d{1,2}/.test(cell) ||
        /\d{4}年\d{1,2}月\d{1,2}日/.test(cell)
      );

      if (hasDatePattern) {
        console.log(`\n🎉 データテーブル発見！`);

        // データを抽出
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          // 日付を取得（年月日形式にも対応）
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j].trim();
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) || /\d{1,2}[/-]\d{1,2}/.test(cell) || /\d{4}年\d{1,2}月\d{1,2}日/.test(cell)) {
              dateValue = cell;
              break;
            }
          }

          // 報酬金額を取得（最後の金額列）
          for (let j = cells.length - 1; j >= 0; j--) {
            const cell = cells[j].trim();
            if (/[¥\\d,]+/.test(cell) && cell.length > 0) {
              revenueValue = cell;
              break;
            }
          }

          if (dateValue && revenueValue) {
            console.log(`✓ ${dateValue}: ${revenueValue}`);
            data.push({
              date: dateValue,
              confirmedRevenue: revenueValue,
            });
          }
        }

        break;
      }
    }

    if (data.length === 0) {
      console.log('\n⚠️ データが見つかりません。');
    }

    await this.screenshot('imobile-data-final.png');
    console.log(`\n✅ ${data.length}件のデータを取得しました`);
    return data;
  }

  // Alias for monthly scrapers
  async extractDailyData() {
    return await this.scrapeDailyData();
  }

  async screenshot(filename: string) {
    if (!this.page) return;
    await this.page.screenshot({
      path: `screenshots/${filename}`,
      fullPage: true
    });
    console.log(`📸 スクリーンショット保存: ${filename}`);
  }

  async saveToDatabase(data: DailyData[]) {
    console.log(`\n💾 Supabaseに保存中...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const item of data) {
      // 日付を標準フォーマット (YYYY-MM-DD) に変換
      let dateValue = item.date;
      if (dateValue.includes('年')) {
        // 2025年10月01日（水） -> 2025-10-01
        const match = dateValue.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (match) {
          const year = match[1];
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          dateValue = `${year}-${month}-${day}`;
        }
      }

      // ¥, 円, カンマを削除して数値に変換
      const cleanAmount = item.confirmedRevenue.replace(/[¥,円]/g, '').trim();
      const amount = parseFloat(cleanAmount);

      if (isNaN(amount)) {
        console.error(`❌ ${item.date} の金額変換失敗: "${item.confirmedRevenue}" -> "${cleanAmount}"`);
        failCount++;
        continue;
      }

      const { error } = await supabase
        .from('daily_actuals')
        .upsert({
          date: dateValue,
          media_id: this.config.mediaId,
          account_item_id: this.config.accountItemId,
          asp_id: this.config.aspId,
          amount: amount,
        }, {
          onConflict: 'date,media_id,account_item_id,asp_id'
        });

      if (error) {
        console.error(`❌ ${item.date} の保存に失敗:`, error.message);
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

// メイン実行
async function main() {
  // Supabaseから必要な情報を取得
  const { data: media } = await supabase
    .from('media')
    .select('id')
    .eq('name', 'ReRe')
    .single();

  const { data: accountItem } = await supabase
    .from('account_items')
    .select('id')
    .eq('name', 'アフィリエイト')
    .eq('media_id', media!.id)
    .single();

  const { data: asp } = await supabase
    .from('asps')
    .select('id')
    .eq('name', 'i-mobile')
    .single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    console.log('Media:', media);
    console.log('Account Item:', accountItem);
    console.log('ASP:', asp);
    return;
  }

  // ASP credentialsを取得
  const { data: credentials } = await supabase
    .from('asp_credentials')
    .select('username_secret_key, password_secret_key')
    .eq('asp_id', asp.id)
    .eq('media_id', media.id)
    .single();

  if (!credentials) {
    console.error('i-mobileの認証情報が取得できませんでした');
    return;
  }

  console.log('\n📋 i-mobile 日別レポート取得');
  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  const scraper = new IMobileDailyScraper(
    {
      username: credentials.username_secret_key,
      password: credentials.password_secret_key,
    },
    {
      headless: false,
      mediaId: media.id,
      accountItemId: accountItem.id,
      aspId: asp.id,
    }
  );

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToReportPage();

    const dailyData = await scraper.scrapeDailyData();

    if (dailyData.length > 0) {
      await scraper.saveToDatabase(dailyData);
    }

    console.log('\n✅ 全ての処理が完了しました！');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

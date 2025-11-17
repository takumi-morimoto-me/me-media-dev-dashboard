import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface SmartCCredentials {
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

export class SmartCDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: SmartCCredentials;
  private config: ScraperConfig;

  constructor(credentials: SmartCCredentials, config: ScraperConfig) {
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

    console.log('🔐 Smart-Cにログイン中...');

    const maxRetries = 5;
    let retryCount = 0;
    let loginSuccessful = false;

    while (retryCount < maxRetries && !loginSuccessful) {
      try {
        if (retryCount > 0) {
          const waitTime = 10000 + (retryCount * 5000); // 10秒 + リトライ回数 * 5秒
          console.log(`\n🔄 リトライ ${retryCount}/${maxRetries}... (${waitTime/1000}秒待機後)`);
          await this.page.waitForTimeout(waitTime);
        }

        // Smart-Cのメインページに移動
        console.log(`\nログインページにアクセス中: https://smart-c.jp/`);
        await this.page.goto('https://smart-c.jp/', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        await this.page.waitForTimeout(3000);

        // 混雑メッセージのチェック
        const pageContent = await this.page.content();
        const isCongested = pageContent.includes('混雑') || pageContent.includes('ただいま混雑');

        if (isCongested) {
          console.log('⚠️ サーバー混雑中のメッセージを検出しました');
          await this.screenshot(`smartc-congested-${retryCount}.png`);
          throw new Error('サーバーが混雑しています（リトライします）');
        }

        await this.screenshot('smartc-main-page.png');

        // ログインモーダルを開く
        console.log('ログインモーダルを開いています...');

        // スクロールアップしてヘッダーを確実に表示
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(1000);

        // モーダルを開くボタンをクリック（id="modal_open"）
        const modalOpenButton = this.page.locator('#modal_open, a[id="modal_open"]').first();

        if (await modalOpenButton.count() === 0) {
          throw new Error('ログインモーダルを開くボタンが見つかりません');
        }

        console.log('モーダルオープンボタンをクリック中...');
        await modalOpenButton.click();
        await this.page.waitForTimeout(2000);

        // ログインフォームが表示されるまで待機
        try {
          await this.page.locator('input[name="login_id"]').waitFor({ state: 'visible', timeout: 5000 });
          console.log('✅ ログインフォームが表示されました');
        } catch (error) {
          await this.screenshot('smartc-modal-open-failed.png');
          throw new Error('ログインフォームが表示されませんでした');
        }

        await this.screenshot('smartc-login-modal-opened.png');

        // ログインフォームを探す
        console.log('ログインフォームを探しています...');

        // Smart-C特有のフィールド名: login_id と login_password
        const loginIdInput = this.page.locator('input[name="login_id"]').first();
        const passwordInput = this.page.locator('input[name="login_password"]').first();

        // ログインフォームが見つかるまで待機
        try {
          await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
        } catch (error) {
          throw new Error('ログインフォームが表示されません');
        }

        // ログインIDを入力
        if (await loginIdInput.count() > 0) {
          await loginIdInput.fill(this.credentials.username);
          console.log('ログインID入力完了');
          await this.page.waitForTimeout(500);
        } else {
          throw new Error('ログインIDフィールドが見つかりません');
        }

        // パスワードを入力
        if (await passwordInput.count() > 0) {
          await passwordInput.fill(this.credentials.password);
          console.log('パスワード入力完了');
          await this.page.waitForTimeout(500);
        } else {
          throw new Error('パスワードフィールドが見つかりません');
        }

        await this.screenshot('smartc-before-login-click.png');

        // ログインボタンをクリック（LOGINというテキストのsubmitボタン）
        const submitButton = this.page.locator('button[type="submit"]:has-text("LOGIN"), input[type="submit"], button:has-text("ログイン")').first();
        if (await submitButton.count() === 0) {
          throw new Error('ログインsubmitボタンが見つかりません');
        }

        console.log('ログインボタンをクリック中...');
        await submitButton.click();

        // ログイン後のナビゲーション待機
        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
          console.log('ネットワークアイドル待機タイムアウト（続行します）');
        });
        await this.page.waitForTimeout(3000);

        await this.screenshot('smartc-after-login.png');

        // ログイン成功を確認
        const currentUrl = this.page.url();
        console.log(`現在のURL: ${currentUrl}`);

        // ログインページにまだいる場合はエラー
        if (currentUrl.includes('/login')) {
          const errorMessage = await this.page.locator('.error, .alert, [class*="error"]').textContent().catch(() => '');
          if (errorMessage) {
            throw new Error(`ログイン失敗: ${errorMessage}`);
          }
          throw new Error('ログイン後もログインページにいます');
        }

        console.log('✅ ログイン処理完了');
        loginSuccessful = true;

      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ ログイン試行 ${retryCount} 失敗:`, errorMessage);

        if (retryCount >= maxRetries) {
          console.error('\n⚠️ Smart-Cのサーバーが混雑しているため、ログインできませんでした。');
          console.error('💡 しばらく時間をおいてから、再度実行してください。');
          console.error('   Smart-Cは特に朝や夕方に混雑することがあります。\n');
          throw new Error(`ログインに失敗しました（${maxRetries}回試行）: ${errorMessage}`);
        }
      }
    }
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 レポートページに移動中...');
    console.log('現在のURL:', this.page.url());

    await this.page.waitForTimeout(2000);

    // レポートメニューを探す
    const reportLinks = await this.page.locator('a').all();
    let dailyReportUrl = '';

    for (const link of reportLinks) {
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text?.includes('レポート') || text?.includes('REPORT') || text?.includes('成果') || href?.includes('report')) {
        console.log(`レポートリンク発見: "${text}" (href: ${href})`);

        if (href && (href.includes('day_flag=1') || text?.includes('日別') || text?.includes('日次'))) {
          console.log('✅ 日別レポートURLを発見');
          dailyReportUrl = href;
          break;
        }
      }
    }

    if (!dailyReportUrl) {
      console.log('⚠️ 日別レポートリンクが見つかりません。デフォルトのレポートページに移動します...');
      // 基本的なレポートURLに移動
      const currentUrl = this.page.url();
      const baseUrl = new URL(currentUrl).origin;
      dailyReportUrl = `/publisher/media_report?day_flag=1&SID=${new URL(currentUrl).searchParams.get('SID')}`;
    }

    // URLに直接移動
    console.log('日別レポートページに移動中...');
    const currentUrl = this.page.url();
    const baseUrl = new URL(currentUrl).origin;

    if (dailyReportUrl.startsWith('/')) {
      dailyReportUrl = baseUrl + dailyReportUrl;
    }

    console.log(`移動先URL: ${dailyReportUrl}`);
    await this.page.goto(dailyReportUrl, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);

    await this.screenshot('smartc-report-page.png');
    console.log('✅ レポートページに到達');
    console.log('現在のURL:', this.page.url());
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    await this.page.waitForTimeout(2000);
    await this.screenshot('smartc-before-search.png');

    // 検索/表示ボタンを探してクリック
    const buttons = await this.page.locator('button:visible, input[type="submit"]:visible, input[type="button"]:visible').all();

    for (const button of buttons) {
      const text = await button.textContent().catch(() => '');
      const value = await button.getAttribute('value').catch(() => '');

      if (text?.includes('表示') || text?.includes('検索') || value?.includes('表示') || value?.includes('検索')) {
        console.log(`\n✓ レポート表示ボタンをクリックします: ${text || value}`);
        await button.click();
        await this.page.waitForTimeout(5000);
        await this.screenshot('smartc-after-search.png');
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

      // 日付パターンをチェック（日本語形式の日付を含む）
      const hasDatePattern = firstCells.some(cell =>
        /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
        /\d{1,2}[/-]\d{1,2}/.test(cell) ||
        /\d{4}年\d{1,2}月\d{1,2}日/.test(cell)  // 日本語形式: 2025年10月01日
      );

      if (hasDatePattern) {
        console.log(`\n🎉 データテーブル発見！`);

        // データを抽出
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          // 日付を取得（日本語形式も含む）
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j].trim();
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
                /\d{1,2}[/-]\d{1,2}/.test(cell) ||
                /\d{4}年\d{1,2}月\d{1,2}日/.test(cell)) {
              dateValue = cell;

              // 日本語形式の日付を標準形式に変換（例: 2025年10月01日 -> 2025-10-01）
              if (dateValue.includes('年')) {
                const match = dateValue.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
                if (match) {
                  const year = match[1];
                  const month = match[2].padStart(2, '0');
                  const day = match[3].padStart(2, '0');
                  dateValue = `${year}-${month}-${day}`;
                }
              }
              break;
            }
          }

          // 報酬金額を取得（最後の金額列 - "合計金額"列）
          // Smart-Cの場合、最後の列が合計報酬
          if (cells.length > 0) {
            const lastCell = cells[cells.length - 1].trim();
            if (lastCell && /[¥\\d,]+/.test(lastCell)) {
              revenueValue = lastCell;
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

    await this.screenshot('smartc-data-final.png');
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
          date: item.date,
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
    .eq('name', 'Smart-C')
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
    console.error('Smart-Cの認証情報が取得できませんでした');
    return;
  }

  console.log('\n📋 Smart-C 日別レポート取得');
  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  const scraper = new SmartCDailyScraper(
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

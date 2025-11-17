import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface JANetCredentials {
  username: string;
  password: string;
}

interface DailyData {
  date: string;
  confirmedRevenue: string;
}

interface ScraperConfig {
  headless?: boolean;
  startYearMonth?: string; // YYYYMM format
  endYearMonth?: string; // YYYYMM format
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

export class JANetDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: JANetCredentials;
  private config: ScraperConfig;

  constructor(credentials: JANetCredentials, config: ScraperConfig) {
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

    console.log('🔐 JANetにログイン中...');

    // JANetの管理画面ログインページに移動
    await this.page.goto('https://j-a-net.jp/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // JavaScriptの読み込みを待つ
    await this.page.waitForLoadState('networkidle').catch(() => {
      console.log('⚠️ ネットワークアイドル待機タイムアウト');
    });

    await this.page.waitForTimeout(5000);
    await this.screenshot('janet-login-page.png');

    console.log('ログインフォームを探しています...');

    // ログインフォームが表示されるまで待機（最大30秒）
    try {
      await this.page.waitForSelector('input[type="text"], input[type="email"], input[name*="id"], input[name*="login"]', {
        timeout: 30000,
        state: 'visible'
      });
      console.log('✅ ログインフォームを検出しました');
    } catch (error) {
      console.log('⚠️ ログインフォームの検出タイムアウト。続行します...');
    }

    // input要素を全て確認
    const allInputs = await this.page.locator('input:visible').all();
    console.log(`全input要素数（可視）: ${allInputs.length}`);

    for (let i = 0; i < allInputs.length; i++) {
      const inputInfo = await allInputs[i].evaluate((inp) => ({
        type: (inp as HTMLInputElement).type,
        name: (inp as HTMLInputElement).name,
        id: inp.id,
        placeholder: (inp as HTMLInputElement).placeholder,
        className: inp.className,
      }));
      console.log(`Input ${i}:`, inputInfo);
    }

    // Partner IDフィールドとパスワードフィールドを特定
    const textInputs = await this.page.locator('input[type="text"]:visible, input[type="email"]:visible').all();
    const passwordInputs = await this.page.locator('input[type="password"]:visible').all();

    console.log(`テキスト入力フィールド数: ${textInputs.length}`);
    console.log(`パスワード入力フィールド数: ${passwordInputs.length}`);

    // Partner ID / 広告主IDのフィールドを探す（プレースホルダーで判定）
    let partnerIdInput = null;
    for (const input of textInputs) {
      const placeholder = await input.getAttribute('placeholder');
      console.log(`Placeholder: ${placeholder}`);
      // JANetのログインフォームは "pp1234 / gm1234" のようなプレースホルダー
      if (placeholder?.includes('pp') || placeholder?.includes('gm') || placeholder?.includes('ID')) {
        partnerIdInput = input;
        break;
      }
    }

    // パートナーIDを入力
    if (partnerIdInput) {
      console.log(`パートナーID入力中: ${this.credentials.username}`);
      await partnerIdInput.click();
      await partnerIdInput.fill('');
      await partnerIdInput.type(this.credentials.username, { delay: 100 });
      await this.page.waitForTimeout(1000);
      console.log('✅ パートナーID入力完了');
    } else if (textInputs.length > 0) {
      console.log('プレースホルダーで特定できませんでした。最初のテキスト入力フィールドを使用します');
      await textInputs[0].click();
      await textInputs[0].fill('');
      await textInputs[0].type(this.credentials.username, { delay: 100 });
      await this.page.waitForTimeout(1000);
    }

    // パスワードを入力
    if (passwordInputs.length > 0) {
      console.log(`パスワード入力中`);
      await passwordInputs[0].click();
      await passwordInputs[0].fill('');
      await passwordInputs[0].type(this.credentials.password, { delay: 100 });
      await this.page.waitForTimeout(1000);
      console.log('✅ パスワード入力完了');
    }

    await this.screenshot('janet-before-login-click.png');

    // ログインボタンをクリック
    const loginButton = this.page.locator('button:has-text("ログイン"):visible').first();
    const buttonCount = await loginButton.count();

    console.log(`ログインボタン数: ${buttonCount}`);

    if (buttonCount > 0) {
      console.log('ログインボタンをクリック中...');

      // ナビゲーションを待機
      const navigationPromise = this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
        console.log('⚠️ ナビゲーション待機タイムアウト');
      });

      await loginButton.click();
      await navigationPromise;
      await this.page.waitForTimeout(3000);
    }

    await this.screenshot('janet-after-login.png');

    const currentUrl = this.page.url();
    console.log(`現在のURL: ${currentUrl}`);

    // ログインエラーチェック
    const errorMessage = await this.page.locator('text=IDまたはパスワードが違います').count();
    if (errorMessage > 0) {
      throw new Error('ログインに失敗しました: IDまたはパスワードが正しくありません');
    }

    // ログイン成功の確認
    // j-a-net.jpから別のURLに遷移しているか、またはログインメニューが表示されているか
    const hasLogoutLink = await this.page.locator('a:has-text("ログアウト"), a:has-text("マイページ")').count();
    if (currentUrl === 'https://j-a-net.jp/' && hasLogoutLink === 0) {
      throw new Error(`ログインに失敗した可能性があります。現在のURL: ${currentUrl}`);
    }

    console.log('✅ ログイン成功');
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 レポートページに移動中...');

    // ログイン後のダッシュボードから開始
    await this.page.waitForTimeout(2000);

    // レポートメニューを探す（複数のパターンで試行）
    const reportUrls = [
      'https://j-a-net.jp/affiliate/reports/daily/',
      'https://j-a-net.jp/affiliate/report/daily',
      'https://j-a-net.jp/manage/report.html',
    ];

    let reportPageLoaded = false;

    // まずはリンクから探す
    const allLinks = await this.page.locator('a:visible').all();
    console.log(`全リンク数: ${allLinks.length}`);

    for (const link of allLinks) {
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text?.includes('レポート') || text?.includes('成果') || text?.includes('report')) {
        console.log(`レポートリンク発見: "${text}" (href: ${href})`);

        if (text?.includes('日別') || text?.includes('日次') || href?.includes('daily')) {
          console.log('日別レポートリンクをクリック中...');
          await link.click();
          await this.page.waitForTimeout(3000);
          reportPageLoaded = true;
          break;
        }
      }
    }

    // リンクが見つからない場合は直接URLにアクセス
    if (!reportPageLoaded) {
      console.log('リンクから移動できませんでした。直接URLにアクセスします...');
      for (const url of reportUrls) {
        try {
          console.log(`試行中: ${url}`);
          await this.page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });
          await this.page.waitForTimeout(2000);

          // 404チェック
          const is404 = await this.page.locator('text=Not Found, text=404').count() > 0;
          if (!is404) {
            console.log(`✅ ${url} にアクセス成功`);
            reportPageLoaded = true;
            break;
          }
        } catch (error: any) {
          console.log(`⚠️ ${url} へのアクセス失敗: ${error.message}`);
        }
      }
    }

    await this.screenshot('janet-report-page.png');
    console.log('✅ レポートページに到達');
    console.log('現在のURL:', this.page.url());
  }

  async setReportPeriod(startYear: number, startMonth: number, endYear: number, endMonth: number) {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\n📅 レポート期間を設定中: ${startYear}/${startMonth} ～ ${endYear}/${endMonth}`);

    try {
      // 開始年を選択
      const startYearSelect = this.page.locator('select[name*="start_year"], select[name*="from_year"]').first();
      const startYearVisible = await startYearSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (startYearVisible) {
        await startYearSelect.selectOption(startYear.toString());
        console.log(`✓ 開始年: ${startYear}`);
        await this.page.waitForTimeout(500);

        // 開始月を選択
        const startMonthSelect = this.page.locator('select[name*="start_month"], select[name*="from_month"]').first();
        const monthValue = startMonth.toString().padStart(2, '0');
        await startMonthSelect.selectOption(monthValue);
        console.log(`✓ 開始月: ${startMonth}`);
        await this.page.waitForTimeout(500);

        // 終了年を選択
        const endYearSelect = this.page.locator('select[name*="end_year"], select[name*="to_year"]').first();
        await endYearSelect.selectOption(endYear.toString());
        console.log(`✓ 終了年: ${endYear}`);
        await this.page.waitForTimeout(500);

        // 終了月を選択
        const endMonthSelect = this.page.locator('select[name*="end_month"], select[name*="to_month"]').first();
        const endMonthValue = endMonth.toString().padStart(2, '0');
        await endMonthSelect.selectOption(endMonthValue);
        console.log(`✓ 終了月: ${endMonth}`);

        await this.page.waitForTimeout(1000);
        console.log('✅ 期間設定完了');
      } else {
        console.log('⚠️ 期間選択フィールドが表示されていません（デフォルト期間を使用）');
      }
    } catch (error: any) {
      console.log(`⚠️ 期間設定エラー: ${error.message}`);
    }
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const data: DailyData[] = [];

    await this.page.waitForTimeout(2000);
    await this.screenshot('janet-before-search.png');

    // 検索/表示ボタンを探してクリック
    const buttons = await this.page.locator('button:visible, input[type="submit"]:visible, input[type="button"]:visible').all();

    for (const button of buttons) {
      const text = await button.textContent().catch(() => '');
      const value = await button.getAttribute('value').catch(() => '');

      if (text?.includes('表示') || text?.includes('検索') || value?.includes('表示') || value?.includes('検索')) {
        console.log(`\n✓ レポート表示ボタンをクリックします: ${text || value}`);
        await button.click();
        await this.page.waitForTimeout(5000);
        await this.screenshot('janet-after-search.png');
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

      // 日付パターンをチェック
      const hasDatePattern = firstCells.some(cell =>
        /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) ||
        /\d{1,2}[/-]\d{1,2}/.test(cell)
      );

      if (hasDatePattern) {
        console.log(`\n🎉 データテーブル発見！`);

        // データを抽出
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          // 日付を取得
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j].trim();
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) || /\d{1,2}[/-]\d{1,2}/.test(cell)) {
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

    await this.screenshot('janet-data-final.png');
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
  console.log('\n📋 JANet 日別レポート取得');

  // テスト用の認証情報（ハードコード）
  const credentials: JANetCredentials = {
    username: 'beginners@marketenterprise.co.jp',
    password: 'Me20190416',
  };

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
    .eq('name', 'JANet')
    .single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    console.log('Media:', media);
    console.log('Account Item:', accountItem);
    console.log('ASP:', asp);
    return;
  }

  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  const scraper = new JANetDailyScraper(
    credentials,
    {
      headless: false, // デバッグ用にfalse
      mediaId: media.id,
      accountItemId: accountItem.id,
      aspId: asp.id,
    }
  );

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToReportPage();

    // 2025年1月から10月までの期間を設定
    await scraper.setReportPeriod(2025, 1, 2025, 10);

    const dailyData = await scraper.scrapeDailyData();

    if (dailyData.length > 0) {
      await scraper.saveToDatabase(dailyData);
    }

    console.log('\n✅ 全ての処理が完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

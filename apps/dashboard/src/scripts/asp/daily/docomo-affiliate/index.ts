import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface DocomoAffiliateCredentials {
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

export class DocomoAffiliateDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: DocomoAffiliateCredentials;
  private config: ScraperConfig;

  constructor(credentials: DocomoAffiliateCredentials, config: ScraperConfig) {
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

    console.log('🔐 ドコモアフィリエイトにログイン中...');

    // ドコモアフィリエイトのパートナーログインページ
    await this.page.goto('https://affiliate-sp.docomo.ne.jp/pt/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await this.page.waitForTimeout(3000);
    await this.screenshot('docomo-affiliate-login-page.png');

    // ログインフォームの入力フィールドを探す
    const textInputs = await this.page.locator('input[type="text"], input[type="email"], input:not([type])').all();
    const passwordInputs = await this.page.locator('input[type="password"]').all();

    console.log(`テキスト入力フィールド数: ${textInputs.length}`);
    console.log(`パスワード入力フィールド数: ${passwordInputs.length}`);

    if (textInputs.length > 0 && passwordInputs.length > 0) {
      console.log('ログインID入力中...');
      await textInputs[0].fill(this.credentials.username);
      await this.page.waitForTimeout(500);

      console.log('パスワード入力中...');
      await passwordInputs[0].fill(this.credentials.password);
      await this.page.waitForTimeout(1000);

      await this.screenshot('docomo-affiliate-before-login-click.png');

      // ログインボタンをクリック
      const loginButtons = await this.page.locator('button:has-text("ログイン"), input[type="submit"], button[type="submit"]').all();
      console.log(`ログインボタン数: ${loginButtons.length}`);

      if (loginButtons.length > 0) {
        console.log('ログインボタンをクリック中...');
        await loginButtons[0].click();
        await this.page.waitForTimeout(5000);
      } else {
        // ログインボタンが見つからない場合、すべてのボタンを探す
        const allButtons = await this.page.locator('button, input[type="submit"]').all();
        console.log(`全ボタン数: ${allButtons.length}`);

        if (allButtons.length > 0) {
          console.log('最初のボタンをクリック中...');
          await allButtons[0].click();
          await this.page.waitForTimeout(5000);
        }
      }

      await this.screenshot('docomo-affiliate-after-login.png');
      console.log('✅ ログイン処理完了');
      console.log(`現在のURL: ${this.page.url()}`);
    } else {
      console.log('⚠️ ログインフィールドが見つかりませんでした');
    }
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 レポートページに移動中...');

    await this.page.waitForTimeout(3000);

    // まずページ上のすべてのリンクを確認
    const links = await this.page.locator('a').all();
    console.log(`リンク総数: ${links.length}`);

    let reportLinkFound = false;

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');
      const isVisible = await link.isVisible().catch(() => false);

      // レポート関連のリンクを探す
      if (isVisible && (
        text?.includes('レポート') ||
        text?.includes('成果') ||
        text?.includes('実績') ||
        text?.includes('統計') ||
        href?.includes('report') ||
        href?.includes('stats') ||
        href?.includes('daily')
      )) {
        console.log(`リンク発見 [${i}]: "${text?.trim()}" (href: ${href})`);

        // 日別レポートを優先的に探す
        if (text?.includes('日別') || text?.includes('日次') || href?.includes('daily')) {
          console.log('日別レポートリンクをクリック中...');
          await link.click();
          await this.page.waitForTimeout(5000);
          reportLinkFound = true;
          break;
        }
      }
    }

    // 日別レポートが見つからない場合、一般的なレポートリンクをクリック
    if (!reportLinkFound) {
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const text = await link.textContent().catch(() => '');
        const isVisible = await link.isVisible().catch(() => false);

        if (isVisible && (text?.includes('レポート') || text?.includes('成果') || text?.includes('実績'))) {
          console.log(`レポートリンクをクリック中: "${text?.trim()}"`);
          await link.click();
          await this.page.waitForTimeout(3000);
          reportLinkFound = true;
          break;
        }
      }
    }

    await this.screenshot('docomo-affiliate-report-page.png');
    console.log('✅ レポートページに移動完了');
    console.log(`現在のURL: ${this.page.url()}`);
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    const data: DailyData[] = [];

    await this.page.waitForTimeout(3000);
    await this.screenshot('docomo-affiliate-data-page.png');

    // データテーブルを探す
    const tables = await this.page.locator('table').count();
    console.log(`\nテーブル総数: ${tables}`);

    for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
      const table = this.page.locator('table').nth(tableIndex);
      const tableClass = await table.getAttribute('class');
      const isVisible = await table.isVisible();

      if (!isVisible) continue;

      const tbodyRows = await table.locator('tbody tr').count();
      if (tbodyRows === 0) continue;

      console.log(`\nテーブル ${tableIndex + 1} を確認中 (class: ${tableClass}, rows: ${tbodyRows})`);

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

        // ヘッダーを確認（存在する場合）
        const theadExists = await table.locator('thead').count();
        if (theadExists > 0) {
          const headers = await table.locator('thead th, thead td').allTextContents();
          console.log(`ヘッダー:`, headers.map(h => h.trim()));
        }

        // データを抽出
        for (let i = 0; i < tbodyRows; i++) {
          const row = table.locator('tbody tr').nth(i);
          const cells = await row.locator('td, th').allTextContents();

          let dateValue = '';
          let revenueValue = '';

          // 最初の日付を取得
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j].trim();
            if (/\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell) || /\d{1,2}[/-]\d{1,2}/.test(cell)) {
              dateValue = cell;
              break;
            }
          }

          // 最後の金額列を取得（報酬合計）
          for (let j = cells.length - 1; j >= 0; j--) {
            const cell = cells[j].trim();
            // 金額パターン（¥記号、数字、カンマを含む）
            if (/^[¥\\d,]+$/.test(cell) && cell.length > 0) {
              revenueValue = cell;
              break;
            }
          }

          if (dateValue && revenueValue) {
            // 日付フォーマットを正規化 (YYYY-MM-DD形式に変換)
            let normalizedDate = dateValue;

            // YYYY/MM/DD または YYYY-MM-DD 形式
            const fullDateMatch = dateValue.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
            if (fullDateMatch) {
              const year = fullDateMatch[1];
              const month = fullDateMatch[2].padStart(2, '0');
              const day = fullDateMatch[3].padStart(2, '0');
              normalizedDate = `${year}-${month}-${day}`;
            }

            console.log(`✓ ${normalizedDate}: ${revenueValue}`);
            data.push({
              date: normalizedDate,
              confirmedRevenue: revenueValue,
            });
          }
        }

        break;
      }
    }

    if (data.length === 0) {
      console.log('\n⚠️ データが見つかりません。ページの内容を確認...');
      const pageText = await this.page.evaluate(() => document.body.innerText);
      console.log(pageText.substring(0, 500));
    }

    await this.screenshot('docomo-affiliate-data-final.png');
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
    console.log(`📸 スクリーンショット保存: ${filename}`);
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
  const { data: asp } = await supabase.from('asps').select('id').eq('name', 'ドコモアフィリエイト').single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    return;
  }

  console.log('\n📋 ドコモアフィリエイト 日別レポート取得');
  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  // 提供された認証情報を使用
  const scraper = new DocomoAffiliateDailyScraper(
    { username: 'reredev', password: '53h7ghay' },
    { headless: false, mediaId: media.id, accountItemId: accountItem.id, aspId: asp.id }
  );

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToReportPage();
    const data = await scraper.scrapeDailyData();
    if (data.length > 0) {
      await scraper.saveToDatabase(data);
      console.log('\n✅ 全ての処理が完了しました！');
    } else {
      console.log('⚠️ 取得したデータが0件です');
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

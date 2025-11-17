import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface WebridgeCredentials {
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
  useRealChrome?: boolean;
}

export class WebridgeDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private context: BrowserContext | null = null;
  private credentials: WebridgeCredentials;
  private config: ScraperConfig;
  private cookiesPath: string = '/tmp/webridge_cookies.json';

  constructor(credentials: WebridgeCredentials, config: ScraperConfig) {
    this.credentials = credentials;
    this.config = config;
  }

  async saveCookies() {
    if (!this.context) return;
    const cookies = await this.context.cookies();
    fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
    console.log(`🍪 クッキーを保存しました: ${this.cookiesPath}`);
  }

  async loadCookies(): Promise<boolean> {
    if (!fs.existsSync(this.cookiesPath)) {
      console.log('⚠️  保存されたクッキーが見つかりません');
      return false;
    }

    try {
      const cookiesString = fs.readFileSync(this.cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesString);

      if (this.context) {
        await this.context.addCookies(cookies);
        console.log('✅ クッキーを読み込みました');
        return true;
      }
    } catch (error) {
      console.log('❌ クッキーの読み込みに失敗:', error);
    }
    return false;
  }

  async initialize() {
    console.log('🚀 ブラウザを起動しています...');

    if (this.config.useRealChrome) {
      // 実際のChromeブラウザを使用
      console.log('💻 実際のChromeブラウザを使用します');
      const userDataDir = '/tmp/webridge-chrome-profile';

      // ユーザーデータディレクトリが存在しない場合は作成
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
      }

      this.context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        channel: 'chrome', // 実際のChromeを使用
        viewport: { width: 1920, height: 1080 },
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        args: [
          '--disable-blink-features=AutomationControlled',
        ],
      });

      this.page = this.context.pages()[0] || await this.context.newPage();
    } else {
      // 通常のPlaywright Chromiumを使用
      this.browser = await chromium.launch({
        headless: this.config.headless ?? false,
        slowMo: this.config.headless ? 0 : 500,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'ja-JP',
        timezoneId: 'Asia/Tokyo',
        permissions: [],
        hasTouch: false,
        isMobile: false,
        deviceScaleFactor: 2,
        colorScheme: 'light',
      });

      this.page = await this.context.newPage();
    }

    // Advanced anti-detection measures
    await this.page.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override navigator properties
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel',
      });

      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.',
      });

      // Mock chrome object with more realistic structure
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {},
      };

      // Mock plugins with realistic data
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const pluginArray = [
            {
              0: { type: "application/x-google-chrome-pdf" },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin"
            },
            {
              0: { type: "application/pdf" },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Viewer"
            }
          ];
          return pluginArray;
        },
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ja-JP', 'ja', 'en-US', 'en'],
      });

      // Override permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied' } as PermissionStatus) :
          originalQuery(parameters)
      );

      // Mock battery API
      Object.defineProperty(navigator, 'getBattery', {
        get: () => () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1,
        }),
      });

      // Add missing window properties
      (window as any).outerWidth = window.screen.width;
      (window as any).outerHeight = window.screen.height;
    });

    console.log('✅ ブラウザ起動完了（ステルスモード）');
  }

  async login() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    // まずクッキーを読み込んでみる
    const hasCookies = await this.loadCookies();

    if (hasCookies) {
      console.log('🍪 保存されたクッキーでログインを試みます...');

      // ログイン後のページに直接アクセス
      await this.page.goto('https://webridge.net/publisher/main', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await this.page.waitForTimeout(3000);

      // ログインページにリダイレクトされていないか確認
      const currentUrl = this.page.url();
      if (currentUrl.includes('/publisher/main')) {
        console.log('✅ クッキーによるログイン成功！');
        await this.screenshot('webridge-cookie-login-success.png');
        return;
      } else {
        console.log('⚠️  クッキーが無効になっています。手動ログインが必要です。');
      }
    }

    console.log('\n🔐 完全手動ログインモード');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📌 以下の手順で手動ログインしてください:');
    console.log('   1. ブラウザウィンドウでログインIDを入力');
    console.log('   2. パスワードを入力');
    console.log('   3. 「ログイン」ボタンをクリック');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // WEBRIDGEのログインページに移動
    await this.page.goto('https://webridge.net/ja_jp/top/publisher/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await this.page.waitForTimeout(2000);
    await this.screenshot('webridge-login-page.png');

    console.log('⏳ ログインが完了するまで最大3分待機します...\n');

    // URLが変わるまで待機（最大3分）
    const currentUrl = this.page.url();
    try {
      await this.page.waitForFunction(
        (loginUrl) => window.location.href !== loginUrl && window.location.href.includes('/publisher/'),
        currentUrl,
        { timeout: 180000 }
      );
      console.log('✅ ログイン成功を検出しました！');
      await this.page.waitForTimeout(3000); // ページの読み込みを待つ
    } catch (error) {
      console.log('❌ タイムアウト: ログインが完了しませんでした');
      throw new Error('ログインタイムアウト');
    }

    await this.screenshot('webridge-after-login.png');
    console.log(`✅ ログイン処理完了。現在のURL: ${this.page.url()}`);

    // ログイン成功したらクッキーを保存
    if (this.page.url().includes('/publisher/')) {
      await this.saveCookies();
    }
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別レポートページに移動中...');

    // 日別レポートページに直接移動
    await this.page.goto('https://webridge.net/publisher/report?reportType=DAILY', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await this.page.waitForTimeout(3000);
    await this.screenshot('webridge-daily-report-page.png');
    console.log(`✅ 日別レポートページに移動しました: ${this.page.url()}`);

    // ページ上のテーブルやフォームを確認
    const tables = await this.page.locator('table').count();
    const inputs = await this.page.locator('input').count();
    const buttons = await this.page.locator('button').count();

    console.log(`\nページ要素:`);
    console.log(`  - テーブル数: ${tables}`);
    console.log(`  - 入力フィールド数: ${inputs}`);
    console.log(`  - ボタン数: ${buttons}`);
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    console.log('📊 日別データ取得中...');

    // 実装はレポートページの構造を確認してから追加
    return [];
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
      const cleanAmount = item.confirmedRevenue.replace(/[¥,円]/g, '').trim();
      const amount = parseFloat(cleanAmount);

      if (isNaN(amount)) {
        console.error(`❌ ${item.date} の金額変換失敗: "${item.confirmedRevenue}"`);
        failCount++;
        continue;
      }

      // 日付形式を変換 YYYY/MM/DD -> YYYY-MM-DD
      const cleanDate = item.date.replace(/\//g, '-');

      const { error } = await supabase
        .from('daily_actuals')
        .upsert({
          date: cleanDate,
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

  async close() {
    if (this.context && this.config.useRealChrome) {
      await this.context.close();
      console.log('🔒 ブラウザを閉じました');
    } else if (this.browser) {
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
    .eq('name', 'webridge')
    .single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    console.log('Media:', media);
    console.log('Account Item:', accountItem);
    console.log('ASP:', asp);
    return;
  }

  console.log('\n📋 WEBRIDGE 日別レポート取得');
  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  const scraper = new WebridgeDailyScraper(
    {
      username: 'outletme',
      password: 'Password1234!',
    },
    {
      headless: false,
      useRealChrome: true, // 実際のChromeブラウザを使用
      mediaId: media.id,
      accountItemId: accountItem.id,
      aspId: asp.id,
    }
  );

  try {
    await scraper.initialize();
    await scraper.login();
    await scraper.navigateToReportPage();

    // const dailyData = await scraper.scrapeDailyData();
    // if (dailyData.length > 0) {
    //   await scraper.saveToDatabase(dailyData);
    // }

    console.log('\n✅ 処理が完了しました！');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

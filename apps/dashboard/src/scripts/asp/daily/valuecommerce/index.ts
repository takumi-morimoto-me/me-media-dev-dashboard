import { chromium, type Browser, type Page } from 'playwright';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ValueCommerceCredentials {
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

export class ValueCommerceDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: ValueCommerceCredentials;
  private config: ScraperConfig;

  constructor(credentials: ValueCommerceCredentials, config: ScraperConfig) {
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
      javaScriptEnabled: true,
      acceptDownloads: true,
      hasTouch: false,
      isMobile: false,
    });

    this.page = await context.newPage();
    console.log('✅ ブラウザ起動完了');
  }

  async login() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('🔐 バリューコマースにログイン中...');

    // バリューコマースのトップページに移動
    await this.page.goto('https://aff.valuecommerce.ne.jp/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // JavaScriptの読み込みを待つ
    await this.page.waitForLoadState('networkidle').catch(() => {
      console.log('⚠️ ネットワークアイドル待機タイムアウト');
    });

    await this.page.waitForTimeout(5000);
    await this.screenshot('valuecommerce-login-page.png');

    console.log('ページタイトル:', await this.page.title());
    console.log('現在のURL:', this.page.url());
    console.log('ログインフォームを探しています...');

    // ログインフォームが表示されるまで待機（最大30秒）
    try {
      await this.page.waitForSelector('input[type="text"], input[type="email"], input[name*="mail"], input[name*="login"]', {
        timeout: 30000,
        state: 'visible'
      });
      console.log('✅ ログインフォームを検出しました');
    } catch (error) {
      console.log('⚠️ ログインフォームの検出タイムアウト。続行します...');
    }

    // すべてのinput要素を確認
    const inputs = await this.page.locator('input:visible').all();
    console.log(`可視input要素の数: ${inputs.length}`);

    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      const input = inputs[i];
      const type = await input.getAttribute('type');
      const name = await input.getAttribute('name');
      const id = await input.getAttribute('id');
      const placeholder = await input.getAttribute('placeholder');
      const isVisible = await input.isVisible();
      console.log(`input ${i}: type=${type}, name=${name}, id=${id}, placeholder=${placeholder}, visible=${isVisible}`);
    }

    // すべてのフォームを確認
    const forms = await this.page.locator('form').all();
    console.log(`フォーム数: ${forms.length}`);
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const action = await form.getAttribute('action');
      const id = await form.getAttribute('id');
      const isVisible = await form.isVisible();
      console.log(`form ${i}: action=${action}, id=${id}, visible=${isVisible}`);

      if (isVisible) {
        const formInputs = await form.locator('input:visible').all();
        console.log(`  可視input数: ${formInputs.length}`);
        for (let j = 0; j < formInputs.length; j++) {
          const input = formInputs[j];
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const id = await input.getAttribute('id');
          console.log(`    input ${j}: type=${type}, name=${name}, id=${id}`);
        }
      }
    }

    // バリューコマースのログインフォームに直接入力
    const emailInput = this.page.locator('input[name="login_form[emailAddress]"]');
    const passwordInput = this.page.locator('input[name="login_form[encryptedPasswd]"]');

    // メールアドレスを入力
    if (await emailInput.count() > 0) {
      console.log(`\nメールアドレスを入力: ${this.credentials.username}`);
      await emailInput.click();
      await this.page.waitForTimeout(500);
      await emailInput.fill('');
      await this.page.waitForTimeout(200);
      await emailInput.fill(this.credentials.username);
      console.log('✅ メールアドレス入力完了');
      await this.page.waitForTimeout(500);
    } else {
      throw new Error('メールアドレスフィールドが見つかりません');
    }

    // パスワードを入力
    if (await passwordInput.count() > 0) {
      console.log(`\nパスワードを入力中...`);
      await passwordInput.click();
      await this.page.waitForTimeout(500);
      await passwordInput.fill('');
      await this.page.waitForTimeout(200);
      await passwordInput.fill(this.credentials.password);
      console.log('✅ パスワード入力完了');
      await this.page.waitForTimeout(500);
    } else {
      throw new Error('パスワードフィールドが見つかりません');
    }

    await this.screenshot('valuecommerce-before-login-click.png');

    // ログインボタンを探す（text="ログイン" かつ type="submit"）
    console.log('\nログインボタンを探しています...');
    const loginButton = this.page.locator('button[type="submit"]:has-text("ログイン")');

    if (await loginButton.count() > 0) {
      console.log('✅ ログインボタンを発見しました');
      console.log('ログインボタンをクリック中...');

      // ナビゲーション完了を待機
      await Promise.all([
        this.page.waitForURL(url => !url.includes('/login'), { timeout: 30000 }),
        loginButton.click()
      ]).catch(() => {
        console.log('⚠️ ナビゲーション待機がタイムアウトしましたが、続行します');
      });

      await this.page.waitForTimeout(3000);
    } else {
      // フォールバック: submitボタンを探す
      const submitButton = this.page.locator('button[type="submit"]').first();
      if (await submitButton.count() > 0) {
        console.log('⚠️ ログインボタンが見つからないため、最初のsubmitボタンをクリックします');
        await Promise.all([
          this.page.waitForLoadState('domcontentloaded', { timeout: 30000 }),
          submitButton.click()
        ]).catch(() => {
          console.log('⚠️ ナビゲーション待機がタイムアウトしましたが、続行します');
        });
        await this.page.waitForTimeout(3000);
      } else {
        throw new Error('ログインボタンが見つかりません');
      }
    }

    await this.screenshot('valuecommerce-after-login.png');

    // ログイン成功確認
    const currentUrl = this.page.url();
    console.log(`現在のURL: ${currentUrl}`);

    // エラーメッセージをチェック
    const pageText = await this.page.evaluate(() => document.body.innerText);
    if (pageText.includes('ログインに失敗') || pageText.includes('失敗しました')) {
      console.error('❌ ログインに失敗しました');
      throw new Error('ログインに失敗しました。認証情報を確認してください。');
    }

    if (currentUrl.includes('/login')) {
      console.log('⚠️ ログインページのままです。再試行が必要かもしれません。');
    } else {
      console.log('✅ ログイン成功！');
    }

    console.log('✅ ログイン処理完了');
  }

  async navigateToReportPage() {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 レポートページに移動中...');
    console.log('現在のURL:', this.page.url());

    await this.page.waitForTimeout(2000);

    // まず、ホームページのリンクを確認
    console.log('ホームページのリンクを確認中...');
    const allLinks = await this.page.locator('a').all();
    console.log(`リンク総数: ${allLinks.length}`);

    // レポートメニューを探す
    for (let i = 0; i < Math.min(allLinks.length, 50); i++) {
      const link = allLinks[i];
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      if (text?.includes('レポート') || text?.includes('REPORT') || href?.includes('report')) {
        console.log(`${i}. レポートリンク発見: "${text?.trim()}" (href: ${href})`);
      }
    }

    // バリューコマースのレポートページ（注文別レポート）に移動
    try {
      console.log('\n注文別レポートページに移動中...');
      await this.page.goto('https://aff.valuecommerce.ne.jp/report/transactions', {
        waitUntil: 'networkidle',
        timeout: 60000
      });
      console.log('✅ 注文別レポートページに移動しました');

      // ページが完全に読み込まれるまで待機
      await this.page.waitForTimeout(5000);
    } catch (error) {
      console.log('⚠️ 直接移動に失敗、メニューから探します');

      // レポートメニューを探す
      const reportLinks = await this.page.locator('a').all();

      for (const link of reportLinks) {
        const text = await link.textContent().catch(() => '');
        const href = await link.getAttribute('href').catch(() => '');

        if (text?.includes('レポート') || text?.includes('REPORT') || text?.includes('日別') || href?.includes('report') || href?.includes('daily')) {
          console.log(`レポートリンク発見: "${text}" (href: ${href})`);
          await link.click();
          await this.page.waitForTimeout(5000);
          break;
        }
      }
    }

    await this.page.waitForTimeout(2000);
    await this.screenshot('valuecommerce-report-page.png');
    console.log('✅ レポートページに到達');
    console.log('現在のURL:', this.page.url());

    // ページの全要素を確認
    console.log('\nページ上の要素を確認中...');
    const pageText = await this.page.evaluate(() => {
      return document.body.innerText.substring(0, 500);
    });
    console.log('ページテキスト（最初の500文字）:');
    console.log(pageText);

    // レポート選択のメニューを確認（タブやリンク）
    console.log('\nレポート選択オプションを確認中...');

    // 「レポート選択」ラベルの近くにある要素を探す
    const reportLinks = await this.page.locator('a').all();
    console.log(`\nリンク要素を確認（レポート関連）:`);

    for (let i = 0; i < Math.min(reportLinks.length, 100); i++) {
      const link = reportLinks[i];
      const text = await link.textContent().catch(() => '');
      const href = await link.getAttribute('href').catch(() => '');

      // レポート関連のリンクをフィルタ
      if (text?.includes('レポート') || text?.includes('月') || text?.includes('日') ||
          href?.includes('report') || href?.includes('monthly') || href?.includes('daily')) {
        console.log(`  ${i}. "${text?.trim()}" -> ${href}`);
      }
    }

    // ボタン要素も確認
    const reportButtons = await this.page.locator('button').all();
    console.log(`\nボタン要素を確認（レポート関連）:`);

    for (let i = 0; i < Math.min(reportButtons.length, 50); i++) {
      const button = reportButtons[i];
      const text = await button.textContent().catch(() => '');
      const className = await button.getAttribute('class').catch(() => '');

      if (text?.includes('レポート') || text?.includes('月') || text?.includes('日') ||
          className?.includes('report')) {
        console.log(`  ${i}. "${text?.trim()}" (class: ${className})`);
      }
    }
  }

  async setReportPeriod(startDate: string, endDate: string) {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\n📅 レポート期間を設定中: ${startDate} ～ ${endDate}`);

    try {
      // 期間設定フィールドをクリックしてカレンダーを開く
      const periodInput = this.page.locator('input[name="targetDate"]');

      if (await periodInput.count() > 0) {
        console.log('✅ 期間設定フィールドを発見、カレンダーを開きます...');

        await periodInput.click();
        await this.page.waitForTimeout(2000);

        await this.screenshot('valuecommerce-calendar-opened.png');

        // カレンダーUIから日付を選択する実装を追加する必要があります
        // 現時点では、デフォルトの期間を使用
        console.log('⚠️ カレンダーUIからの日付選択は未実装です');

        // カレンダーを閉じる（ESCキー）
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(1000);
      }
    } catch (error: any) {
      console.log(`⚠️ 期間設定エラー: ${error.message}`);
    }
  }

  async downloadCSV(startDate: string, endDate: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log(`\n💾 CSV ダウンロード中`);
    console.log('⚠️ 現在はデフォルトの期間（最近14日間）でダウンロードします');

    try {
      // CSVダウンロードボタンをクリック
      const csvButton = this.page.locator('button:has-text("CSVダウンロード")');

      if (await csvButton.count() > 0) {
        console.log('✅ CSVダウンロードボタンを発見');

        await this.screenshot('valuecommerce-before-csv-download.png');

        // ボタンをクリックしてドロップダウンメニューを開く
        await csvButton.click();
        console.log('✅ CSVダウンロードボタンをクリックしました');

        await this.page.waitForTimeout(1000);
        await this.screenshot('valuecommerce-csv-menu-opened.png');

        // ドロップダウンメニューから「表示されているデータ」を選択（最初のオプション）
        console.log('📋 ドロップダウンメニューから「表示されているデータ」を選択中...');
        const displayedDataOption = this.page.locator('text=表示されているデータ').first();

        if (await displayedDataOption.count() > 0) {
          console.log('✅ 「表示されているデータ」オプションを発見');

          // ダウンロードイベントをリスナーに設定
          const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });

          // オプションをクリック
          await displayedDataOption.click();
          console.log('✅ 「表示されているデータ」をクリックしました');

          await this.page.waitForTimeout(2000);
          await this.screenshot('valuecommerce-after-option-click.png');

          // ダウンロード完了を待機
          console.log('⏳ ダウンロード完了を待機中...');
          const download = await downloadPromise;
          const fileName = download.suggestedFilename();
          const filePath = `/tmp/valuecommerce_${Date.now()}.csv`;

          await download.saveAs(filePath);
          console.log(`✅ CSVダウンロード完了: ${fileName} -> ${filePath}`);

          return filePath;
        } else {
          throw new Error('「表示されているデータ」オプションが見つかりません');
        }
      } else {
        throw new Error('CSVダウンロードボタンが見つかりません');
      }
    } catch (error: any) {
      console.error(`❌ CSVダウンロードエラー: ${error.message}`);
      await this.screenshot('valuecommerce-csv-error.png');
      throw error;
    }
  }

  async parseCSV(filePath: string): Promise<DailyData[]> {
    console.log(`\n📊 CSVファイルを解析中: ${filePath}`);

    const fs = require('fs');
    const iconv = require('iconv-lite');
    const data: DailyData[] = [];

    try {
      // Shift_JISでCSVファイルを読み込む
      const buffer = fs.readFileSync(filePath);
      const csvContent = iconv.decode(buffer, 'Shift_JIS');
      const lines = csvContent.split('\n');

      console.log(`CSV総行数: ${lines.length}`);

      // 最初の10行を表示してデバッグ
      console.log('\n📋 CSV最初の10行:');
      for (let i = 0; i < Math.min(lines.length, 10); i++) {
        console.log(`${i + 1}: ${lines[i].substring(0, 100)}`);
      }

      // ヘッダー行をスキップして処理
      let headerFound = false;
      let orderDateIndex = -1;
      let revenueIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = line.split(',');

        if (!headerFound) {
          // ヘッダー行を探す
          for (let j = 0; j < columns.length; j++) {
            const col = columns[j].replace(/"/g, '').trim();
            if (col.includes('注文日')) {
              orderDateIndex = j;
            }
            if (col.includes('成果報酬') && col.includes('税抜')) {
              revenueIndex = j;
            }
          }

          if (orderDateIndex >= 0 && revenueIndex >= 0) {
            headerFound = true;
            console.log(`\n✅ ヘッダー行を発見 (行${i + 1})`);
            console.log(`   注文日: 列${orderDateIndex}, 成果報酬: 列${revenueIndex}`);
            console.log(`   ヘッダー列数: ${columns.length}`);
            continue;
          }
        } else {
          // データ行を処理
          if (orderDateIndex < columns.length && revenueIndex < columns.length) {
            const dateStr = columns[orderDateIndex].replace(/"/g, '').trim();
            const revenueStr = columns[revenueIndex].replace(/"/g, '').trim();

            // 日付形式を確認
            const dateMatch = dateStr.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
            if (dateMatch && revenueStr) {
              data.push({
                date: dateMatch[1],
                confirmedRevenue: revenueStr,
              });
            }
          }
        }
      }

      console.log(`\n✅ ${data.length}件のデータを抽出しました`);

      // 日別に集計
      console.log('\n📊 日別に集計中...');
      const dailyTotals = new Map<string, number>();

      for (const item of data) {
        const cleanAmount = item.confirmedRevenue.replace(/[¥,円]/g, '').trim();
        const amount = parseFloat(cleanAmount);

        if (!isNaN(amount)) {
          const currentTotal = dailyTotals.get(item.date) || 0;
          dailyTotals.set(item.date, currentTotal + amount);
        }
      }

      // 日別集計結果を配列に変換
      const result: DailyData[] = [];
      for (const [date, total] of Array.from(dailyTotals.entries()).sort()) {
        result.push({
          date,
          confirmedRevenue: total.toString(),
        });
      }

      console.log(`✅ 日別集計完了: ${result.length}日分`);
      return result;

    } catch (error: any) {
      console.error(`❌ CSV解析エラー: ${error.message}`);
      throw error;
    }
  }

  async scrapeDailyData(): Promise<DailyData[]> {
    if (!this.page) throw new Error('Browser not initialized.');

    console.log('📊 日別データ取得中...');
    console.log('ページURLを確認:', this.page.url());

    const allData: DailyData[] = [];
    let currentPage = 1;

    await this.page.waitForTimeout(2000);
    await this.screenshot('valuecommerce-before-search.png');

    console.log('\n既にデータが表示されています。全ページのデータを抽出します...');
    await this.screenshot('valuecommerce-data-display.png');

    // 全ページのデータを取得するループ
    while (true) {
      console.log(`\n📄 ページ ${currentPage} を処理中...`);

      const data: DailyData[] = [];

      // データテーブルを探す
      console.log('📊 データテーブルを探しています...');
      const tables = await this.page.locator('table').count();

      for (let tableIndex = 0; tableIndex < tables; tableIndex++) {
        const table = this.page.locator('table').nth(tableIndex);
        const isVisible = await table.isVisible();

        if (!isVisible) continue;

        const tbodyRows = await table.locator('tbody tr').count();
        if (tbodyRows === 0) continue;

        // 最初の行をチェック
        const firstRow = table.locator('tbody tr').first();
        const firstCells = await firstRow.locator('td, th').allTextContents();

        // 日付パターンをチェック（注文日の列を探す）
        const hasDatePattern = firstCells.some(cell =>
          /\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(cell)
        );

        if (hasDatePattern && tbodyRows > 0) {
          console.log(`🎉 データテーブル発見！(${tbodyRows}行)`);

          // バリューコマースの列インデックス
          const orderDateIndex = 2; // 注文日の列
          const revenueIndex = 9; // 成果報酬（税抜）の列

          // データを抽出（全ての行）
          for (let i = 0; i < tbodyRows; i++) {
            const row = table.locator('tbody tr').nth(i);
            const cells = await row.locator('td, th').allTextContents();

            let dateValue = '';
            let revenueValue = '';

            // 注文日を取得
            if (orderDateIndex >= 0 && orderDateIndex < cells.length) {
              dateValue = cells[orderDateIndex].trim();
              // YYYY/MM/DD HH:MM 形式から日付部分のみを抽出
              const dateMatch = dateValue.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
              if (dateMatch) {
                dateValue = dateMatch[1];
              }
            }

            // 成果報酬を取得
            if (revenueIndex >= 0 && revenueIndex < cells.length) {
              revenueValue = cells[revenueIndex].trim();
            }

            if (dateValue && revenueValue) {
              data.push({
                date: dateValue,
                confirmedRevenue: revenueValue,
              });
            }
          }

          console.log(`✅ ページ ${currentPage}: ${data.length}件の注文データを抽出`);
          allData.push(...data);

          break;
        }
      }

      // 次のページボタンを探す
      const nextButton = this.page.locator('button.btn-next:not(:disabled), a:has-text("次へ"), button:has-text("›"):not(:disabled)');

      if (await nextButton.count() > 0 && await nextButton.isEnabled().catch(() => false)) {
        console.log('➡️  次のページに移動中...');
        await nextButton.click();
        await this.page.waitForTimeout(3000);
        currentPage++;
      } else {
        console.log('✅ 全ページの処理が完了しました');
        break;
      }
    }

    console.log(`\n📊 合計 ${allData.length}件の注文データを抽出しました`);

    // 日別に集計
    console.log('\n📊 日別に集計中...');
    const dailyTotals = new Map<string, number>();

    for (const item of allData) {
      const cleanAmount = item.confirmedRevenue.replace(/[¥,円]/g, '').trim();
      const amount = parseFloat(cleanAmount);

      if (!isNaN(amount)) {
        const currentTotal = dailyTotals.get(item.date) || 0;
        dailyTotals.set(item.date, currentTotal + amount);
      }
    }

    // 日別集計結果を配列に変換
    const result: DailyData[] = [];
    for (const [date, total] of Array.from(dailyTotals.entries()).sort()) {
      result.push({
        date,
        confirmedRevenue: total.toString(),
      });
      console.log(`✓ ${date}: ¥${total.toLocaleString()}`);
    }

    if (result.length === 0) {
      console.log('\n⚠️ データが見つかりません。');
    }

    await this.screenshot('valuecommerce-data-final.png');
    console.log(`\n✅ ${result.length}件のデータを取得しました`);
    return result;
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
    .eq('name', 'バリューコマース')
    .single();

  if (!media || !accountItem || !asp) {
    console.error('必要な情報が取得できませんでした');
    console.log('Media:', media);
    console.log('Account Item:', accountItem);
    console.log('ASP:', asp);
    return;
  }

  console.log('\n📋 バリューコマース 日別レポート取得');
  console.log(`📱 メディアID: ${media.id}`);
  console.log(`💰 勘定科目ID: ${accountItem.id}`);
  console.log(`🔗 ASP ID: ${asp.id}\n`);

  // 直接指定された認証情報を使用
  const scraper = new ValueCommerceDailyScraper(
    {
      username: 'rere-dev@marketenterprise.co.jp',
      password: 'Winwin123',
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

    // CSVダウンロード方式でデータを取得（テスト）
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 CSVダウンロード方式でデータを取得します（デフォルト期間）');
    console.log('='.repeat(60));

    try {
      const csvPath = await scraper.downloadCSV('', '');
      console.log(`\n📊 CSVファイルをパース中...`);
      const dailyData = await scraper.parseCSV(csvPath);

      if (dailyData.length > 0) {
        await scraper.saveToDatabase(dailyData);
      }

      // CSVファイルを削除
      const fs = require('fs');
      fs.unlinkSync(csvPath);
      console.log(`🗑️  一時ファイルを削除: ${csvPath}`);

      console.log(`\n✅ CSVダウンロード成功: ${dailyData.length}日分のデータを取得`);

    } catch (error: any) {
      console.error(`❌ CSVダウンロード失敗: ${error.message}`);
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

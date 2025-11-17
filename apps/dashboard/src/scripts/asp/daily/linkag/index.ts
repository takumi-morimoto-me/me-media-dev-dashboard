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
  startYearMonth?: string; // YYYYMM format (e.g., "202501")
  endYearMonth?: string; // YYYYMM format (e.g., "202502")
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
    await this.page.screenshot({ path: 'screenshots/linkag-login-page.png', fullPage: true });
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

        await this.page.screenshot({ path: 'screenshots/linkag-after-login.png', fullPage: true });
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

          await this.page.screenshot({ path: 'screenshots/linkag-after-login.png', fullPage: true });
          console.log('📸 ログイン後のスクリーンショット保存');
        }
      }
    } else {
      console.log('⚠️  ログインフィールドが見つかりませんでした');
    }

    console.log('✅ ログイン処理完了');
  }

  async navigateToDailyReport() {
    if (!this.page) {
      throw new Error('Browser not initialized.');
    }

    console.log('📊 日別レポートページに移動中...');

    // 日別レポートページに直接移動
    await this.page.goto('https://link-ag.net/partner/summaries/dates', {
      waitUntil: 'domcontentloaded',
    });
    await this.page.waitForTimeout(3000);

    await this.page.screenshot({ path: 'screenshots/linkag-daily-page.png', fullPage: true });
    console.log('📸 日別レポートページのスクリーンショット保存');

    // 期間選択がある場合
    if (this.config.startYearMonth && this.config.endYearMonth) {
      console.log(`📅 期間選択: ${this.config.startYearMonth} ～ ${this.config.endYearMonth}`);

      // YYYYMM形式をYYYY-MM-DDに変換（開始日は1日、終了日は末日）
      const formatStartDate = (yyyymm: string) => {
        const year = yyyymm.substring(0, 4);
        const month = yyyymm.substring(4, 6);
        return `${year}-${month}-01`;
      };

      const formatEndDate = (yyyymm: string) => {
        const year = parseInt(yyyymm.substring(0, 4));
        const month = parseInt(yyyymm.substring(4, 6));
        // 次の月の0日 = 今月の末日
        const lastDay = new Date(year, month, 0).getDate();
        return `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
      };

      const startFormatted = formatStartDate(this.config.startYearMonth);
      const endFormatted = formatEndDate(this.config.endYearMonth);

      console.log(`📅 日付範囲: ${startFormatted} ～ ${endFormatted}`);

      // 期間選択の入力フィールドを探す（日付形式: YYYY-MM-DD）
      const inputs = await this.page.locator('input[type="text"], input[type="date"], input:not([type="hidden"]):not([type="submit"]):not([type="button"])').all();

      console.log(`入力フィールド数: ${inputs.length}`);

      // 期間フィールドを順番に探す
      let foundStartField = false;
      for (let i = 0; i < inputs.length; i++) {
        const value = await inputs[i].inputValue();

        // 現在の値がYYYY-MM-DDの形式の場合、期間フィールドと判断
        if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // フィールドの詳細情報を取得
          const fieldInfo = await inputs[i].evaluate((el) => {
            const input = el as HTMLInputElement;
            return {
              type: input.type,
              readOnly: input.readOnly,
              disabled: input.disabled,
              id: input.id,
              name: input.name,
              className: input.className,
            };
          });

          console.log(`フィールド情報:`, fieldInfo);

          if (!foundStartField) {
            console.log(`開始日を入力中... (現在値: ${value} → 新しい値: ${startFormatted})`);

            // フィールドが読み取り専用でない場合のみ入力
            if (!fieldInfo.readOnly && !fieldInfo.disabled) {
              // フィールドをクリックしてフォーカス
              await inputs[i].click();
              await this.page.waitForTimeout(500);

              // すべての文字を選択して削除
              await this.page.keyboard.press('Meta+A');
              await this.page.waitForTimeout(200);
              await this.page.keyboard.press('Backspace');
              await this.page.waitForTimeout(500);

              // 1文字ずつ入力
              for (const char of startFormatted) {
                await this.page.keyboard.type(char);
                await this.page.waitForTimeout(50);
              }
              await this.page.waitForTimeout(500);

              // 入力後の値を確認
              const newValue = await inputs[i].inputValue();
              console.log(`入力後の値: ${newValue}`);
            } else {
              console.log('⚠️  フィールドが読み取り専用または無効です');
            }

            foundStartField = true;
          } else {
            console.log(`終了日を入力中... (現在値: ${value} → 新しい値: ${endFormatted})`);

            // フィールドが読み取り専用でない場合のみ入力
            if (!fieldInfo.readOnly && !fieldInfo.disabled) {
              // フィールドをクリックしてフォーカス
              await inputs[i].click();
              await this.page.waitForTimeout(500);

              // すべての文字を選択して削除
              await this.page.keyboard.press('Meta+A');
              await this.page.waitForTimeout(200);
              await this.page.keyboard.press('Backspace');
              await this.page.waitForTimeout(500);

              // 1文字ずつ入力
              for (const char of endFormatted) {
                await this.page.keyboard.type(char);
                await this.page.waitForTimeout(50);
              }
              await this.page.waitForTimeout(500);

              // 入力後の値を確認
              const newValue = await inputs[i].inputValue();
              console.log(`入力後の値: ${newValue}`);
            } else {
              console.log('⚠️  フィールドが読み取り専用または無効です');
            }

            break;
          }
        }
      }

      // 期間入力が完了するまで待機
      await this.page.waitForTimeout(2000);

      // 検索ボタンをクリック
      console.log('🔍 検索ボタンを探しています...');

      // input[type="submit"] も確認
      const submitInputs = await this.page.locator('input[type="submit"]').all();
      console.log(`\ninput[type="submit"]の数: ${submitInputs.length}`);

      for (let i = 0; i < submitInputs.length; i++) {
        const inputInfo = await submitInputs[i].evaluate((inp) => ({
          value: (inp as HTMLInputElement).value,
          className: inp.className,
        }));
        console.log(`input${i}: ${JSON.stringify(inputInfo)}`);
      }

      // 「検索」という値を持つinput[type="submit"]を探す
      const searchButton = this.page.locator('input[type="submit"][value="検索"]').first();
      const buttonCount = await searchButton.count();

      console.log(`検索ボタンの数: ${buttonCount}\n`);

      if (buttonCount > 0) {
        console.log('🔍 検索ボタンをクリック中...');

        // ナビゲーションを待機
        const navigationPromise = this.page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});

        await searchButton.click();

        // ナビゲーション完了を待機
        await navigationPromise;
        await this.page.waitForTimeout(3000);

        console.log('✅ 検索完了');
      } else {
        console.log('⚠️  検索ボタンが見つかりませんでした');
      }

      await this.page.screenshot({ path: 'screenshots/linkag-daily-report-result.png', fullPage: true });
      console.log('📸 日別レポート結果のスクリーンショット保存');
    }
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
        // 期間選択時（11列）: 0: 日付, 1: 曜日, 2: imp, 3: クリック数, 4: CTR, 5: 発生数, 6: CVR, 7: 発生報酬金額(税抜), 8: 承認数, 9: 確定報酬金額(税抜), 10: EPC
        // 現在月のみ（10列）: 0: 日付, 1: imp, 2: クリック数, 3: CTR, 4: 発生数, 5: CVR, 6: 発生報酬金額(税抜), 7: 承認数, 8: 確定報酬金額(税抜), 9: EPC
        const dateText = cells[0]?.trim(); // 日付 (2025/10/01形式)

        // 確定報酬金額のインデックスを決定（曜日カラムの有無で判定）
        const confirmedRevenueIndex = cells.length === 11 ? 9 : 8;
        const confirmedRevenue = cells[confirmedRevenueIndex]?.trim() || '0'; // 確定報酬金額(税抜)

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

    // 期間指定がある場合は日別レポートページに移動
    if (config.startYearMonth && config.endYearMonth) {
      await scraper.navigateToDailyReport();
    }

    // データを抽出
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

# ASPスクレイパー 実装ガイド

このドキュメントは、新しいASPスクレイパーを実装する際の注意事項とベストプラクティスをまとめたガイドです。

## 目次

1. [実装前の準備](#実装前の準備)
2. [ディレクトリ構造](#ディレクトリ構造)
3. [実装時の注意事項](#実装時の注意事項)
4. [データベース設計](#データベース設計)
5. [コーディング規約](#コーディング規約)
6. [エラーハンドリング](#エラーハンドリング)
7. [テスト](#テスト)
8. [デプロイ](#デプロイ)

---

## 実装前の準備

### 1. ASP情報の収集

- [ ] ASP管理画面のログインURL
- [ ] 認証方法 (ID/パスワード、OAuth、APIキーなど)
- [ ] レポートページのURL構造
- [ ] データ取得可能期間 (履歴データの保持期間)
- [ ] データ更新頻度 (日次、月次、リアルタイムなど)
- [ ] APIの有無と仕様
- [ ] 利用規約とスクレイピングの可否

### 2. データ形式の確認

- [ ] 日付形式 (YYYY-MM-DD, YYYY/MM/DD, など)
- [ ] 金額形式 (カンマ区切り、通貨記号の有無)
- [ ] データ粒度 (日次、月次、週次)
- [ ] 集計単位 (確定報酬、未確定報酬、発生報酬など)

### 3. 環境変数の設定

`.env.local` に以下の情報を追加:

```bash
# ASP名 (大文字のスネークケース)
ASP_NAME_USERNAME=your_username
ASP_NAME_PASSWORD=your_password
ASP_NAME_API_KEY=your_api_key  # APIを使用する場合

# Supabase接続情報 (既存)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# その他のID
RERE_MEDIA_ID=your_media_id
AFFILIATE_ACCOUNT_ITEM_ID=your_account_item_id
ASP_NAME_ASP_ID=your_asp_id
```

---

## ディレクトリ構造

新しいASPスクレイパーを実装する際は、以下のディレクトリ構造に従ってください:

```
apps/dashboard/src/scripts/asp/
├── daily/
│   └── {asp-name}/
│       ├── index.ts          # 日次スクレイパーのメインファイル
│       ├── scraper.ts        # スクレイパークラス (オプション)
│       └── types.ts          # 型定義 (オプション)
│
├── monthly/
│   └── {asp-name}/
│       └── index.ts          # 月次スクレイパーのメインファイル
│
└── utils/
    ├── browser-helpers.ts    # ブラウザ操作の共通関数
    ├── date-helpers.ts       # 日付操作の共通関数
    └── supabase-helpers.ts   # Supabase操作の共通関数
```

### ファイル命名規則

- ASP名はケバブケース (例: `a8net`, `value-commerce`, `link-ag`)
- クラス名はパスカルケース (例: `A8NetDailyScraper`, `ValueCommerceDailyScraper`)
- 環境変数はスネークケース (例: `A8NET_USERNAME`, `VALUE_COMMERCE_PASSWORD`)

---

## 実装時の注意事項

### 1. データの分離 (最重要)

**⚠️ 日次データと月次データを絶対に合算しないこと**

- **日次データ**: `daily_actuals` テーブルに保存
- **月次データ**: `actuals` テーブルに保存 (日付は月末)

```typescript
// ❌ 悪い例: 日次と月次を合算して保存
await supabase.from('actuals').insert({
  date: dailyDate,
  amount: dailyAmount + monthlyAmount,  // 合算してはいけない
});

// ✅ 良い例: 日次と月次を別々に保存
await supabase.from('daily_actuals').insert({
  date: dailyDate,
  amount: dailyAmount,
});

await supabase.from('actuals').insert({
  date: monthEndDate,  // 月末日付
  amount: monthlyAmount,
});
```

### 2. 月次データの日付設定

月次データは**該当月の月末日付**で保存すること:

```typescript
// ✅ 正しい実装例
function getMonthEndDate(yearMonth: string): string {
  const year = parseInt(yearMonth.substring(0, 4));
  const month = parseInt(yearMonth.substring(4, 6));

  // 翌月の0日 = 当月の末日
  const lastDay = new Date(year, month, 0);

  return lastDay.toISOString().split('T')[0]; // YYYY-MM-DD
}

// 2025年1月のデータ → 2025-01-31
// 2025年2月のデータ → 2025-02-28 (うるう年なら 2025-02-29)
```

### 3. データの上書き (UPSERT)

同じ日付のデータを再取得した際は、上書き処理を実装すること:

```typescript
// ✅ Supabase での UPSERT 実装例
const { error } = await supabase
  .from('daily_actuals')
  .upsert({
    date: date,
    asp_id: aspId,
    media_id: mediaId,
    account_item_id: accountItemId,
    amount: amount,
  }, {
    onConflict: 'date,asp_id,media_id,account_item_id',  // ユニーク制約
    ignoreDuplicates: false,  // 上書きする
  });
```

### 4. エラーハンドリング

すべての非同期処理に適切なエラーハンドリングを実装:

```typescript
// ✅ 良い例: try-catch でエラーをキャッチ
async function scrapeData() {
  try {
    await page.goto(url, { timeout: 30000 });
    const data = await page.evaluate(() => { /* ... */ });
    return data;
  } catch (error) {
    console.error('データ取得エラー:', error);
    // スクリーンショットを保存
    await page.screenshot({ path: `error-${Date.now()}.png` });
    throw error;  // エラーを再スロー
  } finally {
    await browser.close();  // 必ずブラウザを閉じる
  }
}
```

### 5. ログ出力

処理の進捗を明確にするログを出力:

```typescript
console.log('🚀 スクレイピング開始');
console.log(`📅 期間: ${startDate} 〜 ${endDate}`);
console.log('🔐 ログイン中...');
console.log('✅ ログイン成功');
console.log(`📊 データ取得中: ${yearMonth}`);
console.log(`💾 ${data.length} 件のデータを保存しました`);
console.log('✅ 処理完了');
```

### 6. スクリーンショット (デバッグ用)

エラー発生時やデバッグ時にスクリーンショットを保存:

```typescript
// エラー時
await page.screenshot({
  path: `/screenshots/${aspName}-error-${Date.now()}.png`,
  fullPage: true,
});

// デバッグ時 (ヘッドレスモード時のみ)
if (config.headless) {
  await page.screenshot({
    path: `/screenshots/${aspName}-after-login.png`,
  });
}
```

**注意**: スクリーンショットは `.gitignore` に含まれているため、コミットされません。

### 7. タイムアウト設定

ネットワークの遅延を考慮した適切なタイムアウト設定:

```typescript
// ページ遷移
await page.goto(url, { timeout: 30000 });  // 30秒

// 要素の待機
await page.waitForSelector('.data-table', { timeout: 60000 });  // 60秒

// ネットワークアイドル待機
await page.waitForLoadState('networkidle', { timeout: 30000 });
```

### 8. セレクタの管理

セレクタを定数として管理し、変更に対応しやすくする:

```typescript
// ✅ 良い例: セレクタを定数化
const SELECTORS = {
  LOGIN_ID: '#login-id',
  LOGIN_PASSWORD: '#login-password',
  LOGIN_BUTTON: 'button[type="submit"]',
  DATA_TABLE: '.report-table',
  DATE_COLUMN: 'td:nth-child(1)',
  AMOUNT_COLUMN: 'td:nth-child(3)',
};

await page.fill(SELECTORS.LOGIN_ID, username);
await page.fill(SELECTORS.LOGIN_PASSWORD, password);
await page.click(SELECTORS.LOGIN_BUTTON);
```

### 9. データのバリデーション

取得したデータを保存前にバリデーション:

```typescript
function validateData(data: DailyData[]): boolean {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('⚠️ データが空です');
    return false;
  }

  for (const item of data) {
    // 日付の形式チェック
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      console.error(`❌ 不正な日付形式: ${item.date}`);
      return false;
    }

    // 金額の数値チェック
    if (isNaN(parseFloat(item.amount))) {
      console.error(`❌ 不正な金額: ${item.amount}`);
      return false;
    }
  }

  return true;
}
```

### 10. リトライ処理

ネットワークエラーやタイムアウトに対応するリトライ処理:

```typescript
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 5000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`⚠️ リトライ ${i + 1}/${maxRetries}...`);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('リトライ回数上限に到達しました');
}

// 使用例
const data = await retryOperation(async () => {
  return await page.evaluate(() => {
    // データ取得処理
  });
});
```

---

## データベース設計

### テーブル構造

#### `daily_actuals` テーブル (日次データ)

| カラム名            | 型        | 説明                   |
|---------------------|-----------|------------------------|
| id                  | uuid      | プライマリキー         |
| date                | date      | データの日付           |
| asp_id              | uuid      | ASP ID (外部キー)      |
| media_id            | uuid      | メディアID (外部キー)  |
| account_item_id     | uuid      | 勘定科目ID (外部キー)  |
| amount              | numeric   | 金額                   |
| created_at          | timestamp | 作成日時               |
| updated_at          | timestamp | 更新日時               |

**ユニーク制約**: `(date, asp_id, media_id, account_item_id)`

#### `actuals` テーブル (月次データ)

| カラム名            | 型        | 説明                   |
|---------------------|-----------|------------------------|
| id                  | uuid      | プライマリキー         |
| date                | date      | **月末日付**           |
| asp_id              | uuid      | ASP ID (外部キー)      |
| media_id            | uuid      | メディアID (外部キー)  |
| account_item_id     | uuid      | 勘定科目ID (外部キー)  |
| amount              | numeric   | 月次合計金額           |
| created_at          | timestamp | 作成日時               |
| updated_at          | timestamp | 更新日時               |

**ユニーク制約**: `(date, asp_id, media_id, account_item_id)`

### データ集計関数

#### `get_asp_monthly_data` 関数

月次データの集計に使用。**`actuals` テーブルのみ**を参照:

```sql
-- Migration 016 で修正済み
CREATE OR REPLACE FUNCTION get_asp_monthly_data(p_media_id uuid, p_fiscal_year integer)
RETURNS TABLE (
    item_year integer,
    item_month integer,
    asp_id uuid,
    asp_name text,
    actual numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        EXTRACT(YEAR FROM a.date)::integer AS item_year,
        EXTRACT(MONTH FROM a.date)::integer AS item_month,
        a.asp_id,
        asp.name AS asp_name,
        SUM(a.amount)::numeric AS actual
    FROM actuals a  -- actuals テーブルのみ使用
    INNER JOIN asps asp ON a.asp_id = asp.id
    WHERE (p_media_id IS NULL OR a.media_id = p_media_id)
      AND a.date BETWEEN start_date AND end_date
      AND a.asp_id IS NOT NULL
    GROUP BY
        EXTRACT(YEAR FROM a.date)::integer,
        EXTRACT(MONTH FROM a.date)::integer,
        a.asp_id,
        asp.name
    ORDER BY item_year, item_month, asp_name;
END;
$$;
```

#### `get_asp_daily_data` 関数

日次データの集計に使用。**`daily_actuals` テーブルのみ**を参照:

```sql
CREATE OR REPLACE FUNCTION get_asp_daily_data(p_media_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE (
    date date,
    asp_id uuid,
    asp_name text,
    actual numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        da.date,
        da.asp_id,
        asp.name AS asp_name,
        da.amount AS actual
    FROM daily_actuals da  -- daily_actuals テーブルのみ使用
    INNER JOIN asps asp ON da.asp_id = asp.id
    WHERE (p_media_id IS NULL OR da.media_id = p_media_id)
      AND da.date BETWEEN p_start_date AND p_end_date
      AND da.asp_id IS NOT NULL
    ORDER BY da.date, asp.name;
END;
$$;
```

---

## コーディング規約

### TypeScript

- **型定義**: すべての変数、関数、パラメータに型を明示
- **命名規則**:
  - 変数・関数: キャメルケース (`userName`, `fetchData`)
  - クラス: パスカルケース (`A8NetScraper`)
  - 定数: スネークケース大文字 (`MAX_RETRIES`, `TIMEOUT_MS`)
- **インデント**: スペース2つ
- **文字列**: シングルクォート (`'文字列'`)

### クラス構造

```typescript
export class AspNameDailyScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private credentials: Credentials;
  private config: ScraperConfig;

  constructor(credentials: Credentials, config: ScraperConfig) {
    this.credentials = credentials;
    this.config = config;
  }

  async initialize(): Promise<void> {
    // ブラウザ初期化
  }

  async login(): Promise<void> {
    // ログイン処理
  }

  async navigateToDailyReport(): Promise<void> {
    // レポートページへの遷移
  }

  async extractDailyData(): Promise<DailyData[]> {
    // データ抽出
  }

  async saveToSupabase(data: DailyData[]): Promise<void> {
    // データベース保存
  }

  async close(): Promise<void> {
    // クリーンアップ
  }
}
```

### インターフェース定義

```typescript
interface Credentials {
  username: string;
  password: string;
}

interface ScraperConfig {
  headless?: boolean;
  startYearMonth?: string;
  endYearMonth?: string;
  mediaId: string;
  accountItemId: string;
  aspId: string;
}

interface DailyData {
  date: string;      // YYYY-MM-DD
  amount: string;    // 金額 (文字列)
}

interface MonthlyData {
  yearMonth: string; // YYYYMM
  amount: string;    // 月次合計金額
}
```

---

## エラーハンドリング

### エラーの種類

1. **ログインエラー**: 認証情報が間違っている、アカウントがロックされている
2. **ネットワークエラー**: タイムアウト、接続エラー
3. **データ抽出エラー**: セレクタが見つからない、データ形式が不正
4. **データベースエラー**: Supabase接続エラー、保存エラー

### エラーメッセージのガイドライン

- **明確**: 何が起きたのかを具体的に記述
- **実用的**: どう対処すべきかのヒントを含める
- **一貫性**: 同じ種類のエラーには同じ形式を使用

```typescript
// ✅ 良い例
throw new Error('ログインに失敗しました。ユーザー名とパスワードを確認してください。');
throw new Error('データテーブルが見つかりません。ASPの画面構造が変更された可能性があります。');

// ❌ 悪い例
throw new Error('エラー');
throw new Error('失敗しました');
```

---

## テスト

実装完了後は、[testing.md](./testing.md) に従ってテストを実施してください。

### 最低限のテスト項目

- [ ] 日次データが正しく取得できる
- [ ] 月次データが正しく取得できる
- [ ] データが上書きされる (重複しない)
- [ ] エラー時に適切なメッセージが表示される
- [ ] ヘッドレスモードで動作する

---

## デプロイ

### 本番環境への移行手順

1. **環境変数の設定**
   - 本番環境の `.env.local` に認証情報を追加

2. **テスト実行**
   - ステージング環境で全テストを実施
   - データ整合性を確認

3. **スケジューラー設定**
   - GitHub Actions または cron で定期実行を設定
   - 実行頻度: 日次スクレイパーは毎日、月次スクレイパーは月初

4. **監視設定**
   - エラー通知の設定 (Slack, Email など)
   - ログ監視の設定

### GitHub Actions の設定例

```yaml
name: ASP Daily Scraper

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日0時に実行
  workflow_dispatch:      # 手動実行も可能

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Run scraper
        env:
          ASP_NAME_USERNAME: ${{ secrets.ASP_NAME_USERNAME }}
          ASP_NAME_PASSWORD: ${{ secrets.ASP_NAME_PASSWORD }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: pnpm tsx apps/dashboard/src/scripts/asp/daily/asp-name/index.ts
```

---

## チェックリスト

実装前に以下をすべて確認してください:

- [ ] ASP情報を収集した
- [ ] 環境変数を設定した
- [ ] ディレクトリ構造に従った
- [ ] 日次・月次データを分離した
- [ ] 月末日付を正しく設定した
- [ ] UPSERT処理を実装した
- [ ] エラーハンドリングを実装した
- [ ] ログ出力を実装した
- [ ] タイムアウト設定を適切に設定した
- [ ] データバリデーションを実装した
- [ ] テストを実施した
- [ ] ドキュメントを更新した

---

## 参考資料

- [ASPスクレイパー概要](./scrapers.md)
- [ASPスクレイパー テストチェックリスト](./testing.md)
- [ASP実装ステータス](./status.md)
- [Playwright ドキュメント](https://playwright.dev/)
- [Supabase ドキュメント](https://supabase.com/docs)

---

## よくある質問 (FAQ)

### Q1: APIがあるASPはAPIを使うべきか？

A: はい。APIが提供されている場合は、APIを優先的に使用してください。APIの方が安定しており、ASPのサーバーにも優しいです。

### Q2: 日次データと月次データの違いは？

A: 日次データは毎日の確定報酬、月次データは月全体の合計金額です。日次データは `daily_actuals` テーブル、月次データは `actuals` テーブルに保存します。

### Q3: データが重複してしまう場合は？

A: UPSERT処理を実装し、ユニーク制約が正しく設定されているか確認してください。詳細は Migration 014 を参照。

### Q4: ASPの画面構造が変更された場合は？

A: セレクタを更新し、再度テストを実施してください。変更履歴を ADR (Architecture Decision Record) に記録することを推奨します。

### Q5: スクレイピングがASPの利用規約に違反しないか？

A: 各ASPの利用規約を必ず確認してください。不明な場合は、ASPに直接問い合わせることを推奨します。

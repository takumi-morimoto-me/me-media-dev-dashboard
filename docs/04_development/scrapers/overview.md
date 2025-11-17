# ASP スクレイパー

このプロジェクトでは、各 ASP（アフィリエイトサービスプロバイダ）のデータを自動収集するスクレイパーを実装しています。

## 概要

スクレイパーは Playwright を使用して各 ASP の管理画面にログインし、日次・月次のレポートデータを取得します。取得したデータは Supabase データベースに保存されます。

## ディレクトリ構造

```
apps/dashboard/src/scripts/asp/
├── daily/          # 日次スクレイパー（当日データ取得用）
│   ├── a8net/
│   │   └── index.ts
│   ├── afb/
│   │   └── index.ts
│   └── ... (26 ASPs)
│
├── monthly/        # 月次スクレイパー（過去データ一括取得用）
│   ├── a8net/
│   │   └── index.ts
│   ├── afb/
│   │   └── index.ts
│   └── ... (26 ASPs)
│
└── utils/          # ユーティリティスクリプト
```

各ASPは独自のディレクトリを持ち、`index.ts`にスクレイパーの実装が含まれています。

## 実装済みスクレイパー

### 日次スクレイパー (26 ASPs)

- A8.net
- A8 App
- afb
- アクセストレード
- Amazon Associates
- CASTALK
- CircuitX
- DMM
- docomoアフィリエイト
- felmat
- i-mobile
- JANet
- Link-AG
- LinkShare
- もしもアフィリエイト
- PRESCO
- RatelAD
- Rentracks
- SKYFLAG
- SLVRbullet
- SmaAD
- Smart-C
- TGアフィリエイト
- アルテガアフィリエイト
- ValueCommerce
- Zucks

### 使用例: Link-AG 日次スクレイパー

**ファイル**: `apps/dashboard/src/scripts/asp/daily/linkag/index.ts`

**機能**:
- Link-AG の管理画面にログイン
- 日次の確定報酬データを取得
- 指定した期間（YYYYMM 形式）のデータをスクレイピング

**使用例**:
```typescript
import { LinkAGDailyScraper } from '@/scripts/asp/daily/linkag';

const scraper = new LinkAGDailyScraper(
  {
    username: process.env.LINKAG_USERNAME!,
    password: process.env.LINKAG_PASSWORD!,
  },
  {
    headless: true,
    startYearMonth: '202501',
    endYearMonth: '202502',
    mediaId: 'your-media-id',
    accountItemId: 'your-account-item-id',
    aspId: 'your-asp-id',
  }
);

await scraper.initialize();
await scraper.login();
await scraper.navigateToDailyReport();
const data = await scraper.extractDailyData();
await scraper.saveToSupabase(data);
await scraper.close();
```

**月次一括取得**: `apps/dashboard/src/scripts/asp/monthly/linkag/index.ts`
- 複数月のデータを一括で取得するスクリプト

### 使用例: Felmat 日次スクレイパー

**ファイル**: `apps/dashboard/src/scripts/asp/daily/felmat/index.ts`

**機能**:
- Felmat の管理画面にログイン
- 日次の確定報酬データを取得
- 指定した期間（YYYYMM 形式）のデータをスクレイピング

**使用例**:
```typescript
import { FelmatDailyScraper } from '@/scripts/asp/daily/felmat';

const scraper = new FelmatDailyScraper(
  {
    username: process.env.FELMAT_USERNAME!,
    password: process.env.FELMAT_PASSWORD!,
  },
  {
    headless: true,
    startYearMonth: '202501',
    endYearMonth: '202502',
    mediaId: 'your-media-id',
    accountItemId: 'your-account-item-id',
    aspId: 'your-asp-id',
  }
);

await scraper.initialize();
await scraper.login();
await scraper.navigateToDailyReport();
const data = await scraper.extractDailyData();
await scraper.saveToSupabase(data);
await scraper.close();
```

**月次一括取得**: `apps/dashboard/src/scripts/asp/monthly/felmat/index.ts`
- 複数月のデータを一括で取得するスクリプト

## スクレイパーの構造

すべてのスクレイパーは以下の共通構造を持ちます：

```typescript
interface ScraperConfig {
  headless?: boolean;           // ヘッドレスモードの有効/無効
  startYearMonth?: string;      // 開始年月（YYYYMM）
  endYearMonth?: string;        // 終了年月（YYYYMM）
  mediaId: string;              // メディアID
  accountItemId: string;        // 勘定科目ID
  aspId: string;                // ASP ID
}

interface DailyData {
  date: string;                 // 日付
  confirmedRevenue: string;     // 確定報酬
}
```

### 主要メソッド

- `initialize()`: ブラウザとページの初期化
- `login()`: ASP 管理画面へのログイン
- `scrapeMonth(yearMonth: string)`: 指定月のデータをスクレイピング
- `scrapeAllMonths()`: 設定した期間の全データをスクレイピング
- `saveToDatabase(data: DailyData[])`: データベースへの保存
- `close()`: ブラウザのクリーンアップ

## 環境変数の設定

スクレイパーを実行するには、`.env.local` に以下の環境変数を設定する必要があります：

```bash
# Link-AG
LINKAG_USERNAME=your_username
LINKAG_PASSWORD=your_password

# Felmat
FELMAT_USERNAME=your_username
FELMAT_PASSWORD=your_password

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## スクレイパーの実行

### 開発環境での実行

```bash
# Link-AG の日次データを取得
pnpm tsx apps/dashboard/src/scripts/asp/daily/linkag/index.ts

# Link-AG の月次データを一括取得
pnpm tsx apps/dashboard/src/scripts/asp/monthly/linkag/index.ts

# Felmat の日次データを取得
pnpm tsx apps/dashboard/src/scripts/asp/daily/felmat/index.ts

# Felmat の月次データを一括取得
pnpm tsx apps/dashboard/src/scripts/asp/monthly/felmat/index.ts

# afb の日次データを取得
pnpm tsx apps/dashboard/src/scripts/asp/daily/afb/index.ts

# すべての日次スクレイパーを確認
ls apps/dashboard/src/scripts/asp/daily/
```

### ヘッドレスモードでの実行

本番環境やバックグラウンドでの実行には、ヘッドレスモードを有効にします：

```typescript
const config = {
  headless: true,  // ヘッドレスモードを有効化
  // ... その他の設定
};
```

## トラブルシューティング

### ログインに失敗する場合

1. 環境変数が正しく設定されているか確認
2. ASP の管理画面のログイン画面が変更されていないか確認
3. セレクタが正しいか確認（ASP 側の UI が変更された可能性）

### スクレイピングに失敗する場合

1. ヘッドレスモードを無効にして、ブラウザの動作を確認
2. スクリーンショットを取得してデバッグ
3. ネットワークタイムアウトの設定を調整

```typescript
// タイムアウトの調整例
await page.waitForSelector('selector', { timeout: 60000 });
```

### データが保存されない場合

1. Supabase の接続設定を確認
2. データベースのスキーマが正しいか確認
3. テーブルのアクセス権限を確認

## 新しいスクレイパーの追加

新しい ASP のスクレイパーを追加する場合は、以下の手順に従ってください：

1. 既存のスクレイパー（例: `linkag-daily-scraper.ts`）をテンプレートとしてコピー
2. ASP 固有のログイン処理を実装
3. データ取得ロジックを実装
4. データベース保存ロジックを実装
5. 環境変数を `.env.local` に追加
6. このドキュメントを更新

### 実装チェックリスト

- [ ] ログイン処理の実装
- [ ] データスクレイピングロジックの実装
- [ ] エラーハンドリングの実装
- [ ] スクリーンショット取得機能の追加（デバッグ用）
- [ ] データベース保存ロジックの実装
- [ ] 環境変数の設定
- [ ] ドキュメントの更新
- [ ] テスト実行と動作確認

## ベストプラクティス

1. **エラーハンドリング**: すべての非同期処理に適切なエラーハンドリングを実装
2. **タイムアウト設定**: ネットワークの遅延を考慮したタイムアウト設定
3. **スクリーンショット**: デバッグ用にスクリーンショットを保存
4. **ログ出力**: 処理の進捗を明確にするためのログ出力
5. **クリーンアップ**: ブラウザリソースの適切なクリーンアップ

## 注意事項

- スクレイパーは ASP の利用規約を遵守して使用してください
- 過度なリクエストは ASP のサーバーに負荷をかける可能性があるため、適切な間隔を設けてください
- 本番環境では、ヘッドレスモードを使用し、不要なリソース消費を避けてください
- 認証情報は環境変数で管理し、コードにハードコードしないでください

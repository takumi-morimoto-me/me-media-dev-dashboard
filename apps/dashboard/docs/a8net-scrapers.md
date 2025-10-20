# A8.net スクレイパー一覧

このドキュメントでは、A8.netから実績データを取得するためのスクリプトをまとめています。

## 📁 スクリプトの場所

すべてのスクリプトは `src/scripts/` ディレクトリにあります。

## 🔧 スクリプト一覧

### 1. 月次データ取得: `a8net-monthly-scraper.ts`

**用途**: 月別の確定報酬額を取得し、`actuals`テーブルに保存

**実行コマンド**:
```bash
pnpm scrape:a8net:monthly
```

**取得データ**:
- 2025年1月〜10月の月次確定報酬額
- 各月の最終日の日付で保存（例: 2025-01-31, 2025-02-28）
- 保存先: `actuals`テーブル

**データ例**:
- 2025/01: 341,456円 (2025-01-31)
- 2025/02: 211,009円 (2025-02-28)
- 2025/03: 204,854円 (2025-03-31)

### 2. 日次データ取得: `a8net-daily-scraper.ts`

**用途**: 日別の確定報酬額を取得し、`daily_actuals`テーブルに保存

**実行コマンド**:
```bash
# 当月のデータを取得
pnpm scrape:a8net:daily:new

# 特定の月のデータを取得（例: 9月）
pnpm scrape:a8net:daily:new -- --month=9
```

**取得データ**:
- 日別の確定報酬額
- 保存先: `daily_actuals`テーブル

**データ例**:
- 2025-10-17: 1,861円
- 2025-10-14: 11,032円
- 2025-10-09: 1,719円

### 3. 一括取得: `scrape-all-months.ts`

**用途**: 1月〜8月の日次データを一括取得

**実行コマンド**:
```bash
pnpm scrape:a8net:daily:all
```

**処理内容**:
- 2025年1月〜8月の各月の日次データを順次取得
- 各月の処理後、3秒待機してから次の月を処理
- 保存先: `daily_actuals`テーブル

**取得結果**:
- 1月: 31件
- 2月: 28件
- 3月: 31件
- 4月: 30件
- 5月: 31件
- 6月: 30件
- 7月: 31件
- 8月: 31件

### 4. レガシー: `a8net-scraper-v2.ts`

**用途**: 日次データ取得（旧バージョン）

**実行コマンド**:
```bash
# 当日のデータを取得
pnpm scrape:a8net:daily

# 過去のデータを取得（月を指定）
pnpm scrape:a8net:historical -- --month=9
```

⚠️ **非推奨**: `a8net-daily-scraper.ts`を使用してください

## 📊 補助スクリプト

### データインポート: `import-september-data.ts`

**用途**: 既存のMarkdownファイルから9月のデータをインポート

**実行コマンド**:
```bash
pnpm exec tsx src/scripts/import-september-data.ts
```

### データ確認スクリプト

#### `check-actuals.ts`
月次実績データ（actualsテーブル）を確認
```bash
pnpm exec tsx src/scripts/check-actuals.ts
```

#### `check-daily-actuals.ts`
日次実績データ（daily_actualsテーブル）を確認
```bash
pnpm db:check-actuals
```

#### `check-db-data.ts`
メディア、ASP、勘定科目のデータを確認
```bash
pnpm db:check
```

#### `test-monthly-function.ts`
月次データ取得関数のテスト
```bash
pnpm exec tsx src/scripts/test-monthly-function.ts
```

## 🗄️ データベーステーブル

### `actuals`テーブル（月次データ）
- `date`: 月の最終日（例: 2025-01-31）
- `amount`: 確定報酬額
- `media_id`: メディアID（ReRe）
- `account_item_id`: 勘定科目ID（アフィリエイト）
- `asp_id`: ASP ID（A8net）

### `daily_actuals`テーブル（日次データ）
- `date`: 日付（例: 2025-10-17）
- `amount`: 確定報酬額
- `media_id`: メディアID（ReRe）
- `account_item_id`: 勘定科目ID（アフィリエイト）
- `asp_id`: ASP ID（A8net）

## 🔑 環境変数

`.env.local`に以下を設定してください：

```env
A8NET_USERNAME=takakuureru
A8NET_PASSWORD=Hu8nE23xdpf7
RERE_MEDIA_ID=4d3d6a03-3cf2-41b9-a23c-4b2d75bafa12
AFFILIATE_ACCOUNT_ITEM_ID=a6df5fab-2df4-4263-a888-ab63348cccd5
A8NET_ASP_ID=a51cdc80-0924-4d03-a764-81dd77cda4f7
```

## 📸 スクリーンショット

スクレイパー実行時のスクリーンショットは `screenshots/` ディレクトリに保存されます。

## 🎯 使用例

### 初回セットアップ時

1. 月次データを取得
```bash
pnpm scrape:a8net:monthly
```

2. 日次データを一括取得（1-8月）
```bash
pnpm scrape:a8net:daily:all
```

3. 9月のデータを取得
```bash
pnpm scrape:a8net:daily:new -- --month=9
```

4. 10月のデータを取得
```bash
pnpm scrape:a8net:daily:new
```

### 日次運用

毎日実行する場合（当日のデータを取得）:
```bash
pnpm scrape:a8net:daily:new
```

### 月次運用

月末に実行する場合（当月の月次データを取得）:
```bash
pnpm scrape:a8net:monthly
```

## ⚠️ 注意事項

1. **headlessモード**: すべてのスクリプトは本番環境で`headless: true`で動作します
2. **タイムアウト**: ネットワークが不安定な場合、タイムアウトエラーが発生する可能性があります
3. **重複防止**: Upsert処理により、同じデータは上書きされます
4. **月の選択**: 日次データは直近の月のみ選択可能（A8.netの制限による）

## 🔄 データフロー

```
A8.net
  ↓
スクレイパー
  ↓
Supabase
  ├─ actuals (月次)
  └─ daily_actuals (日次)
  ↓
ダッシュボード
```

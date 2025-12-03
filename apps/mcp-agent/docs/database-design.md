# Database Design Decisions

## テーブル設計

### 日次データと月次データの分離

**設計決定:** 日次データと月次データは別々のテーブルで管理する

**理由:**
- データの取得方法が異なる（日次は日別、月次は月単位で集計）
- クエリの最適化が容易
- データの性質が異なる（日次は詳細、月次はサマリー）

**テーブル構造:**

#### daily_actuals
- **用途:** 日次データ専用
- **データ:** ASPから日別に取得した確定報酬データ
- **date形式:** 具体的な日付（例: 2025-11-24）

```sql
CREATE TABLE daily_actuals (
  id UUID PRIMARY KEY,
  date DATE NOT NULL,
  amount INTEGER NOT NULL,
  media_id UUID NOT NULL,
  account_item_id UUID NOT NULL,
  asp_id UUID NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(date, media_id, account_item_id, asp_id)
);
```

#### actuals
- **用途:** 月次データ専用
- **データ:** ASPから月単位で取得した確定報酬合計データ
- **date形式:** 月末日（例: 2025-11-30）

```sql
CREATE TABLE actuals (
  id UUID PRIMARY KEY,
  date DATE NOT NULL,
  amount INTEGER NOT NULL,
  media_id UUID NOT NULL,
  account_item_id UUID NOT NULL,
  asp_id UUID NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(date, media_id, account_item_id, asp_id)
);
```

## コード実装

### データ保存

- **日次データ:** `SupabaseClient.save_daily_actual()` → `daily_actuals`テーブル
- **月次データ:** `SupabaseClient.save_actual()` または `save_monthly_actual()` → `actuals`テーブル

### スクレイパーでの指定

各スクレイパー（`scrapers/*/scraper.py`）内で保存先テーブルを指定:
- 日次データ: `save_data(target='daily')`
- 月次データ: `save_data(target='monthly')`

## 履歴

- 2025-12-03: シナリオ方式からスクレイパー方式に移行
- 2025-11-25: 初回設計決定 - 日次・月次データの分離

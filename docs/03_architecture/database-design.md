# DB設計書：メディアDevダッシュボード

本文書は、「メディアDevダッシュボード」プロジェクトのデータベース構造を定義するものである。
データベースにはSupabase (PostgreSQL) を使用する。

---

## 1. `media`
管理対象のメディア情報を格納するマスターテーブル。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PRIMARY KEY** | メディアの一意識別子 |
| `name` | `text` | NOT NULL | メディア名 (例: 「メディアA」) |
| `slug` | `text` | NOT NULL, UNIQUE | URL用のスラッグ (例: 「media-a」) |
| `created_at` | `timestamptz` | NOT NULL | 作成日時 |

---

## 2. `account_items`
勘定項目を管理するマスターテーブル。`parent_id`を用いた自己参照構造により、柔軟な階層管理を可能にする。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PRIMARY KEY** | 勘定項目の一意識別子 |
| `name` | `text` | NOT NULL | 項目名 (例: 「広告収入」「人件費」) |
| `parent_id`| `uuid` | FOREIGN KEY (`account_items.id`) | 親項目のID。大項目は`NULL`。 |
| `media_id` | `uuid` | NOT NULL, FOREIGN KEY (`media.id`) | 紐づくメディアのID |
| `display_order` | `integer` | | 表示順を制御するための数値 |
| `created_at` | `timestamptz`| NOT NULL | 作成日時 |

---

## 3. `asps`
ASP（アフィリエイト・サービス・プロバイダ）の情報を管理するマスターテーブル。AIエージェントが実績データを自動収集するための設定を保持する。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PRIMARY KEY** | ASPの一意識別子 |
| `name` | `text` | NOT NULL | ASP名 (例: 「A8.net」「もしもアフィリエイト」) |
| `login_url` | `text` | NOT NULL | ASPのログインページURL |
| `media_id` | `uuid` | NOT NULL, FOREIGN KEY (`media.id`) | 紐づくメディアのID |
| `prompt` | `text` | NOT NULL | AIエージェントへの操作指示（自然言語） |
| `created_at` | `timestamptz` | NOT NULL | 作成日時 |
| `updated_at` | `timestamptz` | NOT NULL | 更新日時 |

*補足: `(name, media_id)` の組み合わせで `UNIQUE` 制約あり。同じメディア内で同名ASPを防ぐ。*

---

## 4. `users`
アプリケーションのユーザー情報を管理するテーブル。Supabaseの`auth.users`テーブルと1対1で連携する。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PRIMARY KEY**, FOREIGN KEY (`auth.users.id`) | ユーザーの一意識別子 |
| `email` | `text` | NOT NULL, UNIQUE | メールアドレス |
| `role` | `text` | NOT NULL | 役割 (例: `admin`, `editor`, `viewer`) |
| `updated_at`| `timestamptz`| NOT NULL | 更新日時 |

---

## 5. `user_media_assignments`
ユーザーとメディアの担当関係（多対多）を管理する中間テーブル。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `user_id`| `uuid` | **PRIMARY KEY**, FOREIGN KEY (`users.id`) | ユーザーのID |
| `media_id`| `uuid` | **PRIMARY KEY**, FOREIGN KEY (`media.id`) | メディアのID |

---

## 6. `budgets`
月次予算データを格納するテーブル。月初の日付（例: `2025-06-01`）でその月の予算額を保存。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PRIMARY KEY** | 予算データの一意識別子 |
| `date` | `date` | NOT NULL | 月初の日付 (例: `2025-06-01`) |
| `amount` | `integer` | NOT NULL | 月次予算額 |
| `media_id` | `uuid` | NOT NULL, FOREIGN KEY (`media.id`) | 紐づくメディアのID |
| `account_item_id` | `uuid` | NOT NULL, FOREIGN KEY (`account_items.id`) | 紐づく勘定項目のID |
| `created_at` | `timestamptz`| NOT NULL | 作成日時 |
| `updated_at` | `timestamptz`| NOT NULL | 更新日時 |

*補足: `(date, media_id, account_item_id)` の組み合わせで `UNIQUE` 制約あり。*

---

## 7. `actuals`
月次実績データを格納するテーブル。月初の日付（例: `2025-06-01`）でその月の実績額を保存。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PRIMARY KEY** | 実績データの一意識別子 |
| `date` | `date` | NOT NULL | 月初の日付 (例: `2025-06-01`) |
| `amount` | `integer` | NOT NULL | 月次実績額 |
| `media_id` | `uuid` | NOT NULL, FOREIGN KEY (`media.id`) | 紐づくメディアのID |
| `account_item_id` | `uuid` | NOT NULL, FOREIGN KEY (`account_items.id`) | 紐づく勘定項目のID |
| `asp_id` | `uuid` | FOREIGN KEY (`asps.id`) | 紐づくASPのID。ASP経由でない場合は`NULL`。|
| `created_at` | `timestamptz`| NOT NULL | 作成日時 |

*補足: `(date, media_id, account_item_id, asp_id)` の組み合わせで `UNIQUE` 制約あり（部分インデックス: `asp_id IS NULL`）。*

---

## 8. `daily_budgets`
日次予算データを格納するテーブル。月次データから自動展開される。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PRIMARY KEY** | 日次予算データの一意識別子 |
| `date` | `date` | NOT NULL | 日付 (例: `2025-06-01`) |
| `amount` | `integer` | NOT NULL | 日次予算額（月次予算÷日数） |
| `media_id` | `uuid` | NOT NULL, FOREIGN KEY (`media.id`) | 紐づくメディアのID |
| `account_item_id` | `uuid` | NOT NULL, FOREIGN KEY (`account_items.id`) | 紐づく勘定項目のID |
| `created_at` | `timestamptz`| NOT NULL | 作成日時 |
| `updated_at` | `timestamptz`| NOT NULL | 更新日時 |

*補足: `(date, media_id, account_item_id)` の組み合わせで `UNIQUE` 制約あり。*

---

## 9. `daily_actuals`
日次実績データを格納するテーブル。月次データから自動展開される。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PRIMARY KEY** | 日次実績データの一意識別子 |
| `date` | `date` | NOT NULL | 日付 (例: `2025-06-01`) |
| `amount` | `integer` | NOT NULL | 日次実績額（月次実績÷日数） |
| `media_id` | `uuid` | NOT NULL, FOREIGN KEY (`media.id`) | 紐づくメディアのID |
| `account_item_id` | `uuid` | NOT NULL, FOREIGN KEY (`account_items.id`) | 紐づく勘定項目のID |
| `asp_id` | `uuid` | FOREIGN KEY (`asps.id`) | 紐づくASPのID。ASP経由でない場合は`NULL`。|
| `created_at` | `timestamptz`| NOT NULL | 作成日時 |
| `updated_at` | `timestamptz`| NOT NULL | 更新日時 |

*補足: `(date, media_id, account_item_id, asp_id)` の組み合わせで `UNIQUE` 制約あり。*

---

## 10. `app_settings`
アプリケーション全体の設定を管理するテーブル。

| カラム名 | データ型 | 制約 | 説明 |
| :--- | :--- | :--- | :--- |
| `key` | `text` | **PRIMARY KEY** | 設定のキー |
| `value` | `text` | NOT NULL | 設定値 |
| `description` | `text` | | 設定の説明 |

**初期値:**
- `fiscal_year_start_month`: `'6'` (会計年度開始月: 6月)

---

## 11. RPC Functions（Supabase関数）

### 11.1. `get_financial_monthly_data(p_media_id uuid, p_fiscal_year integer)`

**月次表示用**のRPC関数。`budgets`/`actuals`テーブルから直接月次データを取得。

**パラメータ:**
- `p_media_id`: 対象メディアのID。`NULL`の場合は全メディアを集約
- `p_fiscal_year`: 会計年度（例: 2025）

**戻り値:**
```sql
TABLE (
    item_year integer,
    item_month integer,
    account_item_id uuid,
    budget numeric,
    actual numeric
)
```

**特徴:**
- TSV/CSVでアップロードした月次データをそのまま返す
- 端数ロスなし（日次展開による整数除算の影響を受けない）
- 月次表示で使用

**マイグレーション:** `008_create_monthly_data_function.sql`

---

### 11.2. `get_financial_daily_data(p_media_id uuid, p_fiscal_year integer)`

**日次・週次表示用**のRPC関数。`daily_budgets`/`daily_actuals`テーブルから日次データを取得。

**パラメータ:**
- `p_media_id`: 対象メディアのID。`NULL`の場合は全メディアを集約
- `p_fiscal_year`: 会計年度（例: 2025）

**戻り値:**
```sql
TABLE (
    item_date date,
    account_item_id uuid,
    budget numeric,
    actual numeric
)
```

**特徴:**
- 会計年度の全日分のデータを返す
- 日次・週次表示で使用
- フロントエンド側で週次集計を実行

**マイグレーション:** `005_create_daily_data_function.sql`

---

### 11.3. `import_financial_data(p_media_id uuid, p_items jsonb)`

TSV/CSVから月次データをインポートし、日次テーブルに自動展開する関数。

**パラメータ:**
- `p_media_id`: 対象メディアのID
- `p_items`: インポートするデータのJSON配列

**処理内容:**
1. 親・子勘定項目のupsert
2. 月次データを`budgets`/`actuals`に保存
3. 月次データを日次に展開して`daily_budgets`/`daily_actuals`に保存
   - 月次予算額 ÷ 日数 = 日次予算額（整数）
   - 各日に均等分配

**マイグレーション:** `006_update_import_function_for_daily.sql`

---

## 12. Database Triggers

### 12.1. メディア作成時の勘定項目自動作成

**トリガー名:** `create_default_account_items_trigger`
**発火タイミング:** `media` テーブルへのINSERT後
**処理内容:**
- 「売上」（display_order: 1）
- 「費用」（display_order: 2）

の2つの親項目を自動作成

**マイグレーション:** `003_auto_create_account_items.sql`

---

## 13. Row Level Security (RLS)

**現在の状態:** 全テーブルでRLS無効（開発フェーズ）

**マイグレーション:** `007_disable_all_rls.sql`

**本番環境での対応が必要:**
- Supabase Authenticationの実装
- RLSポリシーの設計・実装
- ロール別のアクセス制御

---

## 14. マイグレーション一覧

1. `001_initial_schema.sql` - 初期スキーマ（全テーブル定義）
2. `002_seed_test_data.sql` - テストデータ投入
3. `003_auto_create_account_items.sql` - メディア作成時の勘定項目自動作成トリガー
4. `004_create_daily_tables.sql` - 日次テーブル（daily_budgets, daily_actuals）作成
5. `005_create_daily_data_function.sql` - 日次データ取得RPC関数
6. `006_update_import_function_for_daily.sql` - 日次対応インポート関数
7. `007_disable_all_rls.sql` - 全RLS無効化（開発環境）
8. `008_create_monthly_data_function.sql` - 月次データ取得RPC関数

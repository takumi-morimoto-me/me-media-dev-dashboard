# Database Package

このパッケージは、プロジェクトのデータベーススキーマとマイグレーションを管理します。

## ディレクトリ構造

```
packages/db/
├── README.md
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_seed_test_data.sql
    ├── 003_auto_create_account_items.sql
    ├── 004_create_daily_tables.sql
    ├── 005_create_daily_data_function.sql
    ├── 006_update_import_function_for_daily.sql
    ├── 007_disable_all_rls.sql
    ├── 008_create_monthly_data_function.sql
    ├── 009_create_asp_monthly_data_function.sql
    ├── 010_create_asp_daily_data_function.sql
    ├── 011_add_login_url_and_prompt_to_asps.sql
    └── 012_add_media_id_to_asps.sql
```

## マイグレーション管理

### 命名規則

マイグレーションファイルは以下の命名規則に従います：

```
{番号}_{説明}.sql
```

- **番号**: 3桁のゼロ埋め番号（001, 002, ...）
- **説明**: スネークケースでマイグレーションの内容を簡潔に説明

例: `012_add_media_id_to_asps.sql`

### マイグレーションの実行方法

#### Supabase SQL エディタを使用する場合

1. Supabase ダッシュボードにログイン
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を開く
4. マイグレーションファイルの内容をコピー＆ペースト
5. 「Run」ボタンをクリック

#### Supabase CLI を使用する場合（推奨）

```bash
# ローカル環境で実行
supabase db reset

# 本番環境にプッシュ
supabase db push
```

### 新しいマイグレーションを作成する

1. 次の番号を確認する（現在は 013 から開始）
2. 命名規則に従ってファイルを作成
3. SQL を記述
4. テスト環境で実行して確認
5. 本番環境に適用

```bash
# 新しいマイグレーションファイルを作成
touch packages/db/migrations/013_your_migration_name.sql
```

## 環境別の考慮事項

### 開発環境専用のマイグレーション

以下のマイグレーションは開発環境でのみ使用することを推奨します：

- **002_seed_test_data.sql**: テストデータの挿入
- **007_disable_all_rls.sql**: RLS（Row Level Security）の無効化

### 本番環境への適用

本番環境にマイグレーションを適用する前に：

1. ステージング環境でテストする
2. バックアップを取得する
3. ダウンタイムが発生する可能性がある場合は、メンテナンス時間を設定する
4. ロールバック計画を準備する

## マイグレーション一覧

| 番号 | ファイル名 | 説明 |
|------|-----------|------|
| 001 | initial_schema.sql | 初期スキーマの作成 |
| 002 | seed_test_data.sql | テストデータの挿入（開発環境のみ） |
| 003 | auto_create_account_items.sql | 勘定科目の自動作成機能 |
| 004 | create_daily_tables.sql | 日次データテーブルの作成 |
| 005 | create_daily_data_function.sql | 日次データ取得関数の作成 |
| 006 | update_import_function_for_daily.sql | 日次データインポート関数の更新 |
| 007 | disable_all_rls.sql | RLS の無効化（開発環境のみ） |
| 008 | create_monthly_data_function.sql | 月次データ取得関数の作成 |
| 009 | create_asp_monthly_data_function.sql | ASP 月次データ取得関数の作成 |
| 010 | create_asp_daily_data_function.sql | ASP 日次データ取得関数の作成 |
| 011 | add_login_url_and_prompt_to_asps.sql | ASP テーブルに login_url と prompt カラムを追加 |
| 012 | add_media_id_to_asps.sql | ASP テーブルに media_id カラムを追加 |

## トラブルシューティング

### マイグレーションが失敗した場合

1. エラーメッセージを確認
2. データの整合性をチェック
3. 必要に応じてロールバック
4. 修正後に再実行

### ロールバック方法

マイグレーションのロールバックが必要な場合は、手動で逆の操作を行う SQL を作成して実行します。

```sql
-- 例: カラムを追加した場合のロールバック
ALTER TABLE table_name DROP COLUMN column_name;
```

## 注意事項

- マイグレーションは**順序が重要**です。番号順に実行してください
- 本番環境での実行前に必ずバックアップを取得してください
- 大きなテーブルの変更は、ダウンタイムを考慮してください
- RLS を無効化するマイグレーション（007）は、本番環境では実行しないでください

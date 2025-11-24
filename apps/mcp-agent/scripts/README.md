# Scripts

このディレクトリには、開発・セットアップ用のユーティリティスクリプトが含まれています。

## ファイル一覧

### データベース・マイグレーション関連

- **`apply_migrations.py`**
  - マイグレーションファイルの適用を試みるスクリプト
  - Supabaseへのマイグレーション適用をサポート
  - 使用方法: `python scripts/apply_migrations.py`

- **`create_execution_logs.py`**
  - `execution_logs` テーブルの存在確認スクリプト
  - テーブルが存在しない場合は警告を表示
  - 使用方法: `python scripts/create_execution_logs.py`

### ASPシード・シナリオ関連

- **`seed_a8net.py`**
  - A8.net ASPの初期データをデータベースに登録
  - ログインURLと基本的なシナリオを設定
  - 使用方法: `python scripts/seed_a8net.py`

- **`update_a8net_scenario.py`**
  - A8.netのシナリオを改善版に更新
  - スクロール機能や月次データ抽出を追加
  - 使用方法: `python scripts/update_a8net_scenario.py`

## 前提条件

これらのスクリプトを実行する前に、以下を設定してください：

1. `.env` ファイルに以下の環境変数を設定
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. 必要な依存パッケージをインストール
   ```bash
   pip install -r requirements.txt
   ```

## 注意事項

- これらのスクリプトは主に開発・デバッグ用です
- 本番環境での実行前に必ず内容を確認してください
- マイグレーションは Supabase Dashboard の SQL Editor で実行することを推奨します

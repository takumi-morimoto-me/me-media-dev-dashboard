# Runners

このディレクトリには、エージェントを実行するためのランナースクリプトが含まれています。

## ファイル一覧

### `run_local.py`
ローカル開発用のランナー

**用途**: 開発・デバッグ時に特定のASPをテストする

**特徴**:
- デフォルトでブラウザを表示（`--no-headless`）
- 特定のASPのみを実行可能（`--asp`オプション）
- スクリーンショットを保存

**使用方法**:
```bash
# 全ASPを実行（ブラウザ表示）
python runners/run_local.py

# 特定のASPを実行
python runners/run_local.py --asp "A8.net"

# ヘッドレスモードで実行
python runners/run_local.py --headless
```

### `scheduled_runner.py`
スケジュール実行用のランナー

**用途**: 本番環境での定期実行（GitHub Actions、Cron等）

**特徴**:
- デフォルトでヘッドレスモード
- 全ASPを順次実行
- Slack通知機能
- 実行ログの記録（`execution_logs`テーブル）

**使用方法**:
```bash
# 日次データ取得を実行
python runners/scheduled_runner.py

# 月次データ取得を実行
python runners/scheduled_runner.py --monthly
```

**スケジュール設定の推奨**:
- 日次実行: 毎日 9:00 AM JST
- 月次実行: 毎月1日 10:00 AM JST

## エントリーポイントの使い分け

| ファイル | 用途 | 実行環境 | ブラウザ表示 |
|---------|------|---------|------------|
| `main.py` (ルート) | MCPサーバー | Docker / 本番 | ヘッドレス |
| `runners/run_local.py` | 開発・デバッグ | ローカル | 表示 |
| `runners/scheduled_runner.py` | 定期実行 | GitHub Actions | ヘッドレス |

## 前提条件

実行前に以下を設定してください：

1. `.env` ファイルに環境変数を設定
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `SLACK_WEBHOOK_URL` (scheduled_runner.pyのみ)
   - ASPの認証情報 (`A8NET_USERNAME`, `A8NET_PASSWORD`等)

2. 依存パッケージをインストール
   ```bash
   pip install -r requirements.txt
   playwright install chromium
   ```

## トラブルシューティング

### ブラウザが起動しない
```bash
playwright install chromium
playwright install-deps chromium
```

### 認証エラー
- `.env`ファイルでASPの認証情報を確認
- Supabaseの`credentials`テーブルで認証情報を確認

### データが保存されない
- `daily_actuals` / `monthly_actuals` テーブルの権限を確認
- RLSポリシーがservice roleキーでアクセス可能か確認

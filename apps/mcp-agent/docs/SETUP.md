# MCP Agent - ローカル実行セットアップガイド

このガイドでは、MCP AgentをローカルマシンでPythonを使って実行する方法を説明します。

## 前提条件

- Python 3.11以上
- pip (Pythonパッケージマネージャー)
- Google Gemini API Key

## セットアップ手順

### 1. Python環境の確認

```bash
# Pythonバージョンを確認
python3 --version
# または
python --version

# 3.11以上であることを確認してください
```

### 2. 依存関係のインストール

```bash
cd apps/mcp-agent

# 依存関係をインストール
pip install -r requirements.txt

# Playwrightブラウザをインストール
playwright install chromium
```

### 3. 環境変数の設定

`.env`ファイルを作成：

```bash
cp .env.example .env
```

`.env`を編集して必要な情報を設定：

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini API
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# ASP Credentials
A8NET_USERNAME=your_a8net_username
A8NET_PASSWORD=your_a8net_password

# Logging
LOG_LEVEL=INFO

# Execution Mode
HEADLESS=true
```

### 4. Google Gemini API Keyの取得

1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. 「Get API Key」をクリック
3. APIキーを作成
4. `.env`の`GOOGLE_API_KEY`に設定

### 5. 動作確認

```bash
# エージェントを実行
python main.py
```

## トラブルシューティング

### Playwrightがブラウザを起動できない

```bash
# ブラウザを再インストール
playwright install chromium
```

### 環境変数が読み込まれない

- `.env`ファイルが`apps/mcp-agent/`ディレクトリに存在するか確認
- ファイル名が`.env`（先頭にドット）であることを確認

### Gemini APIエラー

- APIキーが正しいか確認
- APIキーに課金設定がされているか確認（無料枠でも使えますが、設定が必要な場合があります）

## ローカル開発のメリット

- ✅ GCP不要（シンプル）
- ✅ すぐに試せる
- ✅ デバッグしやすい
- ✅ コスト削減（ローカルで完結）

## 次のステップ

1. シナリオの作成
   - Supabaseの`asps`テーブルで、シナリオを記述
2. テスト実行
   - 1つのASPで動作確認
3. 本格運用
   - 全ASPのシナリオを作成

---

最終更新: 2025-11-07

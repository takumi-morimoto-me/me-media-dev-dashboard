# MCP Agent - クイックスタートガイド

このガイドに従って、MCP Agentをローカル環境で動作させることができます。

---

## 前提条件

- Python 3.11 以上
- Google Gemini API Key ([取得方法](https://makersuite.google.com/app/apikey))
- Supabase プロジェクト

---

## セットアップ手順（5分）

### 1. ディレクトリに移動

```bash
cd apps/mcp-agent
```

### 2. 依存関係をインストール

```bash
pip install -r requirements.txt
playwright install chromium
```

### 3. 環境変数を設定

`.env` ファイルを作成：

```bash
cp .env.example .env
```

`.env` を編集して以下を設定：

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini API
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# ASP認証情報
A8NET_USERNAME=your_username
A8NET_PASSWORD=your_password

# その他
LOG_LEVEL=INFO
HEADLESS=false  # デバッグ時は false に設定すると便利
```

### 4. Supabaseにシナリオを登録

Supabaseの `asps` テーブルに A8.net のシナリオを登録します。

SQL Editor で以下を実行：

```sql
-- A8.net のシナリオを登録
UPDATE asps
SET prompt = '1. A8.netのログインページ (https://www.a8.net/) にアクセス
2. ユーザー名フィールド (input[name="login"]) に {SECRET:A8NET_USERNAME} を入力
3. パスワードフィールド (input[name="passwd"]) に {SECRET:A8NET_PASSWORD} を入力
4. ログインボタン (input[name="login_as_btn"]) をクリック
5. 待機 (3000ms)
6. 「レポート」メニューをクリック
7. 待機 (2000ms)
8. 「成果報酬」メニューをクリック
9. 待機 (3000ms)
10. 「日別」タブをクリック
11. 待機 (3000ms)
12. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存'
WHERE name = 'A8.net';
```

**重要**: `media_id`, `account_item_id` が正しく設定されているか確認：

```sql
-- A8.net の設定を確認
SELECT id, name, media_id, account_item_id
FROM asps
WHERE name = 'A8.net';
```

### 5. 実行

```bash
python main.py
```

---

## 動作確認

実行すると以下のログが表示されます：

```
============================================================
MCP Agent - AI-Powered ASP Data Collection
============================================================
2025-11-10 10:00:00 - INFO - Settings loaded and validated successfully
2025-11-10 10:00:00 - INFO - Initializing clients...
2025-11-10 10:00:01 - INFO - Gemini client initialized with model: gemini-1.5-flash
2025-11-10 10:00:01 - INFO - Supabase client initialized
2025-11-10 10:00:01 - INFO - Starting autonomous scraping process...
============================================================
Processing ASP: A8.net
============================================================
2025-11-10 10:00:02 - INFO - Retrieved scenario for ASP: A8.net
2025-11-10 10:00:02 - INFO - Parsed 12 steps from scenario
2025-11-10 10:00:03 - INFO - Starting browser...
2025-11-10 10:00:05 - INFO - Step 1/12: A8.netのログインページ (https://www.a8.net/) にアクセス
...
```

---

## トラブルシューティング

### Playwrightエラー

```bash
# ブラウザを再インストール
playwright install chromium
playwright install-deps chromium
```

### Gemini APIエラー

- APIキーが正しいか確認
- [Google AI Studio](https://makersuite.google.com/app/apikey) でAPIキーを再確認
- 無料枠の上限に達していないか確認

### Supabaseエラー

- URLとService Role Keyが正しいか確認
- `asps` テーブルに `prompt` が登録されているか確認
- `media_id`, `account_item_id` が設定されているか確認

---

## デバッグモード

ブラウザの動作を確認したい場合は、`.env` で以下を設定：

```bash
HEADLESS=false
```

これにより、ブラウザが表示され、実際の操作を目視で確認できます。

---

## スクリーンショット

各ステップのスクリーンショットは `screenshots/` ディレクトリに保存されます。

```bash
ls screenshots/
# step_1_A8.net.png
# step_2_A8.net.png
# ...
```

---

## 次のステップ

1. **A8.netで動作確認** → このガイドの手順を実行
2. **もしもアフィリエイトのシナリオ作成** → `scenarios/` ディレクトリに追加
3. **Link-AGのシナリオ作成** → 同様に追加
4. **PoC検証** → 3つのASPで成功率を確認

---

**作成日**: 2025-11-10

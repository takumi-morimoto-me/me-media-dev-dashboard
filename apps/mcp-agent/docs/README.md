# MCP Agent - AI-Powered ASP Data Collection Agent

AIエージェント（Vertex AI Gemini）を使った自律的なASPデータ収集システムです。

## 概要

このエージェントは、**自然言語で記述されたシナリオ（プロンプト）**に基づいて、自律的にブラウザを操作し、各種ASPから実績データを収集します。

### 設計思想

> 「非エンジニアが自然言語のシナリオを編集するだけで、AIエージェントが自律的にブラウザを操作してデータを取得する」

### 主な特徴

- ✅ **保守性が高い**: ASPの仕様変更時、コード修正不要（プロンプト修正のみ）
- ✅ **柔軟性**: AIが状況判断して柔軟に対応
- ✅ **拡張性**: 新規ASP追加が容易（シナリオを書くだけ）
- ✅ **非エンジニア対応**: 自然言語でシナリオを記述

## 技術スタック

- **Python 3.11+**
- **Playwright**: ブラウザ自動操作
- **Google Gemini API**: 自然言語シナリオの解釈と推論
- **Supabase**: データベース（シナリオ保存・データ格納）
- **ローカル実行**: シンプルでGCP不要

## アーキテクチャ

```
┌─────────────────┐
│   Dashboard     │ ← ユーザーがシナリオを編集
│   (Next.js)     │
└────────┬────────┘
         │ シナリオを保存
         ▼
┌─────────────────┐
│   Supabase      │
│   (PostgreSQL)  │
└────────┬────────┘
         │ シナリオを読み込み
         ▼
┌─────────────────┐
│   MCP Agent     │ ← このアプリケーション
│   (Python)      │
└────────┬────────┘
         │
         ├─► Playwright (ブラウザ操作)
         │
         ├─► Vertex AI (シナリオ解釈)
         │
         └─► Supabase (データ保存)
```

## セットアップ

詳細は [SETUP.md](./SETUP.md) を参照してください。

### クイックスタート

```bash
cd apps/mcp-agent

# 1. 依存関係のインストール
pip install -r requirements.txt
playwright install chromium

# 2. 環境変数の設定
cp .env.example .env
# .envを編集（GOOGLE_API_KEY, SUPABASE_URLなど）

# 3. 実行
python main.py
```

### 必要な環境変数

- `SUPABASE_URL`: SupabaseのURL
- `SUPABASE_SERVICE_ROLE_KEY`: サービスロールキー
- `GOOGLE_API_KEY`: Google Gemini APIキー（[取得方法](https://makersuite.google.com/app/apikey)）
- `GEMINI_MODEL`: 使用するモデル（デフォルト: gemini-1.5-flash）

## 使い方

### ローカル実行

```bash
python main.py
```

### Docker実行（オプション）

ローカル開発ではDockerは不要ですが、使いたい場合：

```bash
# イメージをビルド
docker build -t mcp-agent .

# コンテナを実行
docker run --env-file .env mcp-agent
```

## シナリオの書き方

シナリオはSupabaseの`asps`テーブルの`prompt`カラムに保存します。

### シナリオ例（A8.net）

```
1. A8.netのログインページ (https://www.a8.net/) にアクセス
2. ユーザー名フィールドに {SECRET:A8NET_USERNAME} を入力
3. パスワードフィールドに {SECRET:A8NET_PASSWORD} を入力
4. ログインボタンをクリック
5. レポートメニューをクリック
6. 成果報酬メニューをクリック
7. 日別タブをクリック
8. テーブルから「確定報酬」列の数値を抽出
9. データを daily_actuals テーブルに保存
```

### シナリオのルール

- **明確な指示**: 「〇〇にアクセス」「〇〇をクリック」など明確に
- **人間が理解できる言葉**: 専門用語は避ける
- **認証情報**: `{SECRET:KEY_NAME}` 形式でSecret Managerから取得
- **データ抽出**: どのデータをどう抽出するか明記

## プロジェクト構造

```
apps/mcp-agent/
├── main.py                 # エントリポイント
├── agent/
│   ├── __init__.py
│   ├── agent_loop.py       # AIエージェントのメインループ
│   ├── browser.py          # ブラウザ操作
│   ├── gemini_client.py    # Vertex AI連携
│   └── supabase_client.py  # Supabase連携
├── config/
│   ├── __init__.py
│   └── settings.py         # 設定管理
├── tests/
│   └── test_agent.py
├── requirements.txt        # Python依存関係
├── pyproject.toml          # Python設定
├── Dockerfile              # Docker設定
└── README.md
```

## 開発

### テストの実行

```bash
pytest tests/
```

### コードフォーマット

```bash
# Black（フォーマッター）
black .

# Ruff（リンター）
ruff check .
```

## 定期実行（オプション）

ローカルマシンでの定期実行は、cronやTask Schedulerで設定できます：

### macOS/Linux (cron)

```bash
# crontabを編集
crontab -e

# 毎日9時に実行
0 9 * * * cd /path/to/apps/mcp-agent && /usr/local/bin/python3 main.py >> /tmp/mcp-agent.log 2>&1
```

### Windows (Task Scheduler)

1. タスクスケジューラを開く
2. 「基本タスクの作成」をクリック
3. トリガー: 毎日9時
4. 操作: プログラムの起動 → `python` → 引数: `main.py`
5. 開始場所: `C:\path\to\apps\mcp-agent`

## トラブルシューティング

### Playwrightがブラウザを起動できない

```bash
# ブラウザを再インストール
playwright install chromium
playwright install-deps chromium
```

### Gemini APIのエラー

- APIキーが正しいか確認
- [Google AI Studio](https://makersuite.google.com/app/apikey)でAPIキーを再確認
- 無料枠の上限に達していないか確認

## ライセンス

Private

## 関連ドキュメント

- [アーキテクチャ概要](../../docs/03_architecture/mcp-agent-overview.md)
- [開発ガイドライン](../../docs/04_development/development-guidelines.md)

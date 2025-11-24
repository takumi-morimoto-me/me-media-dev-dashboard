# MCP Agent - AI-Powered ASP Data Collection

AIエージェント（Google Gemini）を使った自律的なASPデータ収集システム

## 🚀 クイックスタート

```bash
# 1. 依存関係をインストール
pip install -r requirements.txt
playwright install chromium

# 2. 環境変数を設定
cp .env.example .env
# .envを編集（GOOGLE_API_KEY, SUPABASE_URLなど）

# 3. 実行
python main.py
```

詳細は [docs/QUICKSTART.md](docs/QUICKSTART.md) を参照

## 📚 ドキュメント

- **[QUICKSTART.md](docs/QUICKSTART.md)** - 5分で始められるガイド
- **[SETUP.md](docs/SETUP.md)** - 詳細なセットアップ手順
- **[IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)** - 実装完了レポート
- **[TEST_RESULT_REPORT.md](docs/TEST_RESULT_REPORT.md)** - 初回実行テスト結果

## 🏗️ プロジェクト構造

```
apps/mcp-agent/
├── agent/              # エージェントのコアロジック
│   ├── agent_loop.py   # メインループ
│   ├── browser.py      # Playwright操作
│   ├── gemini_client.py # Gemini API連携
│   └── supabase_client.py # データベース連携
├── config/             # 設定管理
│   └── settings.py
├── docs/               # ドキュメント
├── scripts/            # テストと開発スクリプト
│   ├── test_linkag.py  # Link-AG直接テスト
│   ├── test_felmat.py  # felmat直接テスト
│   ├── test_api.py     # Gemini API経由テスト
│   └── update_scenarios.py # Supabaseシナリオ更新
├── scenarios/          # シナリオサンプル
├── screenshots/        # スクリーンショット
├── tests/              # ユニットテスト
├── main.py             # エントリポイント
├── requirements.txt    # Python依存関係
└── .env.example        # 環境変数テンプレート
```

## ✨ 主な機能

- ✅ **自然言語シナリオ**: 非エンジニアでも編集可能
- ✅ **AI自律実行**: Geminiがシナリオを解釈して自動実行
- ✅ **柔軟な操作**: navigate, click, fill, wait, extract
- ✅ **シークレット管理**: 環境変数から安全に取得
- ✅ **自動保存**: Supabaseに自動保存
- ✅ **デバッグ機能**: スクリーンショット自動保存
- ✅ **実行ログ**: 実行履歴と結果をデータベースに記録
- ✅ **エラー通知**: Slack通知で実行結果を報告
- ✅ **スケジュール実行**: GitHub Actionsによる日次・月次自動実行

## 🎯 技術スタック

- **Python 3.11+**
- **Playwright** - ブラウザ自動操作
- **Google Gemini 2.5 Flash** - AI推論
- **Supabase** - データベース

## 📊 実行結果

初回テスト結果: **70% 成功**

詳細は [docs/TEST_RESULT_REPORT.md](docs/TEST_RESULT_REPORT.md) を参照

## 🕐 スケジュール実行

### GitHub Actionsによる自動実行

**日次データ取得**:
- 実行時刻: 毎日 9:00 AM JST
- 対象: 前営業日のデータ
- 実行タイプ: `daily`

**月次データ取得**:
- 実行時刻: 毎月1日 10:00 AM JST
- 対象: 前月の集計データ
- 実行タイプ: `monthly`

### 手動実行

```bash
# 日次データ取得
python scheduled_runner.py daily

# 月次データ取得
python scheduled_runner.py monthly
```

### Slack通知の設定

Slack Webhook URLを環境変数に設定すると、実行結果が自動通知されます:

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

通知内容:
- ✅ 実行完了サマリー (成功/失敗件数)
- ❌ エラー通知 (失敗した ASP の詳細)
- 📊 取得レコード数

## 📝 ライセンス

Private

---

**作成日**: 2025-11-10
**最終更新**: 2025-11-24

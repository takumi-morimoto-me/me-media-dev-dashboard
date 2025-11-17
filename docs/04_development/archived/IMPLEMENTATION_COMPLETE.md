# 実装完了レポート - MCP Agent復活

**日付**: 2025-11-07
**目的**: 当初の実装計画に沿ったPython製AIエージェントの再実装

---

## 📋 実装概要

当初の設計思想に基づき、**AIエージェント（Python + Vertex AI Gemini）**を使った自律的なASPデータ収集システムを復活させました。

### 設計思想の再確認

> 「非エンジニアが**自然言語のシナリオ（プロンプト）を書くだけ**で、AIエージェントが自律的にブラウザを操作してデータを取得する」

この思想により：
- ✅ ASP仕様変更時、コード修正不要（プロンプト修正のみ）
- ✅ 新規ASP追加が容易（シナリオを書くだけ）
- ✅ 非エンジニアでも保守可能
- ✅ Turboによるモノレポ管理の意義が復活

---

## 🏗️ プロジェクト構造（復活後）

```
apps/
├── dashboard/    (Next.js)  ← UI・シナリオ管理
└── mcp-agent/    (Python)   ← AIエージェント ★復活！

packages/
└── db/           (Supabase) ← 共有データベース
```

---

## 📁 実装ファイル一覧

### apps/mcp-agent/ 構成

```
apps/mcp-agent/
├── agent/
│   ├── __init__.py              # モジュール定義
│   ├── agent_loop.py            # メインのエージェントループ
│   ├── browser.py               # Playwrightブラウザ制御
│   ├── gemini_client.py         # Vertex AI (Gemini) 連携
│   └── supabase_client.py       # Supabaseデータベース操作
├── config/
│   ├── __init__.py              # 設定モジュール定義
│   └── settings.py              # 環境変数管理
├── tests/
│   └── test_agent.py            # 基本的なテスト
├── main.py                      # エントリポイント
├── requirements.txt             # Python依存関係
├── pyproject.toml               # Python設定
├── Dockerfile                   # Docker設定
├── package.json                 # Turbo統合用
├── .env.example                 # 環境変数テンプレート
├── .gitignore                   # Git除外設定
└── README.md                    # 詳細ドキュメント
```

### ドキュメント

```
docs/
├── 03_architecture/
│   └── mcp-agent-overview.md    # アーキテクチャ概要 ★復活！
└── ARCHITECTURE_DECISION.md     # アーキテクチャ決定記録 ★新規！
```

---

## 🔧 技術スタック

| カテゴリ | 技術 | 役割 |
|---------|------|------|
| 言語 | Python 3.11+ | メイン開発言語 |
| ブラウザ自動化 | Playwright | ブラウザ操作 |
| AI/LLM | Vertex AI (Gemini) | シナリオ解釈・推論 |
| データベース | Supabase | シナリオ保存・データ格納 |
| インフラ | Google Cloud Run | サーバーレス実行 |
| スケジューラ | Cloud Scheduler | 定期実行 |
| 認証管理 | Secret Manager | 認証情報の安全管理 |
| コンテナ | Docker | 実行環境のパッケージ化 |

---

## 💡 主要機能

### 1. エージェントループ（agent_loop.py）

```python
# シナリオを読み込み
scenario = supabase.get_asp_scenario("A8.net")

# ステップごとに実行
for step in steps:
    # Geminiがステップを解釈
    command = gemini.interpret_scenario_step(step, page_context)

    # ブラウザでコマンドを実行
    browser.execute_command(command)
```

### 2. Gemini連携（gemini_client.py）

自然言語のシナリオステップを具体的なブラウザ操作に変換：

```
入力: "ログインボタンをクリック"
↓ Gemini
出力: {"action": "click", "selector": "button[type='submit']"}
```

### 3. 認証情報の安全な管理

```
シナリオ: "ユーザー名フィールドに {SECRET:A8NET_USERNAME} を入力"
↓
エージェント: Secret Managerから実際の値を取得して使用
```

---

## 🚀 使い方

### ローカル開発

```bash
cd apps/mcp-agent

# 依存関係インストール
pip install -r requirements.txt
playwright install chromium

# 環境変数設定
cp .env.example .env
# .envを編集

# 実行
python main.py
```

### Docker実行

```bash
docker build -t mcp-agent .
docker run --env-file .env mcp-agent
```

### Cloud Runデプロイ

```bash
gcloud run deploy mcp-agent \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated
```

---

## 📝 シナリオの書き方

### 例：A8.netの場合

Supabaseの`asps`テーブルに以下のような自然言語シナリオを保存：

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

**ポイント**:
- 人間が理解できる自然な日本語で記述
- `{SECRET:KEY_NAME}` 形式で認証情報を参照
- AIが文脈を理解して適切なセレクタを選択

---

## 🔄 TypeScript版スクレイパーとの比較

### TypeScript版（現在）

```typescript
// 各ASPごとに200-900行のコードを手動実装
export class A8NetDailyScraper {
  async login() {
    await this.page.fill('input[name="login"]', this.credentials.username);
    await this.page.fill('input[name="passwd"]', this.credentials.password);
    await this.page.click('input[name="login_as_btn"]');
    // ... 数百行のコード
  }
}
```

**問題点**:
- ❌ ASP仕様変更のたびにコード修正が必要
- ❌ 26件のASPで合計数千行のコード
- ❌ セレクタがハードコード
- ❌ 保守コストが高い

### Python版（AIエージェント）

```python
# シナリオ（データベースに保存）
scenario = """
1. ログインページにアクセス
2. ユーザー名を入力
3. パスワードを入力
4. ログインボタンをクリック
"""

# エージェントが自動実行
agent.run_asp_scraper("A8.net")
```

**メリット**:
- ✅ シナリオ修正のみで対応可能
- ✅ 汎用的なコードは1回だけ実装
- ✅ AIが柔軟に対応
- ✅ 保守コストが低い

---

## 📊 今後のロードマップ

### Phase 1: セットアップと動作確認（1週間）

- [x] Python環境のセットアップ
- [x] 基本的なエージェント実装
- [x] Vertex AI (Gemini) 連携
- [x] ドキュメント整備
- [ ] GCP環境のセットアップ
- [ ] ローカルでの動作確認

### Phase 2: シナリオ作成（1-2週間）

- [ ] A8.netのシナリオ作成・テスト
- [ ] もしもアフィリエイトのシナリオ作成・テスト
- [ ] Link-AGのシナリオ作成・テスト
- [ ] 他23件のASPシナリオ作成

### Phase 3: 本番稼働（1週間）

- [ ] Cloud Runデプロイ
- [ ] Cloud Scheduler設定
- [ ] Secret Manager設定
- [ ] 監視・ログ設定
- [ ] エラー通知設定

### Phase 4: TypeScript版スクレイパーの移行

- [ ] AI版で安定稼働を確認
- [ ] TypeScript版スクレイパーを段階的に削除
- [ ] 完全移行

---

## ✅ 完了した作業

1. ✅ `apps/mcp-agent` ディレクトリ作成
2. ✅ Python環境設定（pyproject.toml, requirements.txt）
3. ✅ Dockerfile作成
4. ✅ 設定管理モジュール（config/settings.py）
5. ✅ Supabaseクライアント（agent/supabase_client.py）
6. ✅ ブラウザコントローラー（agent/browser.py）
7. ✅ Geminiクライアント（agent/gemini_client.py）
8. ✅ エージェントループ（agent/agent_loop.py）
9. ✅ メインエントリポイント（main.py）
10. ✅ テストファイル（tests/test_agent.py）
11. ✅ ドキュメント復活（docs/03_architecture/mcp-agent-overview.md）
12. ✅ READMEとガイド作成

---

## 🎯 次のステップ

1. **GCP環境のセットアップ**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable aiplatform.googleapis.com
   ```

2. **ローカル動作確認**
   ```bash
   cd apps/mcp-agent
   pip install -r requirements.txt
   playwright install chromium
   cp .env.example .env
   # .envを編集
   python main.py
   ```

3. **最初のシナリオ作成**
   - Supabaseの`asps`テーブルで、A8.netの`prompt`カラムにシナリオを記述
   - ローカルでテスト実行

---

## 📚 関連ドキュメント

- [MCP Agent README](apps/mcp-agent/README.md)
- [アーキテクチャ概要](docs/03_architecture/mcp-agent-overview.md)
- [アーキテクチャ決定記録](docs/ARCHITECTURE_DECISION.md)
- [開発ガイドライン](docs/04_development/development-guidelines.md)

---

## 🙏 まとめ

当初の実装計画に沿った、**AIエージェント方式のASPデータ収集システム**を復活させました。

これにより：
- ✅ Turboの存在意義が復活
- ✅ 保守性・拡張性が大幅に向上
- ✅ 当初の設計思想に回帰
- ✅ TypeScript版の問題点を解決

次は実際にGCP環境をセットアップして、動作確認を行いましょう！

---

最終更新: 2025-11-07

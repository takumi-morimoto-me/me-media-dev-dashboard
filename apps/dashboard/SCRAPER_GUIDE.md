# ASPスクレイパー 実行ガイド

全26件のASPスクレイパーの実行方法をまとめたガイドです。

## 📋 対応ASP一覧

全26件のASPに対応しています：

1. a8net
2. a8app
3. accesstrade
4. afb
5. amazon
6. castalk
7. circuitx
8. dmm
9. docomo-affiliate
10. felmat
11. imobile
12. janet
13. linkag
14. linkshare
15. moshimo
16. presco
17. ratelad
18. rentracks
19. skyflag
20. slvrbullet
21. smaad
22. smartc
23. tg-affiliate
24. ultiga
25. valuecommerce
26. zucks

---

## 🚀 実行方法

### 1. 全ASP一括実行（推奨）

#### 日次データ取得
```bash
# 全ASPの日次データを一括取得
pnpm scrape:all:daily

# 特定の月を指定
pnpm scrape:all:daily -- --month=9

# 特定のASPのみ実行
pnpm scrape:all:daily -- --asp=a8net,moshimo,linkag
```

#### 月次データ取得
```bash
# 全ASPの月次データを一括取得（2025年1-10月）
pnpm scrape:all:monthly

# 特定のASPのみ実行
pnpm scrape:all:monthly -- --asp=a8net,moshimo
```

### 2. 個別ASP実行

#### 日次スクレイパー
```bash
# 例: A8.netの日次データ取得
cd apps/dashboard
pnpm exec tsx src/scripts/asp/daily/a8net/index.ts

# 月を指定する場合（ASPによって異なる）
pnpm exec tsx src/scripts/asp/daily/a8net/index.ts --month=9
```

#### 月次スクレイパー
```bash
# 例: A8.netの月次データ取得（1-10月の全期間）
cd apps/dashboard
pnpm exec tsx src/scripts/asp/monthly/a8net/index.ts
```

---

## 🔧 環境変数設定

各ASPの認証情報を `.env.local` に設定してください。

### 必須設定

```bash
# 共通設定
RERE_MEDIA_ID=your_media_id
AFFILIATE_ACCOUNT_ITEM_ID=your_account_item_id

# 各ASPの認証情報とASP ID
A8NET_USERNAME=your_username
A8NET_PASSWORD=your_password
A8NET_ASP_ID=your_asp_id

MOSHIMO_USERNAME=your_username
MOSHIMO_PASSWORD=your_password
MOSHIMO_ASP_ID=your_asp_id

LINKAG_USERNAME=your_username
LINKAG_PASSWORD=your_password
LINKAG_ASP_ID=your_asp_id

# ... 他のASPも同様
```

### 環境変数の命名規則

| ASP | プレフィックス | 例 |
|-----|------------|-----|
| A8.net | `A8NET_` | `A8NET_USERNAME` |
| もしもアフィリエイト | `MOSHIMO_` | `MOSHIMO_USERNAME` |
| Link-AG | `LINKAG_` | `LINKAG_USERNAME` |
| felmat | `FELMAT_` | `FELMAT_USERNAME` |
| afb | `AFB_` | `AFB_USERNAME` |
| アクセストレード | `ACCESSTRADE_` | `ACCESSTRADE_USERNAME` |
| Amazon | `AMAZON_` | `AMAZON_USERNAME` |
| DMM | `DMM_` | `DMM_USERNAME` |
| TGアフィリエイト | `TG_AFFILIATE_` | `TG_AFFILIATE_USERNAME` |

---

## 📸 スクリーンショット

実行中のスクリーンショットは以下のディレクトリに保存されます：

```
screenshots/
├── daily/    # 日次スクレイパーのスクリーンショット
└── monthly/  # 月次スクレイパーのスクリーンショット
```

デバッグ時に確認してください。

---

## ⚙️ 実装状況

### 日次スクレイパー

✅ **実装済み（26件）**: 全ASP

### 月次スクレイパー

✅ **実装済み（26件）**: 全ASP
- 日次スクレイパーを使って月単位でデータを取得

---

## 🔍 トラブルシューティング

### エラー: 認証情報が設定されていません

```bash
❌ エラー: 認証情報が設定されていません
   A8NET_USERNAME と A8NET_PASSWORD を .env.local に設定してください
```

**解決方法**: `.env.local` に該当ASPの認証情報を追加してください。

### エラー: スクレイパーが実装されていません

```bash
⚠️  xxx: スクレイパーが実装されていません（スキップ）
```

**解決方法**: 該当ASPのスクレイパーが未実装です。実装を待つか、他のASPを使用してください。

### タイムアウトエラー

**原因**: ネットワークが遅い、ASPサーバーが遅い

**解決方法**:
1. しばらく待ってから再実行
2. `headless: false` に設定して手動で確認
3. タイムアウト時間を延長

### ログインエラー

**原因**: 認証情報が間違っている

**解決方法**:
1. `.env.local` の認証情報を確認
2. ASPサイトで直接ログインできるか確認
3. パスワードが変更されていないか確認

---

## 📊 実行結果の確認

### データベース確認

```bash
# daily_actuals テーブルを確認
pnpm db:check-actuals

# actuals テーブル（月次）を確認
pnpm db:check

# 特定のASPを確認
pnpm db:check-linkag
pnpm db:check-moshimo
```

### ログ確認

実行ログはコンソールに出力されます：

```
📋 全ASP日次スクレイパー一括実行
============================================================

対象ASP: 26件

a8net, a8app, accesstrade, afb, ...

[1/26] a8net を実行中...
============================================================
🚀 a8net のデータ取得を開始...
============================================================

✅ a8net: 成功 (所要時間: 45.2秒)

⏱️  次のASPまで3秒待機...

[2/26] a8app を実行中...
...

============================================================
📊 実行結果サマリー
============================================================

✅ 成功: 20件
❌ 失敗: 4件
⚠️  スキップ: 2件
⏱️  合計所要時間: 25.3分
```

---

## 🎯 ベストプラクティス

### 1. 小規模から始める

最初は1-2件のASPでテストしてから、全ASP実行に移行してください。

```bash
# まずは主要3件でテスト
pnpm scrape:all:daily -- --asp=a8net,moshimo,linkag
```

### 2. 実行タイミング

- **日次データ**: 毎日午前9時頃（前日のデータが確定している時間）
- **月次データ**: 毎月1日午前10時頃（前月のデータが確定している時間）

### 3. エラー発生時

エラーが発生したASPは、個別に再実行してください。

```bash
# エラーが出たASPのみ再実行
pnpm scrape:all:daily -- --asp=afb,amazon
```

### 4. 並列実行しない

スクレイパーは順次実行されます。並列実行するとASPサーバーに負荷をかけるため、避けてください。

---

## 📝 開発者向け情報

### ディレクトリ構造

```
src/scripts/
├── asp/
│   ├── daily/
│   │   ├── a8net/
│   │   │   └── index.ts
│   │   ├── moshimo/
│   │   │   └── index.ts
│   │   └── ...
│   └── monthly/
│       ├── a8net/
│       │   └── index.ts
│       ├── moshimo/
│       │   └── index.ts
│       └── ...
├── run-all-daily-scrapers.ts    # 全ASP日次実行
├── run-all-monthly-scrapers.ts  # 全ASP月次実行
└── generate-monthly-scrapers.ts # 月次スクレイパー生成ツール
```

### 新しいASPを追加する

1. `src/scripts/asp/daily/{asp-name}/index.ts` を作成
2. 日次スクレイパーを実装
3. `generate-monthly-scrapers.ts` にASPを追加
4. 月次スクレイパーを自動生成
5. `.env.local` に認証情報を追加
6. テスト実行

---

## 🔗 関連ドキュメント

- [ASPデータ取得機能要件定義](../../docs/01_requirements/detailed-specs/asp-data-acquisition-spec.md)
- [スクレイパー実装ガイド](../../docs/04_development/scrapers/guide.md)
- [実装状況](../../docs/04_development/scrapers/status.md)

---

## 📅 今後の予定

### フェーズ1: 安定稼働（現在）
- ✅ 全26件のASPスクレイパー実装
- ✅ 一括実行スクリプト
- [ ] 各ASPの動作確認とテスト

### フェーズ2: 自動化
- [ ] GitHub Actionsでの自動実行
- [ ] エラー通知機能（Slack/メール）
- [ ] 実行ログの保存

### フェーズ3: UI実装
- [ ] ダッシュボードからの手動実行UI
- [ ] 進捗状態の表示
- [ ] 実行履歴の表示

---

最終更新: 2025-11-07

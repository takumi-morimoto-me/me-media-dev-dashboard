# システム状態確認書

**最終更新日**: 2025-11-04
**更新者**: Claude Code

このドキュメントは、プロジェクトの最新状態を記録しています。

---

## 📊 プロジェクト概要

### 基本情報

- **プロジェクト名**: me-media-dev-dashboard
- **目的**: メディア運営の財務管理・ASP実績データ自動収集ダッシュボード
- **技術スタック**: Next.js 14 + Supabase + Playwright
- **開発手法**: pnpm workspace（モノレポ）

### プロジェクト構成

```
me-media-dev-dashboard/
├── apps/
│   └── dashboard/          # Next.js アプリケーション
├── packages/
│   └── db/                 # データベース関連
└── docs/                   # ドキュメント（本ディレクトリ）
```

---

## 🗄️ データベース状態

### テーブル構成

| テーブル名 | 用途 | 重要度 | 状態 |
|-----------|------|--------|------|
| `media` | メディア情報 | 高 | ✅ 正常 |
| `account_items` | 勘定科目 | 高 | ✅ 正常 |
| `asps` | ASP情報 | 高 | ✅ 正常 |
| `users` | ユーザー情報 | 中 | ✅ 正常 |
| `budgets` | 月次予算 | 高 | ✅ 正常 |
| `actuals` | 月次実績 | 高 | ✅ 正常 |
| `daily_budgets` | 日次予算 | 高 | ✅ 正常 |
| `daily_actuals` | 日次実績 | 高 | ✅ 正常 |
| `user_media_assignments` | ユーザー-メディア紐付け | 中 | ✅ 正常 |
| `app_settings` | アプリ設定 | 中 | ✅ 正常 |

### ⚠️ 重要な仕様

#### データ保存日付ルール

- **日次データ**: 実際の日付で保存 (例: `2025-01-15`)
- **月次データ**: 月末日付で保存 (例: `2025-01-31`)
  - ❌ **誤**: `2025-01-01` (月初)
  - ✅ **正**: `2025-01-31` (月末)

#### データ分離ルール

- **日次データ**: `daily_actuals` テーブルのみ使用
- **月次データ**: `actuals` テーブルのみ使用
- **絶対に合算しない**: 日次と月次は別々に管理

#### UNIQUE制約

- `actuals`: `(date, media_id, account_item_id, asp_id)`
- `daily_actuals`: `(date, media_id, account_item_id, asp_id)`

---

## 🤖 ASPスクレイパー実装状況

### 実装済みスクレイパー (24件)

#### Production Ready (5件)
1. A8.net
2. もしもアフィリエイト
3. Link-AG
4. felmat
5. afb

#### Testing Required (19件)
6. アクセストレード
7. Amazonアソシエイト
8. DMMアフィリエイト
9. リンクシェア
10. バリューコマース
11. JANet
12. TGアフィリエイト
13. レントラックス
14. Smart-C
15. i-mobile
16. Zucks Affiliate
17. CASTALK
18. CircuitX
19. SmaAD
20. SKYFLAG
21. アルテガアフィリエイト
22. Ratel AD
23. ドコモアフィリエイト
24. PRESCO

### 未実装 (6件)

- A8app (A8のアプリ版)
- SLVRbullet
- affitown
- Gro-fru
- Sphere
- webridge

### スクレイパーテスト状況

**最終テスト実行**: 2025-11-04
**テスト結果**: 7/7 (100%) ✅

1. ✅ 日次データ取得（2025-01-01以降）
2. ✅ 月次データ取得（2025-01-01以降）
3. ✅ 月末日付チェック
4. ✅ 日次データ重複なし
5. ✅ 月次データ重複なし
6. ✅ 日次・月次合算なし
7. ✅ 週次集計可能

**修正履歴**:
- 2025-11-04: Link-AGの月次データ日付修正（月初→月末）

---

## 📝 ドキュメント状態

### ドキュメント構成

```
docs/
├── README.md                    # ドキュメント全体のインデックス
├── SYSTEM_STATUS.md            # このファイル（システム状態）
├── 01_requirements/            # 要件定義
├── 02_design/                  # デザイン仕様
├── 03_architecture/            # アーキテクチャ設計
└── 04_development/             # 開発ドキュメント
    ├── scraper-testing-checklist.md
    ├── scraper-implementation-guide.md
    ├── scrapers.md
    ├── asp-implementation-status.md
    ├── csv-import.md
    ├── development-guidelines.md
    ├── implementation-log.md
    ├── reference/              # リファレンスファイル
    │   ├── README.md
    │   ├── affiliate-services.csv
    │   └── asp-credentials.csv  # 機密情報
    ├── troubleshooting/        # トラブルシューティング
    └── adr/                    # Architecture Decision Records
```

### 最近の更新

- **2025-11-04**: ドキュメント構造整理
  - `docs/README.md` 作成
  - `reference/README.md` 更新
  - `asp-credentials.csv` を `reference/` に移動
  - `SYSTEM_STATUS.md` (このファイル) 作成

---

## 🔐 認証情報管理

### ASP認証情報

**ファイル**: `docs/04_development/reference/asp-credentials.csv`

**状態**:
- 総数: 30件
- 認証情報あり: 20件
- 認証情報なし: 10件

**未登録ASP**:
- JANet
- Ratel AD
- Gro-fru
- Sphere
- afb
- webridge
- レントラックス
- affitown
- バリューコマース
- SLVRbullet

**セキュリティ注意**:
- ❌ Gitにコミットしない
- ❌ 公開リポジトリにアップロードしない
- ✅ ローカル開発のみで使用
- ✅ 共有時は暗号化する

---

## 🚀 最近の主要な変更

### 2025-11-04

#### データ修正
- Link-AGの月次データ日付を修正
  - `2025-08-01` → `2025-07-31`
  - `2025-09-01` → `2025-08-31`
  - `2025-10-01` → `2025-09-30`

#### ドキュメント整理
- `docs/README.md` 作成（全体インデックス）
- `asp-credentials.csv` を `reference/` に移動
- リファレンスREADME更新
- システム状態ドキュメント作成

#### テスト環境整備
- `scraper-testing-checklist.md` 作成
- `scraper-implementation-guide.md` 作成
- `test-scraper-data.ts` 実装
- テスト100%合格

---

## ⚠️ 既知の問題

### 現在の問題: なし

### 解決済み

1. **Link-AG月次データ日付問題** (2025-11-04解決)
   - 症状: 月初日付で保存されていた
   - 原因: `linkag-monthly-scraper.ts` の日付計算ロジック
   - 解決: 月末日付計算ロジックに修正

---

## 📋 TODO

### 高優先度

- [ ] 残り19件のスクレイパーをテスト環境で実行検証
- [ ] 認証情報未登録の10 ASPの認証情報を取得
- [ ] 未実装6件のスクレイパーを実装

### 中優先度

- [ ] RLS (Row Level Security) の設計・実装
- [ ] ユーザー認証機能の実装
- [ ] エラー通知機能の実装

### 低優先度

- [ ] 週次レポート機能の実装
- [ ] CSVエクスポート機能の実装
- [ ] ダッシュボードUIの改善

---

## 🔄 データフロー

### スクレイパー → データベース

```
1. スクレイパー実行
   ↓
2. ASPサイトからデータ取得
   ↓
3. データ整形
   ↓
4. Supabaseに保存
   - 日次: daily_actuals
   - 月次: actuals (月末日付)
   ↓
5. RPC関数で集計
   - get_asp_daily_data
   - get_asp_monthly_data
```

### TSV/CSVインポート → データベース

```
1. CSVアップロード
   ↓
2. import_financial_data RPC実行
   ↓
3. 月次データを保存 (budgets/actuals)
   ↓
4. 日次データに自動展開 (daily_budgets/daily_actuals)
```

---

## 📚 参考リンク

### 内部ドキュメント

- [要件定義](01_requirements/requirements-definition.md)
- [データベース設計](03_architecture/database-design.md)
- [スクレイパー実装ガイド](04_development/scraper-implementation-guide.md)
- [ASP実装状況](04_development/asp-implementation-status.md)

### 外部リソース

- [Supabase Documentation](https://supabase.com/docs)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Next.js Documentation](https://nextjs.org/docs)

---

## 🏁 システムヘルスチェック

| 項目 | 状態 | 備考 |
|------|------|------|
| データベース接続 | ✅ | 正常 |
| スクレイパー実行 | ✅ | 24件実装済み |
| データ整合性 | ✅ | テスト100%合格 |
| ドキュメント整理 | ✅ | 最新状態 |
| セキュリティ | ⚠️ | RLS未実装（開発中） |

**総合評価**: **良好** (開発フェーズとして正常に稼働)

---

最終確認日: 2025-11-04

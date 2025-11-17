# 変更履歴

プロジェクトの主要な変更を時系列で記録します。

---

## 2025-11-04 (午後): ドキュメントMECE整理・圧縮

### ドキュメント構造の最適化

**実施内容**:
- MECE原則に基づいたドキュメント構造の再編成
- ファイル名の圧縮による可読性向上
- 不要なディレクトリの移動

**変更内容**:
1. **アーカイブドキュメントの整理**
   - `03_architecture/mcp-agent-overview.md` → `04_development/archived/`

2. **リファレンスデータの分離**
   - `docs/04_development/reference/` → `/reference/` (プロジェクトルート)
   - CSVデータファイルはドキュメントではないため分離
   - `.gitignore` に `reference/` を追加

3. **スクレイパードキュメントの圧縮**
   - `implementation-guide.md` → `guide.md`
   - `implementation-status.md` → `status.md`
   - `testing-checklist.md` → `testing.md`

4. **参照パスの一括更新**
   - 全ドキュメント内の古いファイル名参照を更新
   - スクリプトファイルのパス更新

**MECE分析結果**:
- ✅ 01_requirements: 要件定義のみ
- ✅ 02_design: デザイン仕様のみ
- ✅ 03_architecture: アーキテクチャドキュメントのみ（アーカイブを除外）
- ✅ 04_development: 開発関連ドキュメントのみ

---

## 2025-11-04 (午後): ASPデータ取得機能要件定義作成

### 新規ドキュメント作成

**ファイル**: `01_requirements/detailed-specs/asp-data-acquisition-spec.md`

**目的**: ASP部分の実装計画を明確化するため、データ取得機能の要件を包括的に定義

**内容**:
- 指定月データ取得機能（日次・月次）
- 最新データ自動取得機能（スケジューリング）
- 非機能要件（パフォーマンス、信頼性、セキュリティ）
- ユースケース（過去データ一括取得、定期自動取得）
- エラー処理と通知
- テスト要件
- 実装優先度（4フェーズ）

**実装フェーズ**:
- フェーズ1: MVP（手動データ取得）✅ 完了
- フェーズ2: 自動化（cron実装）🔄 計画中
- フェーズ3: UI実装 📋 未着手
- フェーズ4: 拡張（全ASP対応）📋 未着手

---

## 2025-11-04 (午前): ドキュメント包括整理

### ドキュメント構造の再編成

**実施内容:**
- スクレイパー関連ドキュメントを `scrapers/` ディレクトリに集約
- CSV機能仕様を要件定義に移動
- データ仕様書を新規作成
- 古い実装ログをアーカイブ

**変更ファイル:**
- `scrapers.md` → `scrapers/overview.md`
- `scraper-implementation-guide.md` → `scrapers/implementation-guide.md`
- `scraper-testing-checklist.md` → `scrapers/testing-checklist.md`
- `asp-implementation-status.md` → `scrapers/implementation-status.md`
- `csv-import.md` → `01_requirements/detailed-specs/csv-import-spec.md`
- `implementation-log.md` → `archived/implementation-log-2025-10.md`

**新規作成:**
- `scrapers/README.md` - スクレイパードキュメントのインデックス
- `01_requirements/detailed-specs/data-specification.md` - データ仕様書
- `CHANGELOG.md` - この変更履歴ファイル
- `README.md` - docsディレクトリ全体のインデックス
- `SYSTEM_STATUS.md` - システム状態確認書

### データ修正

**Link-AGスクレイパーの月次データ日付修正:**
- 問題: 月初日付（2025-08-01, 09-01, 10-01）で保存されていた
- 修正: 月末日付（2025-07-31, 08-31, 09-30）に修正
- 対象データ: 3件
- スクリプト: `fix-linkag-dates.ts`

**スクレイパーコード修正:**
- ファイル: `linkag-monthly-scraper.ts`
- 修正箇所: 月末日付計算ロジック（line 236-239）

### テスト環境整備

**テストドキュメント作成:**
- `scraper-testing-checklist.md` - テスト項目リスト
- `scraper-implementation-guide.md` - 実装ガイド

**テストスクリプト作成:**
- `test-scraper-data.ts` - 7項目の自動テスト
- `check-invalid-dates.ts` - 日付整合性チェック

**テスト結果:**
- 7/7テスト合格（100%）
- 全ての月次データが月末日付で保存されることを確認
- 日次・月次データの分離を確認

### ASP認証情報管理

**ファイル整理:**
- `asp-credentials.csv` を `reference/` ディレクトリに移動
- 30件のASPサービスの認証情報を管理
- 認証情報あり: 20件、未登録: 10件

---

## 2025-10-28: ASPスクレイパー実装拡大

### 実装済みスクレイパー

24件のASPスクレイパーを実装完了：

**Production Ready (5件):**
- A8.net
- もしもアフィリエイト
- Link-AG
- felmat
- afb

**Testing Required (19件):**
- アクセストレード, Amazonアソシエイト, DMMアフィリエイト
- リンクシェア, バリューコマース, JANet, TGアフィリエイト
- レントラックス, Smart-C, i-mobile, Zucks Affiliate
- CASTALK, CircuitX, SmaAD, SKYFLAG
- アルテガアフィリエイト, Ratel AD, ドコモアフィリエイト, PRESCO

---

## 2025-10-09: マイグレーションファイルの整理

### 不要ファイルの削除と名称統一

**削除したファイル（10個）:**
- 古い関数定義ファイル（3個）
- 重複したRLS設定
- タイムスタンプ形式の古いファイル（5個）
- デバッグ関数

**統一後のファイル構成（8個）:**
1. `001_initial_schema.sql`
2. `002_seed_test_data.sql`
3. `003_auto_create_account_items.sql`
4. `004_create_daily_tables.sql`
5. `005_create_daily_data_function.sql`
6. `006_update_import_function_for_daily.sql`
7. `007_disable_all_rls.sql`
8. `008_create_monthly_data_function.sql`

**変更内容:**
- 全ファイルを `00N_description.sql` 形式に統一
- 連番でスキップなし
- 開発の時系列に沿った順序

### デバッグコードのクリーンアップ

**削除したコード:**
- 日次データ件数確認ログ
- データ存在確認ログ

**残したコード:**
- エラーハンドリング用のconsole.error

---

## 2025-10-08: 日次・週次・月次表示機能の実装

### データ分離の実装

**重要な変更:**
- 日次データと月次データを完全分離
- `daily_actuals` と `actuals` を別テーブルで管理
- RPC関数を分離: `get_asp_daily_data` / `get_asp_monthly_data`

**マイグレーション:**
- `016_fix_asp_monthly_data_function.sql` を追加
- 月次データ取得時に `daily_actuals` を参照しないように修正

---

## 今後の予定

### 高優先度
- [ ] 残り19件のスクレイパーをテスト環境で実行検証
- [ ] 認証情報未登録10 ASPの認証情報取得
- [ ] 未実装6件のスクレイパー実装

### 中優先度
- [ ] RLS（Row Level Security）の設計・実装
- [ ] ユーザー認証機能の実装
- [ ] エラー通知機能の実装

### 低優先度
- [ ] 週次レポート機能の実装
- [ ] CSVエクスポート機能の実装
- [ ] ダッシュボードUIの改善

---

最終更新日: 2025-11-04

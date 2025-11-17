# プロジェクトドキュメント

このディレクトリには、me-media-dev-dashboard プロジェクトの全てのドキュメントが含まれています。

## 📂 ディレクトリ構造

```
docs/
├── 01_requirements/     # 要件定義
├── 02_design/          # デザイン仕様
├── 03_architecture/    # アーキテクチャ設計
└── 04_development/     # 開発ドキュメント
```

## 01. 要件定義 (01_requirements)

プロジェクトの要件と仕様を定義したドキュメント群です。

### 主要ドキュメント

- **requirements-definition.md**: 全体の要件定義
- **detailed-specs/**: 各機能の詳細仕様
  - `dashboard-page.md`: ダッシュボード画面の仕様
  - `financial-management-page.md`: 財務管理画面の仕様
  - `automation-management-page.md`: 自動化管理画面の仕様
  - `asp-data-acquisition-spec.md`: ASPデータ取得機能の要件
  - `data-specification.md`: データ保存・管理仕様
  - `csv-import-spec.md`: CSVインポート機能仕様

## 02. デザイン (02_design)

UIデザインとデザインシステムの定義です。

### 主要ドキュメント

- **design-definition.md**: デザインコンセプトとガイドライン
- **design-tokens.yaml**: デザイントークン定義
- **ui-specs/**: UI仕様
  - `layout-definition.md`: レイアウト定義

## 03. アーキテクチャ (03_architecture)

システムのアーキテクチャ設計と技術選定です。

### 主要ドキュメント

- **technology-selection.md**: 技術スタック選定理由
- **database-design.md**: データベース設計
- **mcp-agent-overview.md**: AIエージェント設計（アーカイブ）

## 04. 開発 (04_development)

開発に関する実装ガイド、トラブルシューティング、参考資料です。

### 🚀 開発ガイド

#### 主要ドキュメント
- **development-guidelines.md**: 開発ガイドライン（必読）
- **CHANGELOG.md**: 変更履歴

#### スクレイパー関連 (scrapers/)
- **README.md**: スクレイパードキュメントのインデックス
- **overview.md**: ASPスクレイパー概要
- **guide.md**: 実装ガイド
- **testing.md**: テストチェックリスト
- **status.md**: ASP実装状況（24件実装済み）


### 🔧 トラブルシューティング (troubleshooting/)

過去のエラーと解決策を記録しています。

- `2025-10-05_css-build-error.md`
- `2025-10-06_server-client-component-error.md`
- `2025-10-09_mcp-agent-docker-build-error.md`
- `2025-10-14_gitignore-monorepo.md`
- `2025-10-14_mcp-agent-pnpm-dev-error.md`
- `2025-10-14_dashboard-shadcn-components.md`
- `2025-10-15_asp-form-type-error.md`

### 📝 ADR (adr/)

Architecture Decision Records - 重要な設計決定の記録です。

- `0001-table-column-wrapping-issue.md`: テーブルカラムの折り返し問題

## 🎯 クイックスタート

### 新しい開発者向け

1. [要件定義](01_requirements/requirements-definition.md) を読む
2. [技術選定](03_architecture/technology-selection.md) を確認
3. [開発ガイドライン](04_development/development-guidelines.md) に従う

### スクレイパー実装者向け

1. [スクレイパー概要](04_development/scrapers/overview.md) を読む
2. [実装ガイド](04_development/scrapers/guide.md) を確認
3. [ASP実装状況](04_development/scrapers/status.md) で未実装ASPを確認
4. [テストチェックリスト](04_development/scrapers/testing.md) でテスト

### トラブルシューティング

エラーに遭遇した場合は、[トラブルシューティング](04_development/troubleshooting/) ディレクトリを確認してください。

## 📊 システム概要

### 技術スタック

- **フロントエンド**: Next.js 14 (App Router)
- **スタイリング**: Tailwind CSS + shadcn/ui
- **データベース**: Supabase (PostgreSQL)
- **スクレイピング**: Playwright (TypeScript)
- **モノレポ管理**: pnpm + Turborepo

### 主要機能

1. **財務ダッシュボード**: ASP実績データの可視化
2. **ASPスクレイパー**: 自動データ収集
3. **データ管理**: 日次・月次データの管理
4. **週次レポート**: 日次データからの集計

### データベーステーブル

- `asps`: ASP情報
- `media`: メディア情報
- `account_items`: 勘定科目
- `daily_actuals`: 日次実績データ
- `actuals`: 月次実績データ

## 🔒 セキュリティ

### 機密情報の取り扱い

以下のファイルには機密情報が含まれています：

- `/reference/asp-credentials.csv`: ASP認証情報（プロジェクトルート）
- `.env.local`: 環境変数

これらのファイルは **絶対にGitにコミットしないでください**。

## 📝 ドキュメント更新ルール

1. **新機能追加時**: 対応するドキュメントを更新または作成し、CHANGELOGに記録
2. **仕様変更時**: 関連ドキュメントを必ず更新
3. **エラー解決時**: トラブルシューティングに記録
4. **設計決定時**: ADRを作成
5. **重要な変更時**: SYSTEM_STATUSを更新

## 🔄 最終更新

- **日付**: 2025-11-04
- **更新内容**:
  - ドキュメント構造を包括的に整理（MECE準拠）
  - スクレイパー関連ドキュメントを `scrapers/` に集約
  - データ仕様書を新規作成（`data-specification.md`）
  - **ASPデータ取得機能要件定義を新規作成**（`asp-data-acquisition-spec.md`）
  - CSV機能仕様を要件定義に移動
  - 変更履歴（CHANGELOG）の導入
  - 古いimplementation-logをアーカイブ
  - 開発ガイドラインにスクレイパールールを追加

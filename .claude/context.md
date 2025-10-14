# プロジェクトコンテキスト

このファイルは Claude Code が起動時に自動的に読み込みます。

## 作業ルール

**必読**: `.claude/rules.md` に詳細なルールが記載されています。

このドキュメントには、以下の重要な情報が記載されています:
- ドキュメント確認の徹底
- 開発ワークフロー
- 技術スタックと規約
- コミットルール
- Claude固有のベストプラクティス

## プロジェクト概要

**メディアDevダッシュボード**: Webメディア事業の予実管理と分析を行う社内向けダッシュボード

### 技術スタック
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL), Supabase Edge Functions
- **Icons**: lucide-react

### 重要なドキュメント
- `docs/01_requirements/` - 要件定義
- `docs/02_design/` - デザイン定義
- `docs/03_architecture/` - アーキテクチャ
- `docs/04_development/` - 開発ガイドライン

## 🚨 絶対遵守事項（CRITICAL）

### **認証・RLSは実装禁止**
**開発フェーズでは、認証（Supabase Authentication）およびRLS（Row Level Security）を絶対に実装しないでください。**

- ❌ RLSポリシーの作成・有効化は**禁止**
- ❌ `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` は**禁止**
- ❌ `CREATE POLICY ...` は**禁止**
- ✅ 開発中は全データに認証なしでアクセス可能
- ✅ 本番リリース前に別途実装

**詳細**: `docs/04_development/development-guidelines.md` 参照

## 開発の基本方針

1. **データベース中心**: ビジネスロジックはSupabase側で実装
2. **段階的セキュリティ**: 初期は認証なし、最終段階でRLS実装
3. **モックデータ管理**: `src/lib/mock-data/` に一元管理

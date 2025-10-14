# 実装ログ

本文書は、メディアDevダッシュボードの実装内容を時系列で記録するものである。

---

## 2025-10-09: マイグレーションファイルの整理

### 不要ファイルの削除と名称統一

**削除したファイル（10個）:**
- 古い関数定義: `006_update_financial_summary_for_all_media.sql`, `007_create_daily_financial_summary.sql`, `008_update_financial_summary_with_rollup.sql`
- 重複したRLS設定: `004_disable_rls.sql`
- タイムスタンプ形式の古いファイル: `20251007000001_*.sql` ～ `20251007000005_*.sql`
- デバッグ関数: `999999999999_debug_budgets_function.sql`

**統一後のファイル構成（8個）:**
1. `001_initial_schema.sql` - 初期スキーマ
2. `002_seed_test_data.sql` - テストデータ
3. `003_auto_create_account_items.sql` - 勘定項目自動作成
4. `004_create_daily_tables.sql` - 日次テーブル作成
5. `005_create_daily_data_function.sql` - 日次データ取得RPC関数
6. `006_update_import_function_for_daily.sql` - 日次対応インポート関数
7. `007_disable_all_rls.sql` - 全RLS無効化
8. `008_create_monthly_data_function.sql` - 月次データ取得RPC関数

**変更内容:**
- 全ファイルを `00N_description.sql` 形式に統一
- 連番でスキップなし（001→008）
- 開発の時系列に沿った順序

---

### デバッグコードのクリーンアップ

**削除したコード:**
- `/src/app/dashboard/financials/page.tsx`: 日次データの件数確認ログ
- `/src/components/financials/financials-client.tsx`: 9/9データ存在確認ログ

**残したコード:**
- エラーハンドリング用のconsole.error（トラブルシューティングに有用）

---

## 2025-10-08 (続き): 日次・週次・月次表示機能の実装

### Supabase Data API設定変更

**問題:**
- 全メディア表示で9/8以降のデータが表示されない
- 原因: Supabase Data APIのデフォルト最大行数制限（1000行）

**解決策:**
- Supabase管理画面で Data API Max rows を 100000 に変更
- コード側の回避策（`.limit()`, `.range()`）は不要

**影響範囲:**
- 全メディア: 3メディア × 10項目 × 365日 = 約10,950行 → 全て取得可能に
- 個別メディア: 1メディア × 10項目 × 365日 = 約3,650行 → 元から問題なし

---

### 表示単位切り替え機能

**実装内容:**
- 月次・週次・日次の3つの表示単位をToggleGroupで切り替え
- 各表示単位で適切なデータを取得・表示

**データ取得戦略:**
- **月次表示**: `budgets`/`actuals` テーブルから直接取得（`get_financial_monthly_data`）
  - TSV/CSVでアップロードした元データをそのまま表示
  - 端数ロスなし
- **日次・週次表示**: `daily_budgets`/`daily_actuals` テーブルから取得（`get_financial_daily_data`）
  - 月次データを日次に展開したデータを使用
  - 週次は日次データをフロントエンドで集計

**技術的な実装:**
- 月次・日次データの両方をサーバー側で並列取得（`Promise.all`）
- クライアント側で表示単位に応じて使い分け
- 日付計算時のタイムゾーン問題を解決（`toISOString()` → ローカル日付文字列生成）

**関連ファイル:**
- `/src/components/financials/financials-client.tsx`
- `/src/app/dashboard/financials/page.tsx`
- `/supabase/migrations/008_create_monthly_data_function.sql`

---

### 日次テーブルの追加

**実装内容:**
- `daily_budgets` テーブル: 日次予算データ
- `daily_actuals` テーブル: 日次実績データ

**データ展開ロジック:**
- TSV/CSVインポート時に月次データを日次に自動展開
- 月次予算額 ÷ 日数 = 日次予算額（整数除算）
- 各日に均等分配
- `generate_series` を使用して確実に月初から月末までデータを生成

**技術的な実装:**
```sql
-- 月の日数を計算
days_in_month := EXTRACT(DAY FROM (month_end_date))::integer;
daily_budget_amount := ((val->>'budget')::numeric / days_in_month)::integer;

-- generate_seriesで確実に全日分を生成
INSERT INTO public.daily_budgets (date, amount, media_id, account_item_id)
SELECT
    d::date,
    daily_budget_amount,
    p_media_id,
    child_item_id
FROM generate_series(month_start_date, month_end_date, '1 day'::interval) AS d;
```

**関連ファイル:**
- `/supabase/migrations/004_create_daily_tables.sql`
- `/supabase/migrations/006_update_import_function_for_daily.sql`

---

### 日付計算のバグ修正

**問題:**
- 日次表示で6/1が0、6/2から数値が表示される
- `toISOString()` によるタイムゾーン変換で日付が1日ずれる

**解決策:**
- `toISOString()` を使わず、ローカル日付から直接 `YYYY-MM-DD` 形式の文字列を生成
```typescript
const year = currentDate.getFullYear();
const month = String(currentDate.getMonth() + 1).padStart(2, '0');
const day = String(currentDate.getDate()).padStart(2, '0');
const dateKey = `${year}-${month}-${day}`;
```

**関連ファイル:**
- `/src/components/financials/financials-client.tsx`

---

### ダークモード対応

**実装内容:**
- テーブルビューのダークモード対応
- パンくずリストのテキストサイズ調整

**技術的な実装:**
- `bg-white` → `bg-background`
- `bg-gray-50` → `bg-muted/50`
- `text-sm` → `text-xs` (breadcrumb)

**関連ファイル:**
- `/src/components/financials/financials-table.tsx`
- `/src/components/ui/breadcrumb.tsx`

---

### RLS無効化

**実装内容:**
- 開発環境用に全テーブルのRLSを無効化

**対象テーブル:**
- media, account_items, asps, users, user_media_assignments
- budgets, actuals, daily_budgets, daily_actuals

**関連ファイル:**
- `/supabase/migrations/007_disable_all_rls.sql`

---

### app_settings テーブルの追加

**実装内容:**
- アプリケーション全体の設定を管理するテーブル
- 会計年度開始月を設定可能に（デフォルト: 6月）

**初期データ:**
```sql
INSERT INTO public.app_settings (key, value, description)
VALUES ('fiscal_year_start_month', '6', 'The starting month of the fiscal year (1-12).');
```

**使用箇所:**
- `get_financial_monthly_data` RPC関数
- `get_financial_daily_data` RPC関数
- `import_financial_data` 関数

**関連ファイル:**
- `/supabase/migrations/001_initial_schema.sql` に含まれる

---

## 2025-10-08: 予実管理機能の実装

### TSV/CSVインポート機能

**実装内容:**
- TSV形式を推奨形式として採用（カンマ入り数値に対応）
- CSV形式もサポート（警告表示付き）
- 3種類のテンプレート提供
  - 予算・実績両方
  - 予算のみ
  - 実績のみ

**技術的な実装:**
- ファイル形式の自動判別（拡張子 + ヘッダー内のタブ文字検出）
- カンマ区切り数値の自動除去（`.replace(/,/g, '')`）
- 部分更新モード：指定した親項目配下のみ更新、他項目は保持

**関連ファイル:**
- `/src/components/financials/account-items-import.tsx`
- `/src/app/api/financials/import/route.ts`

**CSV/TSV形式:**
```tsv
parent	account_item	4月予算	4月実績	5月予算	5月実績
売上	広告収入	1,000,000	950,000	1,200,000	1,100,000
売上	制作収入	500,000	480,000	550,000	520,000
費用	人件費	800,000	800,000	800,000	800,000
```

---

### 勘定項目削除機能

**実装内容:**
- 個別削除：各行のゴミ箱アイコン
- 複数選択削除：チェックボックス + 一括削除ボタン
- 全選択：ヘッダーのチェックボックス
- 削除前の確認ダイアログ
- 削除後の自動リフレッシュ

**技術的な実装:**
- React State で選択状態を管理（`Set<string>`）
- 削除中の二重送信防止（`isDeleting` state）
- 削除API: `/api/account-items/delete`

**関連ファイル:**
- `/src/components/financials/financials-table.tsx`
- `/src/app/api/account-items/delete/route.ts`

---

### ロールアップ集計機能

**実装内容:**
- 子項目の合計を親項目に自動集計
- PostgreSQLの再帰的CTEで実装
- 全ての階層レベルに対応

**技術的な実装:**
```sql
WITH RECURSIVE item_hierarchy AS (
    -- 各項目を自身の祖先として登録
    SELECT id AS ancestor_id, id AS descendant_id
    FROM account_items
    UNION ALL
    -- 子項目を辿って階層を構築
    SELECT h.ancestor_id, i.id AS descendant_id
    FROM account_items i
    JOIN item_hierarchy h ON i.parent_id = h.descendant_id
)
-- 子孫の値を祖先に集計
SELECT ancestor_id, SUM(amount)
FROM monthly_data md
JOIN item_hierarchy h ON md.account_item_id = h.descendant_id
GROUP BY ancestor_id
```

**マイグレーション:**
- `/supabase/migrations/008_update_financial_summary_with_rollup.sql`
- 既存の `get_financial_summary` 関数を置き換え

---

### フィルター機能（Supabase風UI）

**実装内容:**
- ポップオーバー形式のフィルターパネル
- 会計年度選択（現在年度±5年）
- 表示項目選択（予実比較 / 予算のみ / 実績のみ）
- アクティブフィルター表示（タグ形式、個別解除可能）

**技術的な実装:**
- `Popover` コンポーネント（shadcn/ui）
- URL query parameters で状態管理
- `viewMode` state でテーブル列の表示切り替え

**関連ファイル:**
- `/src/components/financials/financials-client.tsx`

---

### 日次データダイアログ

**実装内容:**
- 月次テーブルの月ヘッダーをクリックで表示
- 1日〜31日の日次予算・実績を表示
- RPC関数で日次データを取得

**技術的な実装:**
- `get_daily_financial_summary` RPC関数
- ダイアログコンポーネント（shadcn/ui）
- 横スクロール対応の広いテーブル

**マイグレーション:**
- `/supabase/migrations/007_create_daily_financial_summary.sql`

**関連ファイル:**
- `/src/components/financials/daily-data-dialog.tsx`

---

## マイグレーション履歴

**最新（2025-10-09整理後）:**

1. `001_initial_schema.sql` - 初期スキーマ（テーブル定義 + app_settings）
2. `002_seed_test_data.sql` - テストデータ投入
3. `003_auto_create_account_items.sql` - メディア作成時の勘定項目自動作成トリガー
4. `004_create_daily_tables.sql` - 日次テーブル（daily_budgets, daily_actuals）作成
5. `005_create_daily_data_function.sql` - 日次データ取得RPC関数
6. `006_update_import_function_for_daily.sql` - 日次対応インポート関数
7. `007_disable_all_rls.sql` - 全RLS無効化（開発環境）
8. `008_create_monthly_data_function.sql` - 月次データ取得RPC関数

---

## 技術スタック

### フロントエンド
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (UIコンポーネント)
- **Sonner** (トースト通知)

### バックエンド
- **Supabase (PostgreSQL)**
- **RPC Functions** (plpgsql)
- **Database Triggers**

### 開発ツール
- **Turbopack** (Next.js bundler)
- **ESLint**
- **Git**

---

## 未実装機能

### Phase 2
- [ ] CSVエクスポート機能
- [ ] インライン編集機能（セル単位での直接編集）

### Phase 3
- [ ] 月次予算からの日次自動ブレークダウン
- [ ] ローディング表示（スケルトンスクリーン）
- [ ] 空の状態の表示

---

## 既知の問題・制限事項

### 認証・セキュリティ
- **RLS無効**: 開発フェーズのため、Row Level Securityは無効化されている
- **認証なし**: 現在は認証機能が実装されていない
- **本番リリース前に必須**: Supabase Authentication + RLS の実装が必要

### データ制約
- **会計期開始月**: app_settingsで設定可能（デフォルト: 6月）。将来的には設定画面から変更可能にする予定
- **数値型**: `amount` カラムは `integer` 型（小数点以下は扱えない）
- **日次展開の端数**: 月次予算を日次に分配する際、整数除算により端数が発生する可能性あり

### Supabase設定
- **Data API Max rows**: 100000に設定（デフォルト1000では全メディアの年間データ取得時に不足）

---

## パフォーマンス最適化

### 実施済み
- データベース側での集計処理（RPC関数）
- 再帰的CTEによる階層構造の効率的な処理

### 今後の検討事項
- インデックスの最適化
- マテリアライズドビューの活用
- クエリキャッシュの実装

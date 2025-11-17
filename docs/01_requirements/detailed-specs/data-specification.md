# データ仕様書

このドキュメントは、me-media-dev-dashboardにおけるデータ保存・管理の仕様を定義します。

---

## 1. データ保存の基本ルール

### 1.1 日付の保存ルール

データの種類によって、保存する日付の形式が異なります。

| データ種別 | 保存先テーブル | 日付形式 | 例 |
|-----------|--------------|----------|-----|
| **日次データ** | `daily_actuals` | 実際の日付 | `2025-01-15` |
| **月次データ** | `actuals` | 月末日付 | `2025-01-31` |

#### ❌ 間違った例

```sql
-- 月次データを月初日付で保存（間違い）
INSERT INTO actuals (date, amount, ...)
VALUES ('2025-01-01', 100000, ...);
```

#### ✅ 正しい例

```sql
-- 月次データを月末日付で保存（正しい）
INSERT INTO actuals (date, amount, ...)
VALUES ('2025-01-31', 100000, ...);
```

#### 月末日付の計算方法（TypeScript）

```typescript
// 正しい月末日付の計算
const [year, month] = yearMonth.split('-'); // '2025-01'
const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
const monthEndDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
// 結果: '2025-01-31'
```

### 1.2 データ分離の原則

**⚠️ 最重要ルール: 日次データと月次データを絶対に合算しない**

日次データと月次データは、完全に独立したデータとして管理します。

```typescript
// ❌ 悪い例: 日次と月次を合算
const total = dailyAmount + monthlyAmount;  // 絶対にNG

// ✅ 良い例: 日次と月次を別々に扱う
await supabase.from('daily_actuals').insert({
  date: dailyDate,
  amount: dailyAmount,
  ...
});

await supabase.from('actuals').insert({
  date: monthEndDate,  // 月末日付
  amount: monthlyAmount,
  ...
});
```

---

## 2. ASPスクレイパーのデータ保存仕様

### 2.1 日次スクレイパー

ASPから取得した日次データを保存する際の仕様。

#### 保存先
- テーブル: `daily_actuals`
- 日付フィールド: `date`

#### 日付の設定
```typescript
const date = '2025-01-15';  // 実際の日付をそのまま使用
```

#### UPSERT（上書き保存）

既存データがある場合は上書きします。

```typescript
await supabase.from('daily_actuals').upsert(
  {
    date,
    amount,
    media_id,
    account_item_id,
    asp_id,
  },
  {
    onConflict: 'date,media_id,account_item_id,asp_id',
  }
);
```

### 2.2 月次スクレイパー

ASPから取得した月次データを保存する際の仕様。

#### 保存先
- テーブル: `actuals`
- 日付フィールド: `date`

#### 日付の設定（必ず月末）

```typescript
// YYYY-MM形式から月末日付を計算
const yearMonth = '2025-01';  // ASPから取得した年月

const [year, month] = yearMonth.split('-');
const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
const date = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
// 結果: '2025-01-31'
```

#### UPSERT（上書き保存）

```typescript
await supabase.from('actuals').upsert(
  {
    date,  // 必ず月末日付
    amount,
    media_id,
    account_item_id,
    asp_id,
  },
  {
    onConflict: 'date,media_id,account_item_id,asp_id',
  }
);
```

---

## 3. UNIQUE制約

### 3.1 日次データ

**制約**: `(date, media_id, account_item_id, asp_id)`

同じ日付・メディア・勘定科目・ASPの組み合わせは1件のみ保存できます。

### 3.2 月次データ

**制約**: `(date, media_id, account_item_id, asp_id)`

同じ月末日付・メディア・勘定科目・ASPの組み合わせは1件のみ保存できます。

---

## 4. データ取得仕様

### 4.1 RPC関数

#### 日次データ取得

```sql
-- 関数: get_asp_daily_data(p_media_id uuid, p_asp_id uuid, p_start_date date, p_end_date date)
-- テーブル: daily_actuals のみ使用
```

#### 月次データ取得

```sql
-- 関数: get_asp_monthly_data(p_media_id uuid, p_asp_id uuid, p_fiscal_year integer)
-- テーブル: actuals のみ使用
```

**重要**: 月次データ取得時に `daily_actuals` テーブルを参照しないこと

---

## 5. データ整合性チェック

### 5.1 月末日付チェック

月次データの日付が正しく月末になっているかチェックします。

```typescript
// 日付が月末かチェックする関数
function isMonthEnd(dateString: string): boolean {
  const date = new Date(dateString);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  // 次の日が翌月の1日ならtrue
  return nextDay.getDate() === 1;
}

// 使用例
isMonthEnd('2025-01-31');  // true
isMonthEnd('2025-02-28');  // true
isMonthEnd('2025-02-01');  // false (月初)
```

### 5.2 重複チェック

UNIQUE制約により、同じキーでの重複挿入は自動的にエラーになります。

UPSERTを使用することで、重複を避けつつデータを更新できます。

---

## 6. データ移行・修正時の注意事項

### 6.1 月初日付で保存されたデータの修正

もし月初日付（例: `2025-01-01`）で保存されている月次データがある場合：

1. 既存データを削除
2. 正しい月末日付で再挿入

```typescript
// 間違った日付で保存されているデータを修正
const wrongDate = '2025-01-01';
const correctDate = '2025-01-31';

// 1. 削除
await supabase
  .from('actuals')
  .delete()
  .eq('date', wrongDate)
  .eq('asp_id', aspId);

// 2. 正しい日付で再挿入
await supabase.from('actuals').insert({
  date: correctDate,  // 月末日付
  amount: oldData.amount,
  media_id: oldData.media_id,
  account_item_id: oldData.account_item_id,
  asp_id: oldData.asp_id,
});
```

---

## 7. テスト仕様

### 7.1 必須テスト項目

全てのスクレイパーは以下のテストに合格する必要があります：

1. ✅ 日次データが正しいテーブルに保存される
2. ✅ 月次データが月末日付で保存される
3. ✅ データの重複がない
4. ✅ 日次と月次が合算されていない
5. ✅ UPSERT機能が正常動作する
6. ✅ 週次集計が可能（日次データから）

テストスクリプト: `src/scripts/test-scraper-data.ts`

---

## 8. 参考資料

### 8.1 関連ドキュメント

- [データベース設計](../../03_architecture/database-design.md)
- [スクレイパー実装ガイド](../../04_development/scrapers/guide.md)
- [スクレイパーテストチェックリスト](../../04_development/scrapers/testing.md)

### 8.2 実装例

実際のスクレイパー実装は以下を参照：

- 日次スクレイパー例: `apps/dashboard/src/scripts/linkag-daily-scraper.ts`
- 月次スクレイパー例: `apps/dashboard/src/scripts/utils/linkag-monthly-scraper.ts`

---

最終更新日: 2025-11-04

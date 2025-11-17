# A8.net 日次データ取得シナリオ

**ASP名**: A8.net
**取得データ**: 日別の確定報酬データ
**ターゲットテーブル**: daily_actuals

---

## シナリオステップ

1. A8.netのログインページ (https://www.a8.net/) にアクセス
2. ユーザー名フィールド (input[name="login"]) に {SECRET:A8NET_USERNAME} を入力
3. パスワードフィールド (input[name="passwd"]) に {SECRET:A8NET_PASSWORD} を入力
4. ログインボタン (input[name="login_as_btn"]) をクリック
5. 待機 (3000ms)
6. 「レポート」メニューをクリック
7. 待機 (2000ms)
8. 「成果報酬」メニューをクリック
9. 待機 (3000ms)
10. 「日別」タブをクリック
11. 待機 (3000ms)
12. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存

---

## データ抽出の詳細

### 抽出指示
```
最初のテーブルから、日別の確定報酬データを抽出してください。
各行には日付（YYYY/MM/DD形式）と確定報酬額（円、カンマ区切り）が含まれています。

以下のJSON形式で返してください：
{
  "data": [
    {"date": "2025-11-01", "amount": 1500},
    {"date": "2025-11-02", "amount": 2300},
    ...
  ]
}

日付は YYYY-MM-DD 形式に変換してください。
金額はカンマと「円」を除いた数値のみを返してください。
```

### 必要なメタデータ
- **media_id**: メディアのUUID（Supabaseから取得）
- **account_item_id**: 勘定科目のUUID（Supabaseから取得）
- **asp_id**: ASPのUUID（Supabaseから取得）

---

## Supabaseへの登録方法

Supabaseの `asps` テーブルに以下のように登録：

```sql
UPDATE asps
SET prompt = '
1. A8.netのログインページ (https://www.a8.net/) にアクセス
2. ユーザー名フィールド (input[name="login"]) に {SECRET:A8NET_USERNAME} を入力
3. パスワードフィールド (input[name="passwd"]) に {SECRET:A8NET_PASSWORD} を入力
4. ログインボタン (input[name="login_as_btn"]) をクリック
5. 待機 (3000ms)
6. 「レポート」メニューをクリック
7. 待機 (2000ms)
8. 「成果報酬」メニューをクリック
9. 待機 (3000ms)
10. 「日別」タブをクリック
11. 待機 (3000ms)
12. テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存
'
WHERE name = 'A8.net';
```

---

## 注意事項

1. **認証情報**: 環境変数 `A8NET_USERNAME` と `A8NET_PASSWORD` が必要
2. **待機時間**: ページ読み込みを待つために適切な待機時間を設定
3. **エラーハンドリング**: ログイン失敗時やテーブルが見つからない場合のハンドリング
4. **スクリーンショット**: 各ステップでスクリーンショットを保存してデバッグに活用

---

**作成日**: 2025-11-10

# JSON形式シナリオの設計方針

## 重要な方針

**AI API（Claude/Gemini）を一切使用しない**

- JSON形式シナリオではClaude APIやGemini APIを使用しない
- すべてのセレクタとアクションは人間（ClaudeCode）が直接記述する
- Playwrightで直接DOM操作とデータ抽出を行う

## 背景

以前の実装では、自然言語でシナリオを記述し、Gemini APIでステップごとに解釈していました。
しかし、この方法には以下の問題がありました：

1. Gemini APIの解釈が不安定（同じ指示でも異なるセレクタを生成）
2. API呼び出しのコストと遅延
3. 複雑なセレクタ変換ロジックが必要

## JSON形式シナリオの利点

1. **決定論的**: 同じシナリオは常に同じ動作をする
2. **高速**: AI APIを呼ばないため実行が速い
3. **メンテナンス性**: セレクタが明示的で理解しやすい
4. **コスト削減**: API呼び出しが不要

## シナリオ形式

```json
[
  {"action": "navigate", "value": "https://example.com"},
  {"action": "wait", "value": "2000"},
  {"action": "fill", "selector": "input[type='text']", "value": "{SECRET:USERNAME}"},
  {"action": "fill", "selector": "input[type='password']", "value": "{SECRET:PASSWORD}"},
  {"action": "click", "selector": "button[type='submit']"},
  {"action": "hover", "selector": "text=レポート"},
  {"action": "click", "selector": "text=成果報酬"},
  {"action": "wait", "value": "3000"},
  {
    "action": "extract",
    "selector": "table.data-table",
    "target": "daily_actuals",
    "extract_config": {
      "type": "table",
      "columns": ["date", "amount"],
      "date_column": "date",
      "amount_column": "amount"
    }
  }
]
```

## サポートされるアクション

### navigate
```json
{"action": "navigate", "value": "https://example.com"}
```

### wait
```json
{"action": "wait", "value": "2000"}
```
ミリ秒単位で待機

### fill
```json
{"action": "fill", "selector": "input[type='text']", "value": "text"}
```
`{SECRET:KEY_NAME}`形式でasp_credentialsから取得可能

### click
```json
{"action": "click", "selector": "button"}
```

### hover
```json
{"action": "hover", "selector": "text=レポート"}
```

### extract
```json
{
  "action": "extract",
  "selector": "table",
  "target": "daily_actuals",
  "extract_config": {
    "type": "table",
    "columns": ["date", "amount"],
    "date_column": "date",
    "amount_column": "amount"
  }
}
```

`extract_config`でデータ抽出方法を明示的に指定します。
AI APIは使用せず、Playwrightで直接DOM要素を取得してパースします。

## extract actionの実装方針

### テーブル抽出

1. `selector`でテーブルを特定
2. Playwrightの`locator()`で`<tr>`要素を取得
3. 各行から`<td>`または`<th>`を取得
4. `extract_config.columns`の順序でデータをマッピング
5. 日付と金額をパースしてJSON形式で返す

```python
# 疑似コード
table = page.locator(selector)
rows = table.locator("tr").all()
data = []
for row in rows:
    cells = row.locator("td, th").all()
    row_data = {
        "date": parse_date(cells[0].inner_text()),
        "amount": parse_amount(cells[1].inner_text())
    }
    data.append(row_data)
```

### リスト抽出

```json
{
  "action": "extract",
  "selector": "ul.items",
  "target": "items",
  "extract_config": {
    "type": "list",
    "item_selector": "li",
    "fields": {
      "title": ".title",
      "value": ".value"
    }
  }
}
```

## セレクタのガイドライン

### 推奨セレクタ

- CSS セレクタ: `input[type='text']`, `.class-name`, `#id`
- テキストセレクタ: `text=ログイン`, `text=レポート`
- 属性セレクタ: `button[value='Submit']`

### 非推奨セレクタ

- jQuery拡張: `:contains()`, `:has()` (Playwrightでサポートされない)
- 複雑な擬似セレクタ: `:first-of-type`, `:nth-of-type()` (`.first`メソッドを使用)
- XPath: 可読性が低い

## データ保存

抽出したデータは`target`で指定したテーブルに保存されます：

- `daily_actuals`: 日次データ → `daily_actuals`テーブル
- `monthly_actuals`: 月次データ → `actuals`テーブル

各レコードには以下のメタデータが自動的に追加されます：
- `media_id`: メディアID
- `asp_id`: ASP ID
- `account_item_id`: 勘定科目ID

## 実装ファイル

- `core/orchestrator.py`: シナリオ実行エンジン
  - `_parse_scenario()`: JSON形式のパース
  - `_execute_command()`: アクション実行
  - extract actionは**AI APIを使用せず**、Playwrightで直接抽出
- `update_a8net_scenario.py`: A8.net用シナリオ生成スクリプト

## メンテナンス

新しいASPのシナリオを追加する際：

1. ブラウザでASPサイトにアクセス
2. DevToolsでセレクタを確認
3. JSON形式でシナリオを記述
4. `update_*_scenario.py`スクリプトを作成
5. Supabaseの`asps`テーブルに保存
6. テスト実行

## 注意事項

- **絶対にAI APIを使用しない**: extract actionも含めて、すべてPlaywright直接操作
- セレクタは実際のDOM構造を確認して記述する
- wait時間は余裕を持たせる（ページロード待ち）
- エラー時のログを確認してセレクタを調整

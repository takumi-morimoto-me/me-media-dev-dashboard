# 新しいスクレイピングシステム

## 概要

このシステムは、LLMを使って**Pythonスクリプトを生成**し、それを**実行**し、エラー時に**自動修復**する3段階のアーキテクチャを採用しています。

## アーキテクチャ

```
YAML Scenario → [Generator] → Python Script → [Executor] → Results
                                      ↓ (on error)
                                  [Healer] → Fixed Script
```

### コンポーネント

1. **ScraperGenerator** (`core/scraper_generator.py`)
   - YAMLシナリオからPythonスクリプトを生成
   - LLM (Gemini) を使用
   - 生成されたコードを `scrapers/{asp_name}/{execution_type}.py` に保存
   - メタデータ (生成日時、YAMLハッシュ) を記録

2. **ScraperExecutor** (`core/scraper_executor.py`)
   - 生成されたPythonスクリプトをサブプロセスで実行
   - 実行ログをデータベースに記録
   - エラー時にHealerを呼び出す

3. **ScraperHealer** (`core/scraper_healer.py`)
   - エラーが発生したスクリプトを分析
   - LLMを使ってエラーを修正
   - 修正されたコードを保存 (バックアップ付き)

## ディレクトリ構造

```
apps/mcp-agent/
├── core/
│   ├── scraper_generator.py    # スクリプト生成
│   ├── scraper_executor.py     # スクリプト実行
│   └── scraper_healer.py       # エラー修復
├── scenarios/                   # YAMLシナリオ (仕様定義)
│   ├── a8net.yaml
│   ├── afb.yaml
│   └── ...
├── scrapers/                    # 生成済みスクリプト
│   ├── a8net/
│   │   ├── daily.py
│   │   ├── monthly.py
│   │   └── metadata.json
│   ├── affitown/
│   │   └── daily.py
│   └── ...
└── tools/
    └── scraper_cli.py          # CLI管理ツール
```

## 使い方

### 1. スクレイパーの生成

```bash
python3 tools/scraper_cli.py generate a8net --type daily
```

YAMLシナリオからPythonスクリプトを生成します。

### 2. スクレイパーの実行

```bash
python3 tools/scraper_cli.py execute a8net --type daily
```

生成されたスクリプトを実行します。スクリプトが存在しない場合は自動生成されます。

### 3. 全スクレイパーの実行

```bash
python3 tools/scraper_cli.py execute-all --type daily
```

すべてのスクレイパーを実行します。

### 4. スクレイパーの修復

```bash
python3 tools/scraper_cli.py heal a8net --type daily --error "Error message"
```

エラーが発生したスクレイパーを修復します。

### 5. スクレイパーの一覧表示

```bash
python3 tools/scraper_cli.py list
```

利用可能なスクレイパーを一覧表示します。

## 生成されるスクリプトの形式

```python
from playwright.sync_api import sync_playwright
from supabase import create_client
import os

def run_scraper():
    """ASP名 実行タイプ データ取得スクレイパー"""
    
    # Supabase接続
    client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))
    
    # スクレイピングロジック
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # ログイン、ナビゲーション、データ抽出
        # ...
        
        browser.close()
    
    # 結果を返す
    return {"success": True, "records_saved": 10}

if __name__ == "__main__":
    result = run_scraper()
    print(f"Result: {result}")
```

## メリット

### 従来のアプローチ (LLMリアルタイム実行)
- ❌ コストが高い (毎回LLM呼び出し)
- ❌ 遅い (LLMのレスポンス待ち)
- ❌ デバッグが困難
- ❌ 不安定

### 新しいアプローチ (コード生成→実行→修復)
- ✅ コスト削減 (生成・修復時のみLLM呼び出し)
- ✅ 高速 (生成済みスクリプトの実行は高速)
- ✅ デバッグ可能 (生成されたコードをレビュー・改善可能)
- ✅ 安定性向上 (同じコードで繰り返し実行)

## 今後の改善点

1. **LLM API クォータ管理**
   - 現在、Gemini APIの無料枠を使用しているため、クォータ制限に注意
   - 必要に応じて有料プランへの移行を検討

2. **スクリプトのバージョン管理**
   - 修復時のバックアップは実装済み
   - Gitによるバージョン管理も検討

3. **テストの自動化**
   - 生成されたスクリプトの自動テスト
   - CI/CDパイプラインへの統合

4. **エラー通知の改善**
   - Slack通知との統合
   - エラーパターンの分析と自動修復の改善

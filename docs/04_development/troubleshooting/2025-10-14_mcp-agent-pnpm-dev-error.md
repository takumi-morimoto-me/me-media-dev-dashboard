# mcp-agent の pnpm dev 実行エラー

- **日付**: 2025-10-14
- **関連パッケージ**: `apps/mcp-agent`

---

## 1. 現象

`pnpm dev` を実行した際、以下のエラーが発生してPythonスクリプトが起動しない。

### エラー1: pythonコマンドが見つからない
```
sh: python: command not found
```

### エラー2: モジュールが見つからない
```
ModuleNotFoundError: No module named 'dotenv'
```

## 2. 原因

### 原因1: macOSではpythonコマンドが存在しない
macOSのデフォルトでは`python`コマンドではなく`python3`コマンドを使用する必要がある。

### 原因2: 仮想環境が有効化されていない
ローカル開発環境では、Pythonパッケージが`venv`ディレクトリ内にインストールされているため、仮想環境を有効化しないとPythonがモジュールを見つけられない。

## 3. 解決策

`package.json`の`dev`スクリプトを以下のように修正した。

**修正前:**
```json
{
  "scripts": {
    "dev": "python main.py"
  }
}
```

**修正後:**
```json
{
  "scripts": {
    "dev": "bash -c 'source venv/bin/activate && python main.py'"
  }
}
```

### 修正内容の説明

1. `bash -c '...'` でシェルコマンドを実行
2. `source venv/bin/activate` で仮想環境を有効化
3. `python main.py` でスクリプトを実行（venv内のpythonが使われる）

## 4. ローカル開発 vs デプロイ環境

### ローカル開発環境
- システムのPython環境と開発環境を分離するため`venv`を使用
- `pnpm dev`実行時に仮想環境を明示的に有効化する必要がある

### GCPデプロイ環境（Docker）
- Dockerコンテナ内で動作するため、`venv`は不要
- Dockerfile内で全ての依存関係がコンテナイメージにインストール済み
- `CMD ["python", "main.py"]` で直接実行可能

## 5. まとめ

- macOSでは`python3`コマンドを使用する
- ローカル開発時は仮想環境の有効化が必要
- デプロイ環境（Docker）では仮想環境不要で動作する

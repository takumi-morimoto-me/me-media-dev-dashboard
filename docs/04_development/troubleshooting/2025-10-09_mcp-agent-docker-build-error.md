# mcp-agentのDockerビルドにおけるpip installの失敗

- **発生日時**: 2025年10月9日
- **解決日時**: 2025年10月14日
- **関連パッケージ**: `apps/mcp-agent`

---

## 1. 現象

`pnpm build` を実行した際、`apps/mcp-agent` のビルドプロセス（`docker build`）が失敗する。

Dockerfile内の `RUN pip install -r requirements.txt` を実行するステップで、特定のパッケージを展開（解凍）する際に以下のエラーが発生し、プロセスが停止する。

```
zlib.error: Error -3 while decompressing data: invalid distance too far back
```

このエラーは、`pip`がダウンロードしたパッケージファイルが破損しているか、展開処理に失敗していることを示唆している。


## 2. これまでに試したこと

以下の解決策を試したが、いずれも同じエラーで失敗した。

1.  **Dockerビルドキャッシュの無効化**
    -   **内容**: `docker build` コマンドに `--no-cache` オプションを追加。
    -   **結果**: 状況は変わらず。キャッシュの問題ではない可能性が高い。

2.  **`pip` のアップグレード**
    -   **内容**: `pip install` を実行する前に、`RUN python -m pip install --upgrade pip` をDockerfileに追加。
    -   **結果**: `pip` は正常にアップグレードされたが、その後のライブラリインストールで同じ `zlib.error` が発生。


## 3. 原因の推測

キャッシュや`pip`のバージョンが直接の原因ではない可能性が高まったため、以下のいずれかが原因であると推測される。

-   **ネットワークの問題**: Dockerコンテナ内からパッケージリポジトリ（PyPI）へのネットワーク経路上で、ダウンロードファイルが頻繁に破損している。
-   **Docker環境の問題**: Docker Desktopの設定や、使用しているベースイメージ (`mcr.microsoft.com/playwright/python:v1.40.0-jammy`) とローカル環境との間に、ファイル展開を妨げる何らかの非互換性が存在する。


## 4. 実施した調査と発見

### 4.1 ローカル環境でのテスト（2025年10月14日）

問題の切り分けのため、ローカル環境でPythonのライブラリが正常にインストールできるかを確認した。

**手順**:
```bash
cd apps/mcp-agent
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**結果**: **すべてのパッケージが正常にインストールできた**

この結果から、問題はDocker環境に特有であることが確定した。

### 4.2 試したその他の解決策

3. **タイムアウトと再試行メカニズムの追加**
   - **内容**: `pip install`に`--timeout=120 --retries=5`オプションを追加
   - **結果**: 同じ`zlib.error`が発生

4. **ベースイメージの変更**
   - **内容**: `mcr.microsoft.com/playwright/python:v1.40.0-jammy`から`python:3.10-slim`に変更
   - **結果**: 同じエラーが継続

## 5. 根本原因

**Apple Silicon（ARM64）環境でのDocker内でのPyPIパッケージダウンロード時の断続的なzlib解凍エラー**

- ローカル環境では問題なくインストールできるが、Docker環境内では特定のパッケージのダウンロード・展開時にzlibエラーが発生
- エラーは一貫性がなく、どのパッケージで失敗するかはビルドごとに異なる
- これはDockerコンテナ内でのネットワーク層またはファイルシステム層での問題と推測される

## 6. 解決策

**パッケージを個別にインストールし、失敗時に再試行する方式を採用**

Dockerfileを以下のように変更した：

```dockerfile
# ベースイメージをplaywright専用からpython公式に変更
FROM python:3.10-slim

# パッケージを小さなグループに分けて個別インストール
# 各グループで失敗した場合はキャッシュをクリアして再試行
RUN pip install --no-cache-dir python-dotenv ruff black || \
    (pip cache purge && pip install --no-cache-dir python-dotenv ruff black)

RUN pip install --no-cache-dir supabase || \
    (pip cache purge && pip install --no-cache-dir supabase)

RUN pip install --no-cache-dir google-cloud-secret-manager google-cloud-aiplatform || \
    (pip cache purge && pip install --no-cache-dir google-cloud-secret-manager google-cloud-aiplatform)

RUN pip install --no-cache-dir playwright || \
    (pip cache purge && pip install --no-cache-dir playwright)

RUN playwright install --with-deps chromium
```

**結果**: ビルドが正常に完了した

## 7. まとめ

- 問題はDocker環境特有で、Apple Silicon環境でのパッケージダウンロード時の断続的な問題
- パッケージを個別にインストールし、失敗時の再試行メカニズムを組み込むことで解決
- ベースイメージも`python:3.10-slim`に変更し、Playwrightは後からインストールする方式に変更

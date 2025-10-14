# 1. ベースイメージの指定
FROM python:3.10-slim

# 2. 作業ディレクトリの設定
WORKDIR /app

# 3. 依存関係ファイルのコピー
COPY requirements.txt .

# 4. pipをアップグレード
RUN python -m pip install --upgrade pip

# 5. システム依存関係のインストール（Playwrightに必要）
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# 6. pipのインストールを個別に実行して、エラーが出たパッケージを特定
# まず小さなパッケージから
RUN pip install --no-cache-dir python-dotenv ruff black || \
    (pip cache purge && pip install --no-cache-dir python-dotenv ruff black)

# 次にsupabase関連
RUN pip install --no-cache-dir supabase || \
    (pip cache purge && pip install --no-cache-dir supabase)

# Google Cloud関連
RUN pip install --no-cache-dir google-cloud-secret-manager google-cloud-aiplatform || \
    (pip cache purge && pip install --no-cache-dir google-cloud-secret-manager google-cloud-aiplatform)

# 最後にPlaywright
RUN pip install --no-cache-dir playwright || \
    (pip cache purge && pip install --no-cache-dir playwright)

# 7. Playwrightブラウザのインストール
RUN playwright install --with-deps chromium

# 8. アプリケーションコードのコピー
COPY . .

# 9. アプリケーションの実行コマンド
CMD ["python", "main.py"]

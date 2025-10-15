# モノレポ化に伴うGit管理の問題と解決

## 日付
2025-10-14

## 問題
モノレポ化した際、ビルド成果物（`.next/`、`.turbo/`など）がGit管理下に残っており、コミット・プッシュ時に問題が発生していた。

## 症状
- `git status`で大量のビルド成果物ファイルが表示される
- `.next/`や`.turbo/`ディレクトリ内のファイルが追跡されている
- これらのファイルはビルド時に自動生成されるため、バージョン管理する必要がない

## 原因
1. モノレポ構造に変更する前の`.gitignore`が不完全だった
2. 過去にビルド成果物がGitキャッシュに追加されていた
3. `.gitignore`を更新してもすでにキャッシュされたファイルは追跡され続ける

## 解決方法

### 1. .gitignoreの更新
モノレポ構造に対応した`.gitignore`を作成：

```gitignore
# dependencies
node_modules/
.pnp
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/versions

# testing
coverage/

# next.js
.next/
out/

# production
build/
dist/

# misc
.DS_Store
*.pem

# turbo
.turbo/

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
pnpm-debug.log*

# env files
.env
.env*.local
!.env.example

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# Python (for mcp-agent)
venv/
.venv/
__pycache__/
*.py[cod]
*.egg-info/
.pytest_cache/

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~
```

### 2. Gitキャッシュからビルド成果物を削除

既に追跡されているファイルをGitキャッシュから削除：

```bash
git rm -rf --cached apps/dashboard/.next apps/dashboard/.turbo
```

このコマンドで：
- `--cached`: ファイルシステムからは削除せず、Gitの追跡のみ解除
- `-rf`: ディレクトリを再帰的に削除

### 3. 変更をコミット

```bash
git add -A
git commit -m "chore: remove build artifacts from git tracking

Cleaned up .gitignore for monorepo structure and removed all build artifacts (.next/, .turbo/) from git tracking. Build artifacts should not be committed to version control.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 4. リモートにプッシュ

```bash
git push origin main
```

## 結果
- ビルド成果物がGit管理から除外された
- 539ファイル、約395,000行のビルド成果物が削除された
- `git status`が`working tree clean`を表示するようになった
- 今後のビルドで生成されるファイルは自動的に無視される

## 学んだこと
1. `.gitignore`を更新しても既存の追跡ファイルには影響しない
2. `git rm --cached`でGitキャッシュをクリーンアップする必要がある
3. モノレポ構造では各アプリのビルド成果物パターンを網羅的に指定する
4. Python開発環境（venv）やIDEファイルも忘れずに除外する

## 関連ドキュメント
- [.gitignore patterns](https://git-scm.com/docs/gitignore)
- [git rm documentation](https://git-scm.com/docs/git-rm)

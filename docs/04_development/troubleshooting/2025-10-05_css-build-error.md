# CSS Build Error Log

- **Date:** 2025-10-05
- **Error:** `CssSyntaxError: Can't resolve 'tw-animate-css'`

## 概要 (Summary)
`shadcn/ui` 初期化後、`npm run build` を実行した際にCSSの解決エラーが発生した。

## 原因 (Cause)
`shadcn/ui` の初期化スクリプトが `globals.css` に以下の2行を追記した。
```css
@plugin "tailwindcss-animate";
@import "tw-animate-css";
```
しかし、`tailwindcss-animate` パッケージが未インストールであり、かつ `@import "tw-animate-css";` は不正な記述だったため、ビルドに失敗した。

## 解決策 (Resolution)
1.  `npm install tailwindcss-animate` を実行して、必要なプラグインをインストールした。
2.  `globals.css` から `@import "tw-animate-css";` の行を削除した。

#!/bin/bash
# 全ASPの月次スクレイパーを順次実行するスクリプト

cd /Users/t.morimoto/Desktop/me-media-dev-dashboard/apps/dashboard

ASPS=(
  "a8net"
  "a8app"
  "accesstrade"
  "afb"
  "amazon"
  "castalk"
  "circuitx"
  "dmm"
  "docomo-affiliate"
  "felmat"
  "imobile"
  "janet"
  "linkag"
  "linkshare"
  "moshimo"
  "presco"
  "ratelad"
  "rentracks"
  "skyflag"
  "slvrbullet"
  "smaad"
  "smartc"
  "tg-affiliate"
  "ultiga"
  "valuecommerce"
  "zucks"
)

SUCCESS=0
FAILED=0
SKIPPED=0

echo "============================================================"
echo "全ASP月次スクレイパー実行開始"
echo "============================================================"
echo ""
echo "対象ASP: ${#ASPS[@]}件"
echo "対象期間: 2025年1月〜10月"
echo ""

for asp in "${ASPS[@]}"; do
  echo "============================================================"
  echo "[$(($SUCCESS + $FAILED + $SKIPPED + 1))/${#ASPS[@]}] $asp (月次) を実行中..."
  echo "============================================================"

  if [ ! -f "src/scripts/asp/monthly/$asp/index.ts" ]; then
    echo "⚠️  $asp: 月次スクレイパーファイルが見つかりません（スキップ）"
    SKIPPED=$((SKIPPED + 1))
    echo ""
    sleep 2
    continue
  fi

  # 月次スクレイパーを実行
  pnpm exec tsx "src/scripts/asp/monthly/$asp/index.ts" 2>&1

  if [ $? -eq 0 ]; then
    echo "✅ $asp: 成功"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "❌ $asp: 失敗"
    FAILED=$((FAILED + 1))
  fi

  echo ""
  echo "⏱️  次のASPまで5秒待機..."
  sleep 5
done

echo "============================================================"
echo "📊 実行結果サマリー"
echo "============================================================"
echo "✅ 成功: $SUCCESS件"
echo "❌ 失敗: $FAILED件"
echo "⚠️  スキップ: $SKIPPED件"
echo "📊 合計: ${#ASPS[@]}件"
echo "============================================================"

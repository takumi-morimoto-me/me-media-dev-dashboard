#!/bin/bash

# 月次スクレイパー完了を待機するスクリプト

LOG_FILE="/tmp/monthly_asp_execution_4.log"

echo "⏳ 全ASP月次スクレイパーの完了を待機中..."
echo ""

while true; do
  # "実行結果サマリー" が出現したら完了
  if grep -q "📊 実行結果サマリー" "$LOG_FILE" 2>/dev/null; then
    echo "✅ 実行完了！"
    echo ""
    echo "============================================================"
    tail -20 "$LOG_FILE"
    echo "============================================================"
    break
  fi

  # 現在の進捗を表示
  CURRENT_ASP=$(tail -100 "$LOG_FILE" 2>/dev/null | grep "^\[" | tail -1)
  echo -ne "\r現在: $CURRENT_ASP"

  sleep 30
done

echo ""
echo ""
echo "📊 実行完了！詳細はログファイルを確認してください："
echo "   $LOG_FILE"

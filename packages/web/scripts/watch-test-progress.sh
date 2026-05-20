#!/bin/bash

LOG_FILE="${1:-article-generation-optimized-test.log}"
CHECK_INTERVAL=180  # 3 分鐘

echo "=== 自動監控測試進度 ==="
echo "日誌檔案: $LOG_FILE"
echo "檢查間隔: ${CHECK_INTERVAL} 秒（3 分鐘）"
echo ""

check_count=1

while true; do
  # 檢查日誌檔案是否存在
  if [ ! -f "$LOG_FILE" ]; then
    echo "[等待中] 日誌檔案尚未建立，等待測試開始..."
    sleep 10
    continue
  fi

  # 顯示檢查資訊
  echo "=== 第 ${check_count} 次檢查（$(date '+%H:%M:%S')） ==="
  echo ""

  # 檢查是否已完成
  if tail -20 "$LOG_FILE" | grep -q "=== 生成完成 ==="; then
    echo "✅ 測試已完成！"
    echo ""
    echo "=== 最終結果 ==="
    tail -100 "$LOG_FILE"
    exit 0
  fi

  # 顯示最新進度
  echo "--- 最新進度 ---"
  tail -50 "$LOG_FILE"
  echo ""
  echo "--- 統計資訊 ---"

  # 統計各階段狀態
  echo "ResearchAgent: $(grep -c 'ResearchAgent completed' "$LOG_FILE")"
  echo "StrategyAgent: $(grep -c 'StrategyAgent.*completed' "$LOG_FILE")"
  echo "WritingAgent: $(grep -c 'WritingAgent.*completed' "$LOG_FILE")"
  echo "MetaAgent: $(grep -c 'MetaAgent.*completed' "$LOG_FILE")"
  echo "QualityAgent: $(grep -c 'QualityAgent.*completed' "$LOG_FILE")"
  echo "CategoryAgent: $(grep -c 'CategoryAgent.*completed' "$LOG_FILE" || echo "0")"

  # 顯示 Perplexity citations 數量
  if grep -q "Citations summary" "$LOG_FILE"; then
    echo ""
    echo "Perplexity Citations:"
    grep "Citations summary" "$LOG_FILE" | tail -1
  fi

  # 顯示錯誤（如果有）
  if grep -q "錯誤\|Error\|Failed" "$LOG_FILE"; then
    echo ""
    echo "⚠️  發現錯誤："
    grep -i "錯誤\|error\|failed" "$LOG_FILE" | tail -5
  fi

  echo ""
  echo "下次檢查: $(date -v+${CHECK_INTERVAL}S '+%H:%M:%S')"
  echo "----------------------------------------"
  echo ""

  check_count=$((check_count + 1))
  sleep $CHECK_INTERVAL
done

#!/bin/bash

echo "🚀 開始執行 5 輪測試"
echo "======================================"
echo ""

SUCCESS_COUNT=0
TOTAL=5
RESULTS_FILE="test-results-$(date +%Y%m%d-%H%M%S).txt"

for i in {1..5}; do
  echo "============================================================"
  echo "🔄 第 $i 輪測試"
  echo "============================================================"
  echo ""

  START_TIME=$(date +%s)

  if ./scripts/load-env.sh npx tsx scripts/test-simple.ts > "test-round-$i.log" 2>&1; then
    echo "✅ 第 $i 輪測試完成"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))

    # 提取關鍵資訊
    TOTAL_TIME=$(grep "總時間:" "test-round-$i.log" | tail -1 || echo "N/A")
    MODEL_INFO=$(grep "model:" "test-round-$i.log" | head -3 || echo "")
    CATEGORY_INFO=$(grep "分類數量:\|標籤數量:" "test-round-$i.log" || echo "")

    echo "$TOTAL_TIME"
    echo "$MODEL_INFO"
    echo "$CATEGORY_INFO"
  else
    echo "❌ 第 $i 輪測試失敗"
    tail -20 "test-round-$i.log"
  fi

  echo "" >> "$RESULTS_FILE"
  echo "=== Round $i ===" >> "$RESULTS_FILE"
  cat "test-round-$i.log" >> "$RESULTS_FILE"
  echo "" >> "$RESULTS_FILE"

  if [ $i -lt $TOTAL ]; then
    echo ""
    echo "⏳ 等待 3 秒後進行下一輪..."
    echo ""
    sleep 3
  fi
done

echo ""
echo "======================================"
echo "📊 測試結果統計"
echo "======================================"
echo "✅ 成功: $SUCCESS_COUNT/$TOTAL"
echo "📄 完整日誌: $RESULTS_FILE"
echo ""

# 清理個別日誌
rm test-round-*.log 2>/dev/null

exit 0

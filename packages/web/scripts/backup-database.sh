#!/bin/bash

# 資料庫每日自動備份腳本
# 用途：防止資料意外刪除，提供恢復能力
# 建立時間：2025-11-16（文章資料意外刪除事件後）

set -e  # 遇到錯誤立即退出

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.sql"

# 建立備份目錄
mkdir -p "$BACKUP_DIR"

# 載入環境變數
if [ -f ".env.local" ]; then
  source .env.local
else
  echo "❌ 錯誤：找不到 .env.local 檔案"
  exit 1
fi

# 檢查環境變數
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ 錯誤：SUPABASE_DB_URL 環境變數未設定"
  exit 1
fi

echo "📦 開始備份資料庫..."
echo "   時間：$(date '+%Y-%m-%d %H:%M:%S')"
echo "   備份檔案：$BACKUP_FILE"
echo ""

# 執行備份（只備份關鍵表格）
pg_dump "$SUPABASE_DB_URL" \
  --table=generated_articles \
  --table=article_jobs \
  --table=token_usage_logs \
  --table=token_deduction_records \
  --table=company_subscriptions \
  --table=payment_orders \
  --table=website_configs \
  --clean \
  --if-exists \
  > "$BACKUP_FILE"

# 檢查備份檔案大小
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
echo "✅ 備份完成！"
echo "   檔案大小：$BACKUP_SIZE"
echo ""

# 清理 7 天前的舊備份
echo "🗑️  清理舊備份（保留最近 7 天）..."
find "$BACKUP_DIR" -name "backup-*.sql" -mtime +7 -delete
REMAINING_COUNT=$(find "$BACKUP_DIR" -name "backup-*.sql" | wc -l | tr -d ' ')
echo "   剩餘備份檔案：$REMAINING_COUNT 個"
echo ""

# 顯示最近的備份檔案
echo "📋 最近的備份檔案："
ls -lh "$BACKUP_DIR"/backup-*.sql | tail -5

# 記錄到 ISSUELOG.md
if [ -f "ISSUELOG.md" ]; then
  cat >> ISSUELOG.md <<EOF

## [$(date '+%Y-%m-%d %H:%M:%S')] 資料庫備份

**操作類型**: BACKUP
**備份檔案**: $BACKUP_FILE
**檔案大小**: $BACKUP_SIZE
**執行者**: 自動備份腳本
**結果**: 成功

EOF
  echo "📝 已記錄到 ISSUELOG.md"
fi

echo ""
echo "✅ 所有操作完成！"

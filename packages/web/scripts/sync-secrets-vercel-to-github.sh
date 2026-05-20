#!/bin/bash
set -euo pipefail

# ========================================
# 環境變數同步腳本：Vercel → GitHub Secrets
# ========================================
# 功能：
# 1. 從 Vercel 拉取環境變數
# 2. 清理換行符和空白字元
# 3. 推送到 GitHub Secrets
# ========================================

REPO="acejou27/Auto-pilot-SEO"
VERCEL_SCOPE="acejou27s-projects"
VERCEL_PROJECT_ID="autopilot-seo"

# ANSI 顏色代碼
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🔄 環境變數同步：Vercel → GitHub${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 檢查必要工具
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ 錯誤：未安裝 Vercel CLI${NC}"
    echo -e "${YELLOW}請執行：npm install -g vercel${NC}"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ 錯誤：未安裝 GitHub CLI${NC}"
    echo -e "${YELLOW}請執行：brew install gh (macOS) 或參考 https://cli.github.com/${NC}"
    exit 1
fi

# 定義需要同步的環境變數
REQUIRED_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "OPENAI_API_KEY"
    "DEEPSEEK_API_KEY"
    "ANTHROPIC_API_KEY"
    "OPENROUTER_API_KEY"
    "PERPLEXITY_API_KEY"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "R2_ACCOUNT_ID"
    "R2_BUCKET_NAME"
    "USE_MULTI_AGENT_ARCHITECTURE"
    "MULTI_AGENT_ROLLOUT_PERCENTAGE"
    "SUPABASE_DB_URL"
    "N8N_API_KEY"
    "N8N_WEBHOOK_BASE_URL"
    "GMAIL_USER"
    "GMAIL_APP_PASSWORD"
    "COMPANY_NAME"
    "CRON_SECRET"
)

echo -e "${YELLOW}📋 需要同步的環境變數數量：${#REQUIRED_VARS[@]}${NC}"
echo ""

# 建立臨時檔案儲存 Vercel 環境變數
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 從 Vercel 拉取環境變數到 .env.production 並立即處理
echo -e "${BLUE}🔍 步驟 1/3：從 Vercel 拉取環境變數...${NC}"
vercel env pull "$TEMP_DIR/.env.production" --scope "$VERCEL_SCOPE" --environment production --yes > /dev/null 2>&1

if [ ! -f "$TEMP_DIR/.env.production" ]; then
    echo -e "${RED}❌ 錯誤：無法從 Vercel 拉取環境變數${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 成功拉取環境變數${NC}"
echo ""

# 處理換行符和空白字元
echo -e "${BLUE}🧹 步驟 2/3：清理換行符和空白字元...${NC}"

CLEANED_COUNT=0
FAILED_VARS=()

for var_name in "${REQUIRED_VARS[@]}"; do
    # 從 .env.production 提取變數值
    var_value=$(grep "^${var_name}=" "$TEMP_DIR/.env.production" 2>/dev/null | cut -d '=' -f2- || echo "")

    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  ${var_name}: 未在 Vercel 找到${NC}"
        FAILED_VARS+=("$var_name")
        continue
    fi

    # 移除前後引號（如果有）
    var_value=$(echo "$var_value" | sed 's/^"//; s/"$//' | sed "s/^'//; s/'$//")

    # 清理換行符和多餘空白
    # 1. 移除所有換行符 (\n, \r)
    # 2. 移除前後空白
    # 3. 確保單行
    cleaned_value=$(echo "$var_value" | tr -d '\n\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')

    # 檢查清理後的值是否為空
    if [ -z "$cleaned_value" ]; then
        echo -e "${YELLOW}⚠️  ${var_name}: 清理後為空${NC}"
        FAILED_VARS+=("$var_name")
        continue
    fi

    # 檢查是否仍包含換行符（多重驗證）
    if echo "$cleaned_value" | grep -q $'\n'; then
        echo -e "${RED}❌ ${var_name}: 清理失敗，仍包含換行符${NC}"
        FAILED_VARS+=("$var_name")
        continue
    fi

    echo -e "${GREEN}✅ ${var_name}${NC}"
    CLEANED_COUNT=$((CLEANED_COUNT + 1))

    # 儲存清理後的值到臨時檔案
    echo "$cleaned_value" > "$TEMP_DIR/${var_name}.txt"
done

echo ""
echo -e "${BLUE}📊 清理統計：${NC}"
echo -e "  ✅ 成功清理：${CLEANED_COUNT}"
echo -e "  ❌ 失敗/缺失：${#FAILED_VARS[@]}"
echo ""

if [ ${#FAILED_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  以下變數未成功處理：${NC}"
    for var in "${FAILED_VARS[@]}"; do
        echo -e "  - $var"
    done
    echo ""
fi

# 推送到 GitHub Secrets
echo -e "${BLUE}🚀 步驟 3/3：推送到 GitHub Secrets...${NC}"

SUCCESS_COUNT=0
PUSH_FAILED=()

for var_name in "${REQUIRED_VARS[@]}"; do
    # 跳過清理失敗的變數
    if [[ " ${FAILED_VARS[@]} " =~ " ${var_name} " ]]; then
        continue
    fi

    if [ ! -f "$TEMP_DIR/${var_name}.txt" ]; then
        continue
    fi

    # 從臨時檔案讀取清理後的值
    var_value=$(cat "$TEMP_DIR/${var_name}.txt")

    # 推送到 GitHub Secrets
    if echo "$var_value" | gh secret set "$var_name" --repo "$REPO" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ${var_name}${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ ${var_name}: 推送失敗${NC}"
        PUSH_FAILED+=("$var_name")
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 同步完成統計${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  ✅ 成功同步到 GitHub：${SUCCESS_COUNT}"
echo -e "  ❌ 清理失敗：${#FAILED_VARS[@]}"
echo -e "  ❌ 推送失敗：${#PUSH_FAILED[@]}"
echo ""

if [ $SUCCESS_COUNT -eq ${#REQUIRED_VARS[@]} ]; then
    echo -e "${GREEN}🎉 所有環境變數同步成功！${NC}"
    exit 0
elif [ $SUCCESS_COUNT -gt 0 ]; then
    echo -e "${YELLOW}⚠️  部分環境變數同步成功${NC}"
    exit 0
else
    echo -e "${RED}❌ 環境變數同步失敗${NC}"
    exit 1
fi

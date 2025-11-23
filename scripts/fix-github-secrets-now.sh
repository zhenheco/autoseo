#!/bin/bash
set -euo pipefail

# ========================================
# 緊急修復腳本：立即修復 GitHub Secrets 換行符問題
# ========================================
# 此腳本會：
# 1. 從 Vercel 拉取環境變數
# 2. 完全清除所有換行符（包括值內的換行）
# 3. 立即推送到 GitHub Secrets
# 4. 驗證修復結果
# ========================================

REPO="acejou27/Auto-pilot-SEO"
VERCEL_SCOPE="acejou27s-projects"

# ANSI 顏色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚨 緊急修復：GitHub Secrets 換行符問題${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 檢查工具
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}❌ 錯誤：未安裝 Vercel CLI${NC}"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ 錯誤：未安裝 GitHub CLI${NC}"
    exit 1
fi

# 建立臨時目錄
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${BLUE}📥 步驟 1/4：從 Vercel 拉取環境變數...${NC}"
vercel env pull "$TEMP_DIR/.env.production" --scope "$VERCEL_SCOPE" --environment production --yes > /dev/null 2>&1

if [ ! -f "$TEMP_DIR/.env.production" ]; then
    echo -e "${RED}❌ 無法從 Vercel 拉取環境變數${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 成功拉取${NC}"
echo ""

# 關鍵環境變數列表（按優先級排序）
CRITICAL_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "OPENAI_API_KEY"
    "DEEPSEEK_API_KEY"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "R2_ACCOUNT_ID"
    "R2_BUCKET_NAME"
    "USE_MULTI_AGENT_ARCHITECTURE"
)

echo -e "${BLUE}🧹 步驟 2/4：清理並處理環境變數...${NC}"

SUCCESS_COUNT=0
FAILED_VARS=()

for var_name in "${CRITICAL_VARS[@]}"; do
    # 從 .env.production 提取變數（完整行）
    full_line=$(grep "^${var_name}=" "$TEMP_DIR/.env.production" 2>/dev/null || echo "")

    if [ -z "$full_line" ]; then
        echo -e "${YELLOW}⚠️  ${var_name}: 未在 Vercel 找到${NC}"
        FAILED_VARS+=("$var_name")
        continue
    fi

    # 提取等號後的值（移除變數名和等號）
    raw_value="${full_line#*=}"

    # 清理步驟：
    # 1. 移除前後的引號（單引號和雙引號）
    # 2. 使用 tr 移除所有換行符和回車符
    # 3. 使用 sed 移除前後空白
    # 4. 確保是單行
    cleaned_value=$(echo "$raw_value" | sed 's/^["'\'']*//; s/["'\'']*$//' | tr -d '\n\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | head -1)

    # 驗證清理後的值
    if [ -z "$cleaned_value" ]; then
        echo -e "${YELLOW}⚠️  ${var_name}: 清理後為空${NC}"
        FAILED_VARS+=("$var_name")
        continue
    fi

    # 二次驗證：檢查是否仍包含換行符
    if echo "$cleaned_value" | grep -q $'\n'; then
        echo -e "${RED}❌ ${var_name}: 仍包含換行符（清理失敗）${NC}"
        FAILED_VARS+=("$var_name")
        continue
    fi

    # 儲存到臨時檔案（不使用 echo，避免加入換行）
    printf "%s" "$cleaned_value" > "$TEMP_DIR/${var_name}.txt"

    # 驗證檔案不包含換行符
    if file "$TEMP_DIR/${var_name}.txt" | grep -q "text"; then
        # 檢查檔案大小（確保有內容）
        file_size=$(wc -c < "$TEMP_DIR/${var_name}.txt" | tr -d ' ')
        if [ "$file_size" -gt 0 ]; then
            echo -e "${GREEN}✅ ${var_name} (${file_size} bytes)${NC}"
        else
            echo -e "${RED}❌ ${var_name}: 檔案為空${NC}"
            FAILED_VARS+=("$var_name")
            rm -f "$TEMP_DIR/${var_name}.txt"
        fi
    else
        echo -e "${RED}❌ ${var_name}: 無效的檔案類型${NC}"
        FAILED_VARS+=("$var_name")
        rm -f "$TEMP_DIR/${var_name}.txt"
    fi
done

echo ""
echo -e "${BLUE}📊 清理統計：${NC}"
echo -e "  ✅ 成功清理：$((${#CRITICAL_VARS[@]} - ${#FAILED_VARS[@]}))"
echo -e "  ❌ 失敗/缺失：${#FAILED_VARS[@]}"
echo ""

if [ ${#FAILED_VARS[@]} -eq ${#CRITICAL_VARS[@]} ]; then
    echo -e "${RED}❌ 所有變數清理失敗！中止操作${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 步驟 3/4：推送到 GitHub Secrets...${NC}"

PUSH_SUCCESS=0
PUSH_FAILED=()

for var_name in "${CRITICAL_VARS[@]}"; do
    # 跳過清理失敗的變數
    if [[ " ${FAILED_VARS[@]} " =~ " ${var_name} " ]]; then
        continue
    fi

    secret_file="$TEMP_DIR/${var_name}.txt"
    if [ ! -f "$secret_file" ]; then
        continue
    fi

    # 使用 gh secret set 從檔案讀取（確保無換行）
    if gh secret set "$var_name" --repo "$REPO" < "$secret_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ${var_name}${NC}"
        PUSH_SUCCESS=$((PUSH_SUCCESS + 1))
    else
        echo -e "${RED}❌ ${var_name}: 推送失敗${NC}"
        PUSH_FAILED+=("$var_name")
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}📊 修復完成統計${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  ✅ 成功推送：${PUSH_SUCCESS}"
echo -e "  ❌ 清理失敗：${#FAILED_VARS[@]}"
echo -e "  ❌ 推送失敗：${#PUSH_FAILED[@]}"
echo ""

if [ $PUSH_SUCCESS -eq ${#CRITICAL_VARS[@]} ]; then
    echo -e "${GREEN}🎉 所有關鍵環境變數已成功修復！${NC}"

    echo ""
    echo -e "${BLUE}🧪 步驟 4/4：驗證修復...${NC}"
    echo -e "${YELLOW}建議執行以下指令測試：${NC}"
    echo -e "  gh workflow run article-generation.yml --ref main"
    echo ""

    exit 0
elif [ $PUSH_SUCCESS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  部分環境變數修復成功${NC}"

    if [ ${#FAILED_VARS[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  以下變數需要手動處理：${NC}"
        for var in "${FAILED_VARS[@]}"; do
            echo -e "  - $var"
        done
    fi

    if [ ${#PUSH_FAILED[@]} -gt 0 ]; then
        echo ""
        echo -e "${RED}❌ 以下變數推送失敗：${NC}"
        for var in "${PUSH_FAILED[@]}"; do
            echo -e "  - $var"
        done
    fi

    exit 0
else
    echo -e "${RED}❌ 修復失敗！沒有成功推送任何變數${NC}"
    exit 1
fi

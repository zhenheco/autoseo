#!/bin/bash
set -euo pipefail

# ========================================
# 終極環境變數同步腳本：Vercel → GitHub Secrets
# ========================================
# 解決換行符問題的關鍵方法：
# 1. 使用 printf 而非 echo 避免加入換行符
# 2. 使用檔案驗證而非字串驗證
# 3. 完全避免 bash 變數中的換行符誤判
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
echo -e "${BLUE}🔄 終極環境變數同步：Vercel → GitHub${NC}"
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

# 關鍵環境變數列表
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

echo -e "${YELLOW}📋 將同步 ${#CRITICAL_VARS[@]} 個關鍵環境變數${NC}"
echo ""

# 建立臨時目錄
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 從 Vercel 拉取環境變數
echo -e "${BLUE}🔍 步驟 1/3：從 Vercel 拉取環境變數...${NC}"
vercel env pull "$TEMP_DIR/.env.production" --scope "$VERCEL_SCOPE" --environment production --yes > /dev/null 2>&1

if [ ! -f "$TEMP_DIR/.env.production" ]; then
    echo -e "${RED}❌ 無法從 Vercel 拉取環境變數${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 成功拉取${NC}"
echo ""

# 處理並清理環境變數
echo -e "${BLUE}🧹 步驟 2/3：清理環境變數...${NC}"

SUCCESS_COUNT=0
FAILED_VARS=()

for var_name in "${CRITICAL_VARS[@]}"; do
    # 從 .env.production 提取完整行
    full_line=$(grep "^${var_name}=" "$TEMP_DIR/.env.production" 2>/dev/null || echo "")

    if [ -z "$full_line" ]; then
        echo -e "${YELLOW}⚠️  ${var_name}: 未在 Vercel 找到${NC}"
        FAILED_VARS+=("$var_name")
        continue
    fi

    # 提取等號後的值
    raw_value="${full_line#*=}"

    # 清理：移除引號、換行符、空白
    # 使用 printf 寫入檔案，避免任何換行符
    cleaned_value=$(echo "$raw_value" | sed 's/^["'\'']*//; s/["'\'']*$//' | tr -d '\n\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')

    # 驗證清理後的值
    if [ -z "$cleaned_value" ]; then
        echo -e "${YELLOW}⚠️  ${var_name}: 清理後為空${NC}"
        FAILED_VARS+=("$var_name")
        continue
    fi

    # 使用 printf 寫入檔案（不加換行符）
    printf "%s" "$cleaned_value" > "$TEMP_DIR/${var_name}.txt"

    # 驗證檔案內容（使用 wc -l 檢查是否為單行）
    line_count=$(wc -l < "$TEMP_DIR/${var_name}.txt" | tr -d ' ')
    file_size=$(wc -c < "$TEMP_DIR/${var_name}.txt" | tr -d ' ')

    if [ "$line_count" -eq 0 ] && [ "$file_size" -gt 0 ]; then
        echo -e "${GREEN}✅ ${var_name} (${file_size} bytes, 單行)${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e "${RED}❌ ${var_name}: 檔案包含 ${line_count} 行（應為 0）${NC}"
        FAILED_VARS+=("$var_name")
        rm -f "$TEMP_DIR/${var_name}.txt"
    fi
done

echo ""
echo -e "${BLUE}📊 清理統計：${NC}"
echo -e "  ✅ 成功清理：${SUCCESS_COUNT}"
echo -e "  ❌ 失敗/缺失：${#FAILED_VARS[@]}"
echo ""

if [ $SUCCESS_COUNT -eq 0 ]; then
    echo -e "${RED}❌ 沒有成功清理任何變數！中止操作${NC}"
    exit 1
fi

# 推送到 GitHub Secrets
echo -e "${BLUE}🚀 步驟 3/3：推送到 GitHub Secrets...${NC}"

PUSH_SUCCESS=0
PUSH_FAILED=()

for var_name in "${CRITICAL_VARS[@]}"; do
    # 跳過清理失敗的變數
    skip=false
    for failed_var in "${FAILED_VARS[@]+"${FAILED_VARS[@]}"}"; do
        if [ "$failed_var" = "$var_name" ]; then
            skip=true
            break
        fi
    done
    if [ "$skip" = true ]; then
        continue
    fi

    secret_file="$TEMP_DIR/${var_name}.txt"
    if [ ! -f "$secret_file" ]; then
        continue
    fi

    # 使用 gh secret set 從檔案讀取
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
echo -e "${BLUE}📊 同步完成統計${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  ✅ 成功同步：${PUSH_SUCCESS}"
echo -e "  ❌ 清理失敗：${#FAILED_VARS[@]}"
echo -e "  ❌ 推送失敗：${#PUSH_FAILED[@]}"
echo ""

if [ $PUSH_SUCCESS -eq ${#CRITICAL_VARS[@]} ]; then
    echo -e "${GREEN}🎉 所有環境變數同步成功！${NC}"
    echo ""
    echo -e "${BLUE}🧪 建議執行以下指令測試：${NC}"
    echo -e "  gh workflow run article-generation.yml --ref main"
    echo ""
    exit 0
elif [ $PUSH_SUCCESS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  部分環境變數同步成功${NC}"

    if [ ${#FAILED_VARS[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  以下變數清理失敗：${NC}"
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
    echo -e "${RED}❌ 同步失敗！沒有成功推送任何變數${NC}"
    exit 1
fi

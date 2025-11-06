#!/bin/bash

# 安全檢查腳本
# 用於 pre-commit hook 或手動執行

set -e

echo "🔍 執行安全檢查..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# 檢查 1: .env.local 是否被加入版本控制
echo ""
echo "📋 檢查 1: 驗證 .env.local 未被追蹤..."
if git ls-files | grep -q "^.env.local$"; then
  echo -e "${RED}❌ 錯誤: .env.local 被加入版本控制!${NC}"
  echo "   請執行: git rm --cached .env.local"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ .env.local 未被追蹤${NC}"
fi

# 檢查 2: 搜尋硬編碼的 API 金鑰模式
echo ""
echo "📋 檢查 2: 搜尋硬編碼的敏感資訊..."

# 定義敏感模式
PATTERNS=(
  "sk-[a-zA-Z0-9]{20,}"
  "sk-proj-[a-zA-Z0-9_-]{20,}"
  "eyJ[a-zA-Z0-9_-]*\\.eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*"
  "ghp_[a-zA-Z0-9]{36}"
  "gho_[a-zA-Z0-9]{36}"
  "AKIA[0-9A-Z]{16}"
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  if git diff --cached --diff-filter=ACM | grep -E "$pattern" > /dev/null 2>&1; then
    echo -e "${RED}❌ 發現可疑的金鑰模式: $pattern${NC}"
    FOUND=1
  fi
done

if [ $FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ 未發現硬編碼金鑰${NC}"
else
  echo -e "${RED}❌ 發現硬編碼金鑰,請移除後再提交${NC}"
  ERRORS=$((ERRORS + 1))
fi

# 檢查 3: 搜尋 console.log 中的敏感資訊
echo ""
echo "📋 檢查 3: 檢查 console.log 使用..."

UNSAFE_LOGS=$(git diff --cached --diff-filter=ACM | grep -E "console\.(log|info|warn|error).*\b(apiKey|api_key|password|secret|token)\b" || true)

if [ -n "$UNSAFE_LOGS" ]; then
  echo -e "${YELLOW}⚠️  發現可能不安全的 console.log:${NC}"
  echo "$UNSAFE_LOGS"
  echo -e "${YELLOW}   建議使用 src/lib/security/log-sanitizer.ts${NC}"
else
  echo -e "${GREEN}✅ console.log 使用安全${NC}"
fi

# 檢查 4: 驗證 dangerouslySetInnerHTML 使用
echo ""
echo "📋 檢查 4: 檢查 dangerouslySetInnerHTML 使用..."

UNSAFE_HTML=$(git diff --cached --diff-filter=ACM | grep "dangerouslySetInnerHTML" | grep -v "sanitize" || true)

if [ -n "$UNSAFE_HTML" ]; then
  echo -e "${YELLOW}⚠️  發現未清理的 dangerouslySetInnerHTML:${NC}"
  echo "$UNSAFE_HTML"
  echo -e "${YELLOW}   請使用 sanitizeArticleHtml() 或 sanitizeUserInput()${NC}"
else
  echo -e "${GREEN}✅ dangerouslySetInnerHTML 使用安全${NC}"
fi

# 檢查 5: 驗證 TypeScript 類型
echo ""
echo "📋 檢查 5: TypeScript 類型檢查..."

if command -v tsc &> /dev/null; then
  if npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "error TS" > /dev/null; then
    echo -e "${RED}❌ TypeScript 類型錯誤${NC}"
    echo "   請執行: npx tsc --noEmit 查看詳細錯誤"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ TypeScript 類型正確${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  未找到 tsc,跳過類型檢查${NC}"
fi

# 總結
echo ""
echo "================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ 所有安全檢查通過!${NC}"
  exit 0
else
  echo -e "${RED}❌ 發現 $ERRORS 個安全問題,請修復後再提交${NC}"
  exit 1
fi

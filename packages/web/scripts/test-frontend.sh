#!/bin/bash

# 前端測試腳本
# 使用 curl 測試基本功能

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  Auto Pilot SEO - 前端測試"
echo "========================================"
echo ""

# 測試 URL
BASE_URL="${1:-https://1wayseo.com}"
echo "測試 URL: $BASE_URL"
echo ""

# 測試計數
TOTAL=0
PASSED=0
FAILED=0

# 測試函數
test_url() {
  local name="$1"
  local url="$2"
  local expected_code="${3:-200}"

  TOTAL=$((TOTAL + 1))
  echo -n "[$TOTAL] 測試 $name ... "

  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1)

  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} (預期: $expected_code, 實際: $http_code)"
    FAILED=$((FAILED + 1))
  fi
}

# 測試 API JSON 回應
test_api() {
  local name="$1"
  local url="$2"

  TOTAL=$((TOTAL + 1))
  echo -n "[$TOTAL] 測試 $name ... "

  response=$(curl -s "$url" 2>&1)
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>&1)

  if [ "$http_code" = "200" ] && echo "$response" | grep -q "{"; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code, JSON 格式)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
    FAILED=$((FAILED + 1))
  fi
}

echo "開始測試..."
echo ""

# 1. 基本頁面測試
echo "===== 基本頁面 ====="
test_url "首頁" "$BASE_URL" "200"
test_url "登入頁面" "$BASE_URL/login" "200"
test_url "註冊頁面" "$BASE_URL/signup" "200"
test_url "價格頁面" "$BASE_URL/pricing" "200"
echo ""

# 2. Dashboard 頁面（需要認證，預期重定向）
echo "===== Dashboard 頁面 ====="
test_url "Dashboard" "$BASE_URL/dashboard" "307"
test_url "文章列表" "$BASE_URL/dashboard/articles" "307"
test_url "訂閱管理" "$BASE_URL/dashboard/subscription" "307"
echo ""

# 3. API Endpoints 測試
echo "===== API Endpoints ====="
test_api "AI 模型列表" "$BASE_URL/api/ai-models"
test_url "健康檢查" "$BASE_URL/api/health" "200"
echo ""

# 4. 靜態資源測試
echo "===== 靜態資源 ====="
test_url "Favicon" "$BASE_URL/favicon.ico" "200"
test_url "Robots.txt" "$BASE_URL/robots.txt" "200"
echo ""

# 5. 404 測試
echo "===== 錯誤處理 ====="
test_url "404 頁面" "$BASE_URL/this-page-does-not-exist" "404"
echo ""

# 總結
echo "========================================"
echo "  測試結果"
echo "========================================"
echo -e "總共測試: $TOTAL"
echo -e "${GREEN}通過: $PASSED${NC}"
echo -e "${RED}失敗: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ 所有測試通過！${NC}"
  exit 0
else
  echo -e "${RED}✗ 有 $FAILED 個測試失敗${NC}"
  exit 1
fi

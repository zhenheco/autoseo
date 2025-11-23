#!/bin/bash
# Google Drive 環境變數設定輔助腳本

set -e

echo "======================================"
echo "Google Drive 儲存設定輔助工具"
echo "======================================"
echo ""

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}錯誤：未安裝 Vercel CLI${NC}"
    echo "請執行: npm install -g vercel"
    exit 1
fi

# 選擇認證方式
echo "請選擇認證方式："
echo "1) OAuth2 Access Token（適合開發/測試）"
echo "2) Service Account（推薦用於生產環境）"
echo ""
read -p "輸入選項 (1 或 2): " auth_method

# 取得專案名稱
echo ""
read -p "請輸入 Vercel 專案名稱 [autopilot-seo]: " project_name
project_name=${project_name:-autopilot-seo}

# 取得 Google Drive Folder ID
echo ""
echo -e "${YELLOW}提示：請前往 Google Drive，建立資料夾後從 URL 複製 ID${NC}"
echo "範例：https://drive.google.com/drive/folders/1abc...xyz"
echo "      ↑ 複製「1abc...xyz」這部分"
read -p "請輸入 Google Drive Folder ID: " folder_id

if [ -z "$folder_id" ]; then
    echo -e "${RED}錯誤：Folder ID 不能為空${NC}"
    exit 1
fi

# 設定 Folder ID
echo ""
echo "正在設定 GOOGLE_DRIVE_FOLDER_ID..."
echo "$folder_id" | vercel env add GOOGLE_DRIVE_FOLDER_ID production --project "$project_name"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ GOOGLE_DRIVE_FOLDER_ID 設定成功${NC}"
else
    echo -e "${RED}✗ 設定失敗${NC}"
    exit 1
fi

# 根據認證方式設定不同的環境變數
if [ "$auth_method" == "1" ]; then
    # OAuth2 Access Token
    echo ""
    echo -e "${YELLOW}請前往 OAuth 2.0 Playground 取得 Access Token：${NC}"
    echo "https://developers.google.com/oauthplayground"
    echo ""
    echo "步驟："
    echo "1. 選擇 Drive API v3 → https://www.googleapis.com/auth/drive.file"
    echo "2. Authorize APIs"
    echo "3. Exchange authorization code for tokens"
    echo "4. 複製 Access token"
    echo ""
    read -p "請輸入 Access Token: " access_token

    if [ -z "$access_token" ]; then
        echo -e "${RED}錯誤：Access Token 不能為空${NC}"
        exit 1
    fi

    echo ""
    echo "正在設定 GOOGLE_DRIVE_ACCESS_TOKEN..."
    echo "$access_token" | vercel env add GOOGLE_DRIVE_ACCESS_TOKEN production --project "$project_name"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ GOOGLE_DRIVE_ACCESS_TOKEN 設定成功${NC}"
    else
        echo -e "${RED}✗ 設定失敗${NC}"
        exit 1
    fi

elif [ "$auth_method" == "2" ]; then
    # Service Account
    echo ""
    echo -e "${YELLOW}請提供 Service Account 資訊${NC}"
    echo ""
    echo "方法 A: 提供 JSON 檔案路徑"
    echo "方法 B: 手動輸入 Email 和 Private Key"
    echo ""
    read -p "選擇方法 (A 或 B): " sa_method

    if [ "$sa_method" == "A" ] || [ "$sa_method" == "a" ]; then
        # 從 JSON 檔案讀取
        read -p "請輸入 Service Account JSON 檔案路徑: " json_path

        if [ ! -f "$json_path" ]; then
            echo -e "${RED}錯誤：找不到檔案 $json_path${NC}"
            exit 1
        fi

        # 使用 jq 解析 JSON（如果有安裝）
        if command -v jq &> /dev/null; then
            sa_email=$(jq -r '.client_email' "$json_path")
            sa_key=$(jq -r '.private_key' "$json_path")
        else
            echo -e "${YELLOW}警告：未安裝 jq，請手動輸入${NC}"
            read -p "請輸入 Service Account Email: " sa_email
            echo "請輸入 Private Key（完整內容，包含 BEGIN/END）："
            sa_key=""
            while IFS= read -r line; do
                sa_key+="$line"$'\n'
                # 檢測結束標記
                if [[ "$line" == *"END PRIVATE KEY"* ]]; then
                    break
                fi
            done
        fi

    else
        # 手動輸入
        read -p "請輸入 Service Account Email: " sa_email
        echo "請輸入 Private Key（完整內容，包含 BEGIN/END）："
        sa_key=""
        while IFS= read -r line; do
            sa_key+="$line"$'\n'
            # 檢測結束標記
            if [[ "$line" == *"END PRIVATE KEY"* ]]; then
                break
            fi
        done
    fi

    if [ -z "$sa_email" ] || [ -z "$sa_key" ]; then
        echo -e "${RED}錯誤：Service Account Email 或 Private Key 不能為空${NC}"
        exit 1
    fi

    # 設定 Service Account Email
    echo ""
    echo "正在設定 GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL..."
    echo "$sa_email" | vercel env add GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL production --project "$project_name"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL 設定成功${NC}"
    else
        echo -e "${RED}✗ 設定失敗${NC}"
        exit 1
    fi

    # 設定 Service Account Private Key
    echo ""
    echo "正在設定 GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY..."
    echo "$sa_key" | vercel env add GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY production --project "$project_name"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY 設定成功${NC}"
    else
        echo -e "${RED}✗ 設定失敗${NC}"
        exit 1
    fi

    # 提醒共享資料夾
    echo ""
    echo -e "${YELLOW}重要提醒：${NC}"
    echo "請前往 Google Drive，將資料夾共享給 Service Account："
    echo -e "${GREEN}$sa_email${NC}"
    echo "權限設為「編輯者」"
fi

# 完成
echo ""
echo "======================================"
echo -e "${GREEN}環境變數設定完成！${NC}"
echo "======================================"
echo ""
echo "已設定的環境變數："
echo "  ✓ GOOGLE_DRIVE_FOLDER_ID"

if [ "$auth_method" == "1" ]; then
    echo "  ✓ GOOGLE_DRIVE_ACCESS_TOKEN"
else
    echo "  ✓ GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"
    echo "  ✓ GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY"
fi

echo ""
echo "下一步："
echo "1. 重新部署專案：vercel --prod"
echo "2. 測試圖片上傳功能"
echo "3. 查看日誌：vercel logs --follow"
echo ""
echo "詳細說明請參考：docs/GOOGLE_DRIVE_SETUP.md"

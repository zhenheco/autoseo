#!/bin/bash

# GitHub Actions Secrets 自動設置腳本
# 使用方式：./scripts/setup-github-secrets.sh

echo "🚀 Auto-pilot SEO - GitHub Actions 自動設置"
echo "=========================================="

# 檢查是否有 GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "❌ 需要安裝 GitHub CLI (gh)"
    echo "請執行: brew install gh"
    exit 1
fi

# 檢查是否已登入 GitHub
if ! gh auth status &> /dev/null; then
    echo "需要登入 GitHub..."
    gh auth login
fi

# 設定變數
REPO="acejou27/Auto-pilot-SEO"

echo ""
echo "📝 準備設置 Repository Secrets..."
echo "目標倉庫: $REPO"
echo ""

# 從 .env.local 讀取並設置 Secrets
set_secret() {
    local SECRET_NAME=$1
    local ENV_VAR=$2

    # 從 .env.local 讀取值
    if [ -f ".env.local" ]; then
        VALUE=$(grep "^${ENV_VAR}=" .env.local | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')

        if [ ! -z "$VALUE" ] && [ "$VALUE" != "" ]; then
            echo "✅ 設置 $SECRET_NAME"
            echo "$VALUE" | gh secret set "$SECRET_NAME" --repo "$REPO"
        else
            echo "⏭️  跳過 $SECRET_NAME (沒有值)"
        fi
    fi
}

# 必要的 Secrets
echo "🔐 設置必要的 Secrets..."

# GitHub PAT (需要手動輸入)
echo ""
echo "請輸入您剛創建的 GitHub Personal Access Token:"
read -s GITHUB_PAT
echo "$GITHUB_PAT" | gh secret set GITHUB_PERSONAL_ACCESS_TOKEN --repo "$REPO"
echo "✅ 已設置 GITHUB_PERSONAL_ACCESS_TOKEN"

# Supabase
set_secret "NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_URL"
set_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "NEXT_PUBLIC_SUPABASE_ANON_KEY"
set_secret "SUPABASE_SERVICE_ROLE_KEY" "SUPABASE_SERVICE_ROLE_KEY"
set_secret "SUPABASE_DB_URL" "SUPABASE_DB_URL"

# AI Services
set_secret "OPENAI_API_KEY" "OPENAI_API_KEY"
set_secret "DEEPSEEK_API_KEY" "DEEPSEEK_API_KEY"
set_secret "OPENROUTER_API_KEY" "OPENROUTER_API_KEY"
set_secret "PERPLEXITY_API_KEY" "PERPLEXITY_API_KEY"

# N8N
set_secret "N8N_WEBHOOK_BASE_URL" "N8N_WEBHOOK_BASE_URL"
set_secret "N8N_API_KEY" "N8N_API_KEY"

# Google Drive
set_secret "GOOGLE_DRIVE_FOLDER_ID" "GOOGLE_DRIVE_FOLDER_ID"
set_secret "GOOGLE_DRIVE_CLIENT_ID" "GOOGLE_DRIVE_CLIENT_ID"
set_secret "GOOGLE_DRIVE_CLIENT_SECRET" "GOOGLE_DRIVE_CLIENT_SECRET"
set_secret "GOOGLE_DRIVE_REFRESH_TOKEN" "GOOGLE_DRIVE_REFRESH_TOKEN"

# R2 Storage
set_secret "R2_ACCOUNT_ID" "R2_ACCOUNT_ID"
set_secret "R2_ACCESS_KEY_ID" "R2_ACCESS_KEY_ID"
set_secret "R2_SECRET_ACCESS_KEY" "R2_SECRET_ACCESS_KEY"
set_secret "R2_BUCKET_NAME" "R2_BUCKET_NAME"

# WordPress
set_secret "WORDPRESS_URL" "WORDPRESS_URL"
set_secret "WORDPRESS_USERNAME" "WORDPRESS_USERNAME"
set_secret "WORDPRESS_APP_PASSWORD" "WORDPRESS_APP_PASSWORD"

# App Settings
set_secret "NEXT_PUBLIC_APP_URL" "NEXT_PUBLIC_APP_URL"
set_secret "COMPANY_NAME" "COMPANY_NAME"

# Gmail
set_secret "GMAIL_USER" "GMAIL_USER"
set_secret "GMAIL_APP_PASSWORD" "GMAIL_APP_PASSWORD"

# Cron Secret
set_secret "CRON_SECRET" "CRON_SECRET"

echo ""
echo "✅ GitHub Secrets 設置完成！"
echo ""
echo "📋 下一步："
echo "1. 更新 .env.local 中的 GITHUB_PERSONAL_ACCESS_TOKEN"
echo "2. 測試 GitHub Actions workflow"
echo ""
echo "測試命令："
echo "curl -X POST http://localhost:3168/api/articles/trigger-github \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"jobId\": \"test-123\", \"title\": \"測試文章\"}'"
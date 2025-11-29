#!/bin/bash

# Vercel 環境變數設定腳本
# 使用方法: source .env.local && bash scripts/setup-vercel-env.sh

PROJECT_ID="prj_bUwkerXEPg8XA9kaaczlAx0l3DdX"
TEAM_ID="team_Te6j7azgoOQaylJLM5ZgHoUn"

echo "設定 Vercel 環境變數..."
echo "Project: autopilot-seo"
echo "Team ID: $TEAM_ID"
echo ""

# 必要環境變數
declare -A ENV_VARS=(
  ["NEXT_PUBLIC_SUPABASE_URL"]="$NEXT_PUBLIC_SUPABASE_URL"
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ["SUPABASE_SERVICE_ROLE_KEY"]="$SUPABASE_SERVICE_ROLE_KEY"
  ["SUPABASE_DB_URL"]="$SUPABASE_DB_URL"
  ["NEWEBPAY_MERCHANT_ID"]="$NEWEBPAY_MERCHANT_ID"
  ["NEWEBPAY_HASH_KEY"]="$NEWEBPAY_HASH_KEY"
  ["NEWEBPAY_HASH_IV"]="$NEWEBPAY_HASH_IV"
  ["NEWEBPAY_API_URL"]="$NEWEBPAY_API_URL"
  ["GMAIL_USER"]="$GMAIL_USER"
  ["GMAIL_APP_PASSWORD"]="$GMAIL_APP_PASSWORD"
  ["NEXT_PUBLIC_APP_URL"]="https://1wayseo.com"
  ["COMPANY_NAME"]="$COMPANY_NAME"
  ["DEEPSEEK_API_KEY"]="$DEEPSEEK_API_KEY"
  ["OPENROUTER_API_KEY"]="$OPENROUTER_API_KEY"
  ["PERPLEXITY_API_KEY"]="$PERPLEXITY_API_KEY"
)

for KEY in "${!ENV_VARS[@]}"; do
  VALUE="${ENV_VARS[$KEY]}"
  if [ -n "$VALUE" ]; then
    echo "設定 $KEY..."
    echo "$VALUE" | vercel env add "$KEY" production --yes 2>/dev/null || \
    vercel env rm "$KEY" production --yes 2>/dev/null && \
    echo "$VALUE" | vercel env add "$KEY" production --yes
  else
    echo "⚠️  警告: $KEY 未設定"
  fi
done

echo ""
echo "✅ 環境變數設定完成"
echo ""
echo "執行以下命令重新部署:"
echo "vercel --prod"

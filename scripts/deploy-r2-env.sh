#!/bin/bash

# 載入環境變數
source .env.local

echo "=== 部署 R2 環境變數到 Vercel ==="
echo ""

# R2_ACCOUNT_ID
echo "設定 R2_ACCOUNT_ID..."
echo "$R2_ACCOUNT_ID" | vercel env add R2_ACCOUNT_ID production --scope acejou27s-projects 2>&1

# R2_ACCESS_KEY_ID
echo "設定 R2_ACCESS_KEY_ID..."
echo "$R2_ACCESS_KEY_ID" | vercel env add R2_ACCESS_KEY_ID production --scope acejou27s-projects 2>&1

# R2_SECRET_ACCESS_KEY
echo "設定 R2_SECRET_ACCESS_KEY..."
echo "$R2_SECRET_ACCESS_KEY" | vercel env add R2_SECRET_ACCESS_KEY production --scope acejou27s-projects 2>&1

# R2_BUCKET_NAME
echo "設定 R2_BUCKET_NAME..."
echo "$R2_BUCKET_NAME" | vercel env add R2_BUCKET_NAME production --scope acejou27s-projects 2>&1

echo ""
echo "=== ✅ R2 環境變數部署完成 ==="
echo ""
echo "驗證環境變數："
vercel env ls --scope acejou27s-projects | grep R2

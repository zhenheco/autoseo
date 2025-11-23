#!/bin/bash

echo "🧪 測試 NewebPay 支付 API"
echo "=========================="
echo ""

echo "📍 測試 1: 健康檢查 (GET /api/health)"
curl -s -X GET http://localhost:3168/api/health | jq . 2>/dev/null || echo "無 jq,顯示原始輸出"
echo ""

echo "📍 測試 2: 創建單次支付訂單 (POST /api/payment/onetime/create)"
curl -s -X POST http://localhost:3168/api/payment/onetime/create \
  -H 'Content-Type: application/json' \
  -d '{
    "companyId": "test-company-id",
    "paymentType": "token_package",
    "relatedId": "test-package-id",
    "amount": 1000,
    "description": "測試購買 Token 包",
    "email": "test@example.com"
  }' | jq . 2>/dev/null || echo "API 回應(無 jq)"
echo ""

echo "📍 測試 3: 創建定期定額訂單 (POST /api/payment/recurring/create)"
curl -s -X POST http://localhost:3168/api/payment/recurring/create \
  -H 'Content-Type: application/json' \
  -d '{
    "companyId": "test-company-id",
    "planId": "test-plan-id",
    "periodType": "M",
    "periodPoint": "1",
    "periodAmount": 299,
    "email": "test@example.com"
  }' | jq . 2>/dev/null || echo "API 回應(無 jq)"
echo ""

echo "✅ API 測試完成"

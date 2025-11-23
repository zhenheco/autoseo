# 藍新金流整合設計文件

## Context

Auto-pilot SEO 是一個 SaaS 平台，提供 SEO 工具和服務。系統使用：

- **Frontend**: Next.js 15.5.6 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Payment Gateway**: NewebPay (藍新金流)

### Constraints

1. **資料庫複製延遲**: Supabase 使用 PostgreSQL 複製，讀寫可能有 1-5 秒延遲
2. **藍新回調特性**:
   - ReturnURL (同步): 用戶瀏覽器重定向，約 1-2 秒內發生
   - NotifyURL (非同步): 藍新伺服器主動通知，不保證順序
   - 定期定額授權階段**不會呼叫 NotifyURL**（僅在扣款時）
3. **Vercel 函數限制**: 無狀態，每次請求獨立

### Stakeholders

- **終端用戶**: 需要穩定、快速的付款體驗
- **開發團隊**: 需要清晰的錯誤診斷和可維護的代碼
- **營運團隊**: 需要可追蹤的訂單狀態和日誌

## Goals / Non-Goals

### Goals

1. **可靠性**: 處理網路延遲、資料庫延遲、藍新回調順序問題
2. **使用者體驗**: 提供即時反饋，避免無限等待
3. **可觀測性**: 詳細日誌記錄每個關鍵步驟
4. **可維護性**: 清晰的代碼結構和錯誤處理

### Non-Goals

1. 支援其他支付閘道（目前僅藍新）
2. 多幣別支援（目前僅新台幣）
3. 部分退款或取消訂閱功能（未來迭代）

## Decisions

### Decision 1: ReturnURL 處理授權成功邏輯

**背景**: 藍新定期定額授權成功時**不會呼叫 NotifyURL**，僅在後續扣款時才呼叫。

**決策**: ReturnURL 必須完整處理授權成功的業務邏輯：

- 更新 `recurring_mandates` 狀態為 `active`
- 更新 `payment_orders` 狀態為 `success`
- 創建 `company_subscriptions` 記錄
- 添加購買的代幣到帳戶

**替代方案考慮**:

1. **等待 NotifyURL 處理**: ❌ 不可行，授權階段不會收到 NotifyURL
2. **前端輪詢觸發**: ❌ 增加複雜度，且可能有競爭條件
3. **Webhook 重試機制**: ❌ 授權階段無 webhook

**選擇原因**: ReturnURL 是唯一可靠的授權成功通知點。

### Decision 2: 資料庫查詢重試機制

**背景**: Supabase 複製延遲導致 ReturnURL 回調時（授權後 1-2 秒）查詢不到剛創建的 mandate。

**決策**: 實作重試機制

- 使用 `.maybeSingle()` 而非 `.single()` 避免錯誤
- 重試 5 次，每次間隔 1 秒
- 詳細記錄每次嘗試結果

**替代方案考慮**:

1. **增加資料庫連線一致性設定**: ❌ Supabase 託管服務，無法控制
2. **使用交易隔離級別**: ❌ 無法跨越創建和回調的兩個獨立請求
3. **延長前端輪詢時間**: ✅ 作為補充措施，但不足夠

**選擇原因**: 重試機制是最直接且有效的解決方案，能應對大多數延遲情況（1-5 秒）。

### Decision 3: 前端狀態輪詢策略

**背景**: 用戶完成付款後需要即時看到結果，但後端處理可能需要時間。

**決策**:

- 每 2 秒輪詢一次
- 最多輪詢 90 次（3 分鐘）
- 3 次連續錯誤後停止
- 顯示進度計數器 (X/90)

**替代方案考慮**:

1. **WebSocket 即時推送**: ❌ Vercel Edge Functions 不完全支援長連線
2. **Server-Sent Events**: ❌ 複雜度高，且 Vercel 有時間限制
3. **指數退避算法**: ❌ 用戶期望快速反饋，不適合延長間隔

**選擇原因**: 固定間隔輪詢簡單可靠，3 分鐘足以應對絕大多數情況。

### Decision 4: orderNo vs mandateNo 設計

**背景**: 定期定額有兩個編號

- `mandateNo` (MAN 開頭): 委託授權編號
- `orderNo` (ORD 開頭): 首筆訂單編號

**決策**:

- 傳給藍新的 `MerchantOrderNo` 使用 `mandateNo`
- 藍新回調返回的也是 `mandateNo`
- `order-status` API 支援 `mandateNo` 查詢

**替代方案考慮**:

1. **使用 orderNo**: ❌ 無法追蹤委託狀態
2. **兩者都傳**: ❌ 藍新 API 不支援

**選擇原因**: mandateNo 是定期定額的核心識別碼，必須貫穿整個流程。

## Architecture

### Payment Flow Sequence

```
┌─────────┐         ┌──────────┐         ┌─────────┐         ┌─────────┐
│ User    │         │ Frontend │         │ Backend │         │ NewebPay│
└────┬────┘         └────┬─────┘         └────┬────┘         └────┬────┘
     │                   │                     │                   │
     │ 1. 選擇方案       │                     │                   │
     │──────────────────>│                     │                   │
     │                   │ 2. POST /api/payment/recurring/create  │
     │                   │────────────────────>│                   │
     │                   │                     │ 3. INSERT mandate+order
     │                   │                     │ (DB write)        │
     │                   │                     │                   │
     │                   │<────────────────────│                   │
     │                   │ 4. paymentForm      │                   │
     │                   │                     │                   │
     │ 5. 重定向到授權頁 │                     │                   │
     │<──────────────────│                     │                   │
     │                   │                     │                   │
     │                   │ 6. 自動提交表單到藍新               │
     │                   │───────────────────────────────────────>│
     │                   │                     │                   │
     │ 7. 在藍新頁面授權│                     │                   │
     │───────────────────────────────────────────────────────────>│
     │                   │                     │                   │
     │                   │                     │ 8. GET ReturnURL  │
     │                   │                     │<──────────────────│
     │                   │                     │                   │
     │                   │                     │ 9. 查詢 mandate   │
     │                   │                     │ (重試 5 次，1秒間隔)
     │                   │                     │                   │
     │                   │                     │ 10. 更新狀態+創建 subscription
     │                   │                     │                   │
     │                   │                     │ 11. 重定向到 billing
     │ 12. 顯示成功      │<────────────────────│                   │
     │<──────────────────│                     │                   │
     │                   │                     │                   │
```

### Database Schema

```sql
-- 定期定額委託
CREATE TABLE recurring_mandates (
  id UUID PRIMARY KEY,
  mandate_no TEXT UNIQUE NOT NULL,         -- MAN{timestamp}{random}
  company_id UUID NOT NULL,
  plan_id UUID NOT NULL,
  status TEXT NOT NULL,                     -- pending/active/cancelled
  first_payment_order_id UUID,
  newebpay_period_no TEXT,
  newebpay_response JSONB,
  period_type TEXT NOT NULL,                -- D/W/M/Y
  period_point TEXT,
  period_start_type INT NOT NULL,           -- 1/2/3
  period_times INT,
  activated_at TIMESTAMPTZ,
  next_payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支付訂單
CREATE TABLE payment_orders (
  id UUID PRIMARY KEY,
  order_no TEXT UNIQUE NOT NULL,            -- ORD{timestamp}{random}
  company_id UUID NOT NULL,
  order_type TEXT NOT NULL,                 -- onetime/recurring
  payment_type TEXT NOT NULL,               -- subscription/token_package/lifetime
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL,                     -- pending/success/failed
  newebpay_status TEXT,
  newebpay_message TEXT,
  newebpay_response JSONB,
  item_description TEXT,
  related_id UUID,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Endpoints

| 端點                                  | 方法     | 用途                    | 呼叫者          |
| ------------------------------------- | -------- | ----------------------- | --------------- |
| `/api/payment/recurring/create`       | POST     | 創建定期定額委託和訂單  | 前端            |
| `/api/payment/onetime/create`         | POST     | 創建單次付款訂單        | 前端            |
| `/api/payment/recurring/callback`     | GET/POST | ReturnURL 回調處理      | 藍新/用戶瀏覽器 |
| `/api/payment/callback`               | POST     | 單次付款 NotifyURL 回調 | 藍新            |
| `/api/payment/recurring/notify`       | POST     | 定期扣款 NotifyURL 回調 | 藍新            |
| `/api/payment/order-status/[orderNo]` | GET      | 查詢訂單/委託狀態       | 前端輪詢        |

## Risks / Trade-offs

### Risk 1: 資料庫延遲超過 5 秒

**機率**: 低 (< 5%)
**影響**: 高 - 用戶會看到錯誤
**緩解**:

- 前端輪詢作為第二道保險
- 增加後端日誌以快速診斷
- 監控 Supabase 效能指標

### Risk 2: ReturnURL 和 NotifyURL 競爭條件（單次付款）

**機率**: 中 (10-20%)
**影響**: 低 - 任一成功即可
**緩解**:

- 使用資料庫交易確保冪等性
- 記錄完整的回調日誌以事後分析

### Risk 3: 藍新服務中斷

**機率**: 低 (< 1%)
**影響**: 高 - 完全無法付款
**緩解**:

- 顯示清晰的錯誤訊息
- 提供客服聯繫方式
- 考慮未來支援備用支付閘道

### Risk 4: 前端輪詢消耗資源

**機率**: 高 (100% - 設計所致)
**影響**: 低 - 每個用戶每次最多 90 次請求
**緩解**:

- 限制輪詢次數和時間
- 連續錯誤時提前停止
- 考慮使用 Vercel Edge Cache

## Migration Plan

### Phase 1: 規範現有實作（本提案）

1. 建立完整的 spec
2. 驗證現有代碼符合 spec
3. 補充缺失的錯誤處理

### Phase 2: 監控和優化

1. 部署到生產環境
2. 收集真實用戶數據
3. 調整重試次數和輪詢間隔

### Phase 3: 功能擴展

1. 訂閱管理（暫停、恢復、取消）
2. 退款功能
3. 發票開立

### Rollback Plan

若發現嚴重問題：

1. 暫時關閉新付款功能
2. 回滾到前一個穩定版本
3. 檢查資料庫中的 pending 訂單
4. 手動處理受影響的訂單

## Open Questions

1. **Q**: 是否需要支援部分退款？
   **A**: 未來版本，目前不需要

2. **Q**: 重試 5 次是否足夠？
   **A**: 根據初步測試，5 秒能應對大多數情況。部署後監控調整。

3. **Q**: 是否需要藍新測試環境？
   **A**: 是，需要使用藍新提供的測試 MerchantID 和測試信用卡號

4. **Q**: 如何處理重複提交？
   **A**: 使用 orderNo/mandateNo 作為冪等性鍵，資料庫層面防止重複

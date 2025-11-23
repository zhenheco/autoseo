# 任務清單：終身定價重構

## 🎉 實作狀態摘要（2025-11-11）

已完成核心重構工作：

- ✅ **Phase 1**: 資料庫遷移完成（9 → 5 方案，4 用戶成功遷移）
- ✅ **Phase 2**: 後端 API 更新（定期付款停用，一次性付款支援終身）
- ✅ **Phase 3**: 前端定價頁面重構（純終身方案展示）
- ✅ **Phase 4**: Dashboard 訂閱頁面更新（顯示終身方案資訊）
- ✅ **Build 驗證**: TypeScript 編譯成功，無錯誤

**核心成果**：

- 成功從混合定價（月費/年費/終身）轉為純終身定價
- 保留月配額自動重置機制
- 區分「月配額」和「購買 Token」
- 支援層級（community → standard → priority → dedicated）

**FREE 方案特殊配置**：

- ✅ `base_tokens = 0`（不參與月配額）
- ✅ 註冊時一次性贈送 10K tokens
- ✅ 用完就沒了，不會月重置
- ✅ `reset_monthly_quotas()` 函數明確排除 FREE 用戶

**剩餘工作**：

- 測試完整購買流程
- 部署到生產環境
- 用戶通知與文檔更新

---

## ✅ 已完成：前端終身定價展示（Phase 3 部分實作）

- [x] **建立配置檔案**
  - [x] 建立 `src/config/support-tiers.ts` - 客服層級定義

- [x] **更新定價頁面**（`src/app/pricing/page.tsx`）
  - [x] 移除計費週期切換器（Monthly/Yearly/Lifetime）
  - [x] 重新設計為純終身方案展示
  - [x] 僅查詢 `is_lifetime = true` 的方案
  - [x] 新增客服層級說明區塊
  - [x] 保留 Token 購買包區塊
  - [x] 標記 PROFESSIONAL 為推薦方案
  - [x] 驗證建置成功（無 TypeScript 錯誤）

**說明**：
此階段完成了定價頁面的前端展示層變更，使頁面僅顯示終身方案。保持了現有的資料庫結構和 API 不變，避免破壞性變更。這是漸進式重構的第一步，允許系統在過渡期間同時支援舊有的月費/年費訂閱和新的終身方案。

---

## Phase 1: 資料庫準備與遷移

- [ ] **備份現有資料**
  - [ ] 備份 `subscription_plans` 表到 `subscription_plans_backup_20251111`
  - [ ] 備份 `company_subscriptions` 表
  - [ ] 驗證備份完整性（比對行數）

- [ ] **建立新資料庫結構**
  - [ ] 建立 `support_tickets` 表
  - [ ] 建立 `token_usage_logs` 表
  - [ ] 建立 `token_purchases` 表
  - [ ] 建立必要索引（參考 design.md）
  - [ ] 建立 `reset_monthly_quotas()` 函數

- [ ] **執行資料遷移腳本**
  - [ ] 清空 `subscription_plans` 表
  - [ ] 插入新的終身方案資料（FREE, STARTER, PROFESSIONAL, BUSINESS, AGENCY）
  - [ ] 驗證方案資料正確（檢查價格、Token、features）
  - [ ] 更新現有 `company_subscriptions` 記錄，設定 `is_lifetime = true`
  - [ ] 更新 `monthly_token_quota` 根據新方案

- [ ] **驗證資料遷移結果**
  - [ ] 確認所有方案 `support_level` 欄位存在
  - [ ] 確認 Token 配額倍增關係正確（5×、15×、40×）
  - [ ] 確認現有用戶的訂閱未中斷
  - [ ] 執行測試查詢，驗證資料一致性

---

## Phase 2: 後端 API 修改

- [ ] **修改付款 API**
  - [ ] 更新 `/api/payment/create` - 移除 `billingPeriod` 參數
  - [ ] 僅支援終身方案訂單建立（`payment_type = 'lifetime'`）
  - [ ] 拒絕月費/年費訂單請求，返回錯誤訊息
  - [ ] 驗證價格從 `subscription_plans.lifetime_price` 讀取

- [ ] **建立客服層級 API**
  - [ ] 建立 `/api/support/tiers` - 返回所有客服層級定義
  - [ ] 建立 `/api/support/create-ticket` - 建立客服請求
  - [ ] 建立 `/api/support/my-tickets` - 查詢用戶的客服請求
  - [ ] 實作客服渠道存取權限驗證邏輯

- [ ] **更新 Token 餘額 API**
  - [ ] 更新 `/api/token-balance` - 返回詳細餘額資訊
  - [ ] 包含 `monthly_quota` 和 `purchased` 區分
  - [ ] 加入 `next_reset` 日期（僅付費用戶）

- [ ] **實作 Token 扣除服務**
  - [ ] 建立 `src/lib/token/usage-service.ts`
  - [ ] 實作 `deductTokens()` 函數（優先扣月配額）
  - [ ] 使用資料庫事務和悲觀鎖防止競態條件
  - [ ] 插入 `token_usage_logs` 記錄

- [ ] **建立 Token 購買流程**
  - [ ] 更新 `/api/payment/token-package/create` API
  - [ ] 購買成功後更新 `purchased_token_balance`
  - [ ] 插入 `token_purchases` 記錄

---

## Phase 3: 前端配置檔案與組件

- [ ] **建立配置檔案**
  - [ ] 建立 `src/config/support-tiers.ts` - 客服層級定義
  - [ ] 建立 `src/types/support.ts` - TypeScript 型別定義
  - [ ] 建立 `src/types/token.ts` - Token 相關型別

- [ ] **建立可重用組件**
  - [ ] 建立 `src/components/pricing/PricingCard.tsx`
  - [ ] 建立 `src/components/pricing/SupportTierBadge.tsx`
  - [ ] 建立 `src/components/pricing/FeatureList.tsx`
  - [ ] 建立 `src/components/pricing/TokenCalculator.tsx`
  - [ ] 建立 `src/components/pricing/PricingComparison.tsx`

- [ ] **建立 Token 餘額組件**
  - [ ] 建立 `src/components/dashboard/TokenBalanceCard.tsx`（重構現有）
  - [ ] 區分顯示月配額和購買包餘額
  - [ ] 顯示下次重置日期（僅付費用戶）

---

## Phase 4: 定價頁面重構

- [ ] **完全重寫定價頁面**
  - [ ] 移除計費週期切換器（`<BillingPeriodToggle />`）
  - [ ] 使用新的 `<PricingCard />` 組件
  - [ ] 僅顯示終身方案（過濾掉 FREE）
  - [ ] 標記 PROFESSIONAL 為「推薦」
  - [ ] 新增「一次付清，終身享有」標語

- [ ] **新增客服層級說明區塊**
  - [ ] 在定價表格下方新增客服層級對照表
  - [ ] 顯示各層級的響應時間、渠道、額外服務
  - [ ] 使用 `<SupportTierBadge />` 組件

- [ ] **新增 Token 購買包區塊**
  - [ ] 在定價頁面底部顯示「彈性加值包」
  - [ ] 顯示三個購買包（10K, 50K, 100K）
  - [ ] 標註「永不過期」

- [ ] **實作響應式設計**
  - [ ] 桌面版：4 欄並排
  - [ ] 平板：2 欄並排
  - [ ] 手機：單欄堆疊

---

## Phase 5: Dashboard 與訂閱頁面

- [ ] **更新 Dashboard Token 顯示**
  - [ ] 使用新的 `<TokenBalanceCard />` 組件
  - [ ] 顯示總餘額、月配額、購買包餘額
  - [ ] 顯示下次重置日期（僅付費用戶）
  - [ ] 免費用戶顯示「一次性配額，永不過期」

- [ ] **更新訂閱頁面**（`src/app/(dashboard)/dashboard/subscription/page.tsx`）
  - [ ] 移除「到期日」和「續約日期」顯示
  - [ ] 顯示「終身有效」狀態
  - [ ] 保留「月配額重置日」（current_period_end）
  - [ ] 更新升級按鈕邏輯（僅顯示更高方案）

- [ ] **建立客服請求頁面**
  - [ ] 建立 `/dashboard/support/new` 頁面
  - [ ] 根據用戶方案顯示可用渠道（Email、聊天、電話）
  - [ ] 不符合層級時顯示升級提示
  - [ ] 建立 `/dashboard/support/tickets` 頁面顯示歷史請求

---

## Phase 6: Token 管理功能

- [ ] **建立 Token 使用記錄頁面**
  - [ ] 建立 `/dashboard/billing/token-usage` 頁面
  - [ ] 顯示使用歷史表格（日期、動作、消耗量、來源）
  - [ ] 顯示使用趨勢圖表（每日/每月）
  - [ ] 按動作類型分組（文章生成 vs 圖片生成）

- [ ] **建立 Token 購買歷史頁面**
  - [ ] 建立 `/dashboard/billing/token-purchases` 頁面
  - [ ] 顯示購買記錄表格（日期、購買包、數量、金額）
  - [ ] 顯示當前 `purchased_token_balance`

- [ ] **更新文章管理頁面**
  - [ ] 顯示預估 Token 消耗
  - [ ] 餘額不足時顯示「購買 Token」按鈕
  - [ ] 連結到定價頁面的 Token 購買包區塊

---

## Phase 7: Cron Job 與自動化

- [ ] **建立月配額重置 Cron Job**
  - [ ] 建立 `src/lib/cron/reset-monthly-quota.ts`
  - [ ] 實作 `resetMonthlyQuota()` 函數
  - [ ] 呼叫 `reset_monthly_quotas()` 資料庫函數
  - [ ] 發送重置通知郵件

- [ ] **設定 Vercel Cron 或 Edge Function**
  - [ ] 在 `vercel.json` 設定 cron: `'0 0 1 * *'`（每月 1 日）
  - [ ] 或使用 Supabase Edge Function + pg_cron
  - [ ] 驗證 cron 正確執行（測試環境）

- [ ] **建立異常使用偵測**
  - [ ] 實作每日使用量監控
  - [ ] 偵測單日使用量 > 50% 月配額
  - [ ] 發送警報郵件給管理員

---

## Phase 8: 測試

- [ ] **單元測試**
  - [ ] 測試 `deductTokens()` 函數（優先順序邏輯）
  - [ ] 測試 `canAccessSupportChannel()` 權限驗證
  - [ ] 測試 Token 餘額計算邏輯
  - [ ] 測試月配額重置邏輯

- [ ] **整合測試**
  - [ ] 測試 `/api/payment/create` API（終身方案訂單）
  - [ ] 測試 `/api/support/create-ticket` API（權限驗證）
  - [ ] 測試 `/api/token-balance` API（餘額回應格式）

- [ ] **E2E 測試（Playwright）**
  - [ ] 測試定價頁面瀏覽和方案選擇流程
  - [ ] 測試購買流程（選方案 → 跳轉授權頁）
  - [ ] 測試 Dashboard Token 顯示
  - [ ] 測試客服請求建立流程

- [ ] **效能測試**
  - [ ] 定價頁面載入時間 < 2s (p95)
  - [ ] `/api/token-balance` 回應時間 < 500ms (p95)
  - [ ] Token 扣除操作無競態條件（並發測試）

---

## Phase 9: 文件與監控

- [ ] **更新使用者文件**
  - [ ] 撰寫終身定價說明文件
  - [ ] 撰寫 Token 購買包使用指南
  - [ ] 撰寫客服層級說明文件

- [ ] **建立管理員文件**
  - [ ] 撰寫資料遷移回滾指南
  - [ ] 撰寫 Cron Job 維護文件
  - [ ] 撰寫異常使用處理流程

- [ ] **設定監控與警報**
  - [ ] 在 Sentry 設定錯誤追蹤（InsufficientTokensError 等）
  - [ ] 在 Vercel Analytics 追蹤定價頁面轉換率
  - [ ] 設定客服 SLA 違約警報（Slack 通知）

---

## Phase 10: 部署與灰度發布

- [ ] **部署到 Staging 環境**
  - [ ] 執行資料庫遷移（測試環境）
  - [ ] 部署後端 API 變更
  - [ ] 部署前端變更
  - [ ] 手動測試完整購買流程

- [ ] **功能開關配置**
  - [ ] 設定 `NEXT_PUBLIC_LIFETIME_ONLY` 環境變數
  - [ ] 驗證功能開關切換正常

- [ ] **灰度發布（Production）**
  - [ ] Week 1: 10% 新用戶看到新定價頁（A/B 測試）
  - [ ] Week 2: 50% 新用戶
  - [ ] Week 3: 100% 新用戶
  - [ ] Week 4: 所有用戶遷移至新頁面

- [ ] **監控部署後指標**
  - [ ] 轉換率（定價頁 → 支付完成）
  - [ ] 平均訂單價值（AOV）
  - [ ] 方案分布比例
  - [ ] 錯誤率

- [ ] **回滾準備**
  - [ ] 準備前端回滾命令（`git revert`）
  - [ ] 準備資料庫回滾腳本
  - [ ] 設定回滾觸發條件（轉換率下降 > 30%）

---

## Phase 11: 現有用戶遷移與溝通

- [ ] **建立用戶遷移計畫**
  - [ ] 設計月費/年費用戶的遷移優惠（如 50% 折扣）
  - [ ] 建立遷移優惠頁面（`/upgrade-to-lifetime`）
  - [ ] 設定優惠代碼系統

- [ ] **發送用戶通知郵件**
  - [ ] 撰寫郵件內容（說明定價變更、遷移優惠）
  - [ ] 分批發送（月費用戶 → 年費用戶）
  - [ ] 追蹤郵件開啟率和點擊率

- [ ] **建立 FAQ 頁面**
  - [ ] 「為什麼改為終身定價?」
  - [ ] 「現有月費用戶如何遷移?」
  - [ ] 「Token 會過期嗎?」
  - [ ] 「如何升級到更高方案?」

---

## Phase 12: 優化與迭代

- [ ] **分析轉換漏斗**
  - [ ] 找出用戶流失點（定價頁、授權頁、支付頁）
  - [ ] 優化流失率高的頁面

- [ ] **A/B 測試不同定價點**
  - [ ] 測試 PROFESSIONAL 價格（NT$ 59,900 vs NT$ 49,900）
  - [ ] 測試不同的「推薦」標記位置

- [ ] **收集用戶反饋**
  - [ ] 在定價頁新增反饋按鈕
  - [ ] 追蹤用戶評論和客服請求主題
  - [ ] 根據反饋調整定價策略

- [ ] **效能優化**
  - [ ] 快取定價頁面資料（revalidate: 3600）
  - [ ] 快取 Token 餘額（Redis TTL 30 秒）
  - [ ] 優化資料庫查詢（建立索引）

---

## 驗證檢查清單

完成所有任務後，確認：

- [ ] ✅ 所有單元測試通過
- [ ] ✅ 所有整合測試通過
- [ ] ✅ E2E 測試通過
- [ ] ✅ 定價頁面載入時間 < 2s
- [ ] ✅ Token 扣除無競態條件
- [ ] ✅ 月配額重置 Cron Job 正常執行
- [ ] ✅ 現有用戶訂閱未中斷
- [ ] ✅ 資料庫備份可成功回滾
- [ ] ✅ 錯誤率 < 1%
- [ ] ✅ 轉換率 ≥ 15%
- [ ] ✅ 用戶滿意度 ≥ 4.5/5

---

## 估計時程

- **Phase 1-2（資料庫與後端）**: 3-5 天
- **Phase 3-5（前端組件與頁面）**: 5-7 天
- **Phase 6（Token 管理）**: 2-3 天
- **Phase 7（Cron Job）**: 1-2 天
- **Phase 8（測試）**: 3-4 天
- **Phase 9（文件）**: 1-2 天
- **Phase 10（部署）**: 1-2 天（含灰度發布 4 週）
- **Phase 11（用戶遷移）**: 2-3 天
- **Phase 12（優化迭代）**: 持續進行

**總計**：約 18-25 工作日（不含灰度發布期間）

---

## 依賴與風險

**關鍵依賴**：

- 藍新金流 API 穩定性
- Supabase 資料庫效能
- Vercel Cron 可靠性

**主要風險**：

- 資料遷移錯誤導致用戶資料遺失（緩解：完整備份）
- 轉換率大幅下降（緩解：灰度發布 + A/B 測試）
- 現有用戶不滿（緩解：遷移優惠 + 清晰溝通）

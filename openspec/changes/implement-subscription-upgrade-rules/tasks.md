# Tasks for implement-subscription-upgrade-rules

## Phase 1: 修正階層定義（30 分鐘）

- [ ] 修正 `src/lib/subscription/upgrade-rules.ts` 中的 `TIER_HIERARCHY` 常數
  - 將 `starter: 1` 保持不變
  - 將 `professional: 3` 改為 `professional: 2`
  - 將 `business: 2` 改為 `business: 3`
  - 將 `agency: 4` 保持不變
  - 更新註解說明正確的階層順序

- [ ] 驗證階層定義與實際定價一致
  - 執行 `npm run typecheck` 確保類型正確
  - 手動驗證：Starter ($599) < Professional ($2,499) < Business ($5,999) < Agency ($11,999)

## Phase 2: 實作終身方案升級規則（45 分鐘）

- [ ] 修改 `canUpgrade()` 函式 - 終身方案邏輯
  - 將「終身方案 → 不允許任何變更」的邏輯移到函式開頭
  - 修改為：
    ```typescript
    if (currentBillingPeriod === 'lifetime') {
      // 允許升級到更高階層的終身方案
      if (targetTierLevel > currentTierLevel && targetBillingPeriod === 'lifetime') {
        return true
      }
      // 其他情況都不允許（降級或縮短週期）
      return false
    }
    ```

- [ ] 修改 `canUpgrade()` 函式 - 跨階層週期檢查
  - 在「升級到更高階層」的判斷後，加入計費週期檢查
  - 如果目標階層 > 當前階層：
    - 檢查計費週期是否縮短（年→月）
    - 如果縮短則返回 `false`
    - 否則返回 `true`

- [ ] 加入計費週期比較輔助函式
  ```typescript
  function isBillingPeriodShorter(
    current: BillingPeriod,
    target: BillingPeriod
  ): boolean {
    const periodValue = { 'monthly': 1, 'yearly': 2, 'lifetime': 3 }
    return periodValue[target] < periodValue[current]
  }
  ```

- [ ] 更新 `getUpgradeBlockReason()` 函式
  - 修改終身方案的錯誤訊息：
    - 如果目標階層 > 當前階層但不是終身：「終身方案不能變更為月繳或年繳」
    - 如果目標階層 < 當前階層：「無法降級到低階層方案」
  - 加入新的錯誤訊息：「跨階層升級不能縮短計費週期」
  - 在跨階層但縮短週期時返回此訊息

## Phase 3: 撰寫單元測試（1.5 小時）

- [ ] 建立測試檔案 `src/lib/subscription/upgrade-rules.test.ts`

- [ ] 測試階層定義正確性
  - 驗證 `TIER_HIERARCHY['starter'] === 1`
  - 驗證 `TIER_HIERARCHY['professional'] === 2`（從 3 改為 2）
  - 驗證 `TIER_HIERARCHY['business'] === 3`（從 2 改為 3）
  - 驗證 `TIER_HIERARCHY['agency'] === 4`

- [ ] 測試同階層升級規則
  - ✅ 月繳 Starter → 年繳 Starter
  - ✅ 月繳 Business → 終身 Business
  - ✅ 年繳 Agency → 終身 Agency
  - ❌ 年繳 Starter → 月繳 Starter
  - ❌ 終身 Business → 年繳 Business
  - ❌ 終身 Agency → 月繳 Agency

- [ ] 測試跨階層 + 延長週期
  - ✅ 月繳 Starter → 年繳 Professional
  - ✅ 月繳 Starter → 終身 Business
  - ✅ 月繳 Professional → 年繳 Agency
  - ✅ 年繳 Starter → 終身 Professional

- [ ] 測試跨階層 + 相同週期
  - ✅ 月繳 Starter → 月繳 Business
  - ✅ 年繳 Professional → 年繳 Agency
  - ✅ 月繳 Professional → 月繳 Business

- [ ] 測試跨階層 + 縮短週期
  - ❌ 年繳 Starter → 月繳 Professional
  - ❌ 年繳 Business → 月繳 Agency
  - ❌ 年繳 Professional → 月繳 Agency

- [ ] 測試終身方案升級規則（新增）
  - ✅ 終身 Starter → 終身 Professional
  - ✅ 終身 Starter → 終身 Business
  - ✅ 終身 Starter → 終身 Agency
  - ✅ 終身 Professional → 終身 Business
  - ✅ 終身 Professional → 終身 Agency
  - ✅ 終身 Business → 終身 Agency
  - ❌ 終身 Starter → 月繳 Professional
  - ❌ 終身 Starter → 年繳 Business
  - ❌ 終身 Business → 終身 Starter（降級）
  - ❌ 終身 Agency → 終身 Professional（降級）

- [ ] 測試階層降級
  - ❌ 月繳 Business → 月繳 Professional
  - ❌ 年繳 Agency → 年繳 Business
  - ❌ 終身 Business → 終身 Professional

- [ ] 測試新用戶情況
  - ✅ `currentTierSlug = null` → 允許訂閱任何方案

- [ ] 執行測試並確保 100% 覆蓋率
  - `npm run test -- upgrade-rules.test.ts`
  - 檢查測試覆蓋率報告
  - 驗證所有分支都被測試覆蓋

## Phase 4: 更新前端邏輯（30 分鐘）

- [ ] 確認 `src/app/pricing/page.tsx` 使用正確的升級規則
  - 驗證 `canUpgradeWrapper()` 正確調用新邏輯
  - 驗證 `isCurrentPlan()` 仍然正常工作

- [ ] 更新訂閱管理頁面
  - 檢查 `src/app/(dashboard)/dashboard/subscription/subscription-plans.tsx`
  - 確保使用相同的升級規則邏輯

- [ ] 測試前端按鈕狀態
  - 可升級方案顯示「升級」按鈕
  - 不可升級方案顯示「目前方案」或禁用
  - 低階層方案不顯示或顯示「不可用」

## Phase 5: 後端驗證強化（30 分鐘）

- [ ] 檢查 `src/app/api/payment/recurring/create/route.ts`
  - 確認已有升級規則驗證（在之前的 commit 中已加入）
  - 驗證錯誤訊息清晰友善

- [ ] 加入詳細日誌
  - 記錄升級驗證結果
  - 記錄被拒絕的升級嘗試

- [ ] 測試 API 端點
  - 使用 Postman 或 curl 測試各種升級場景
  - 驗證錯誤回應格式正確

## Phase 6: 集成測試與驗證（30 分鐘）

- [ ] 執行完整建置
  - `npm run build`
  - 確保無 TypeScript 錯誤
  - 確保無 Lint 錯誤

- [ ] 本地測試完整升級流程
  - 登入測試帳號
  - 測試各種升級路徑
  - 驗證前端顯示與後端驗證一致

- [ ] 檢查邊界情況
  - 終身方案用戶嘗試升級
  - 新用戶首次訂閱
  - 跨多個階層的升級

- [ ] 更新文件
  - 更新 `upgrade-rules.ts` 的 JSDoc 註解
  - 確保範例程式碼正確

## Phase 7: 部署前檢查（15 分鐘）

- [ ] 執行所有測試
  - `npm run test`
  - `npm run typecheck`
  - `npm run lint`

- [ ] 檢查 git 狀態
  - 確認所有修改都已加入
  - 確認沒有遺漏的檔案

- [ ] 準備 commit message
  - 格式：「實作: 完整的訂閱升級規則驗證系統」
  - 說明修正的階層順序和新增的跨階層週期規則

## Phase 8: 部署與監控（持續）

- [ ] 部署到 production
  - `git push origin main`
  - 等待 Vercel 部署完成

- [ ] 監控部署日誌
  - 檢查是否有升級相關錯誤
  - 驗證升級規則正常運作

- [ ] 記錄在 ISSUELOG.md
  - 記錄修正的問題
  - 記錄新的升級規則邏輯

# 端到端測試計劃 - 升級規則驗證

## 測試環境
- **測試用戶**: ace@zhenhe-co.com
- **當前狀態**:
  - Tier: `pro` (level 2)
  - 無 active mandate
  - Token 餘額: 210,000

## 測試案例

### Test 1: 無訂閱用戶（Free Tier）
**目標**: 驗證 free tier 用戶可以訂閱任何方案

**前置條件**:
- 確認用戶沒有 active mandate
- Company tier 為 free 或 basic

**測試步驟**:
1. 登入 Pricing 頁面
2. 檢查所有方案按鈕狀態
3. 嘗試訂閱 Starter 月繳方案

**預期結果**:
- ✅ 所有方案按鈕都應該是可點擊的
- ✅ 顯示「開始使用」而非「目前方案」或「無法升級」
- ✅ 可以成功建立訂閱

### Test 2: 月繳用戶升級到年繳（同階層）
**目標**: 驗證月繳可以升級到年繳

**前置條件**:
- 建立一個 Starter 月繳訂閱（mandate status = active）

**測試步驟**:
1. 確認當前有 active Starter 月繳 mandate
2. 訪問 Pricing 頁面
3. 檢查 Starter 年繳按鈕狀態
4. 嘗試升級到 Starter 年繳

**預期結果**:
- ✅ Starter 月繳顯示「目前方案」且 disabled
- ✅ Starter 年繳顯示可升級（enabled）
- ✅ Business/Professional/Agency 都可升級
- ✅ 後端接受 Starter 年繳訂閱請求

### Test 3: 年繳用戶無法降級到月繳（同階層）
**目標**: 驗證年繳無法降級到月繳

**前置條件**:
- 建立一個 Starter 年繳訂閱（mandate status = active）

**測試步驟**:
1. 確認當前有 active Starter 年繳 mandate
2. 訪問 Pricing 頁面
3. 檢查 Starter 月繳按鈕狀態
4. 嘗試降級到 Starter 月繳（如果按鈕可點擊）

**預期結果**:
- ✅ Starter 月繳按鈕應該 disabled 並顯示「無法升級」
- ✅ Starter 年繳顯示「目前方案」且 disabled
- ✅ 如果強制發送 API 請求，後端應返回 400 錯誤

### Test 4: 跨階層升級（Business → Professional）
**目標**: 驗證可以升級到更高階層

**前置條件**:
- 建立一個 Business 月繳訂閱（mandate status = active）

**測試步驟**:
1. 確認當前有 active Business 月繳 mandate
2. 訪問 Pricing 頁面
3. 檢查 Professional 和 Agency 按鈕狀態
4. 嘗試升級到 Professional 月繳

**預期結果**:
- ✅ Business 月繳顯示「目前方案」且 disabled
- ✅ Professional 和 Agency 都可升級（enabled）
- ✅ Starter 按鈕 disabled（無法降級）
- ✅ 後端接受 Professional 訂閱請求

### Test 5: 無法降級到低階層
**目標**: 驗證無法降級到低階層方案

**前置條件**:
- 建立一個 Professional 月繳訂閱（mandate status = active）

**測試步驟**:
1. 確認當前有 active Professional 月繳 mandate
2. 訪問 Pricing 頁面
3. 檢查 Starter 和 Business 按鈕狀態
4. 嘗試降級到 Business 月繳（如果按鈕可點擊）

**預期結果**:
- ✅ Starter 和 Business 按鈕都應該 disabled
- ✅ 顯示「無法升級」或類似訊息
- ✅ Professional 月繳顯示「目前方案」
- ✅ Agency 可升級
- ✅ 如果強制發送 API 請求，後端應返回 400 錯誤

### Test 6: 終身方案無法變更（需要準備終身訂閱）
**目標**: 驗證終身方案無法變更到任何方案

**前置條件**:
- 購買一個終身方案（is_lifetime = true）

**測試步驟**:
1. 確認當前有 lifetime mandate
2. 訪問 Pricing 頁面
3. 檢查所有按鈕狀態

**預期結果**:
- ✅ 當前終身方案顯示「目前方案」且 disabled
- ✅ 所有其他方案（包括更高階層）都應該 disabled
- ✅ 顯示「終身方案無法變更」或類似訊息
- ✅ 如果強制發送 API 請求，後端應返回 400 錯誤並記錄「終身方案無法變更」

## 後端驗證測試

### Test 7: API 驗證 - 有效升級
**測試**: 發送有效的升級請求到 `/api/payment/recurring/create`

**請求**:
```json
{
  "planId": "<professional_plan_id>",
  "periodType": "M",
  "periodStartType": 1
}
```

**預期**:
- ✅ 返回 200 status
- ✅ 成功建立 mandate
- ✅ 日誌顯示「升級驗證通過」

### Test 8: API 驗證 - 無效降級
**測試**: 發送降級請求（從 Professional 到 Business）

**請求**:
```json
{
  "planId": "<business_plan_id>",
  "periodType": "M",
  "periodStartType": 1
}
```

**預期**:
- ✅ 返回 400 status
- ✅ 錯誤訊息：「無法降級到低階層方案」
- ✅ 日誌顯示「升級驗證失敗」

### Test 9: API 驗證 - 終身無法變更
**測試**: 從終身方案嘗試變更

**預期**:
- ✅ 返回 400 status
- ✅ 錯誤訊息：「終身方案無法變更」
- ✅ 日誌記錄驗證失敗原因

## 測試執行記錄

| Test | 狀態 | 執行時間 | 備註 |
|------|------|---------|------|
| Test 1 | ✅ PASS | 2025-11-04 | 自動化測試通過 |
| Test 2 | ✅ PASS | 2025-11-04 | 自動化測試通過（修正後） |
| Test 3 | ✅ PASS | 2025-11-04 | 自動化測試通過 |
| Test 4 | ✅ PASS | 2025-11-04 | 自動化測試通過 |
| Test 5 | ✅ PASS | 2025-11-04 | 自動化測試通過 |
| Test 6 | ✅ PASS | 2025-11-04 | 自動化測試通過 |
| Test 7 | ✅ PASS | 2025-11-04 | Unit tests 通過 |
| Test 8 | ✅ PASS | 2025-11-04 | Unit tests 通過 |
| Test 9 | ✅ PASS | 2025-11-04 | Unit tests 通過 |

### 自動化測試結果

**測試腳本**: `src/scripts/test-upgrade-rules.ts`
- 總計: 6 個自動化測試
- ✅ 通過: 6
- ❌ 失敗: 0

**單元測試**: `src/lib/subscription/upgrade-rules.test.ts`
- 總計: 19 個單元測試
- ✅ 通過: 19
- ❌ 失敗: 0

### 發現並修正的問題

1. **問題**: `getUpgradeBlockReason()` 對月繳→年繳升級返回「無法縮短計費週期」
   - **根本原因**: 同階層邏輯未正確處理允許的升級情況
   - **修正**: 在 `getUpgradeBlockReason()` 中明確檢查允許的升級路徑
   - **檔案**: `src/lib/subscription/upgrade-rules.ts:163-185`
   - **測試**: 修正後所有測試通過

## 測試工具
- Chrome DevTools (使用 chrome-devtools skill)
- Vercel Logs (監控後端日誌)
- Database queries (驗證資料狀態)

# 手動測試指南 - 升級規則驗證

## 測試環境
- **測試網址**: https://seo.zhenhe-dm.com/zh/pricing
- **測試用戶**: ace@zhenhe-co.com
- **當前狀態**: Pro tier, 無 active mandate

## 開始測試前準備

1. **開啟 Chrome DevTools**
   - 按 `Cmd+Option+J` (Mac) 或 `Ctrl+Shift+J` (Windows)
   - 切換到 Console 面板

2. **登入測試帳號**
   - Email: ace@zhenhe-co.com
   - Password: [您的密碼]

3. **導航到 Pricing 頁面**
   - URL: https://seo.zhenhe-dm.com/zh/pricing

---

## Test 1: 無訂閱用戶（Free Tier）

**前置條件**:
- ✅ 當前用戶無 active mandate（已確認）

**測試步驟**:
1. 在 Pricing 頁面檢查所有方案按鈕
2. 在 Console 執行以下指令檢查按鈕狀態：
   ```javascript
   // 檢查所有訂閱按鈕
   const buttons = Array.from(document.querySelectorAll('button')).filter(b =>
     b.textContent.includes('開始使用') ||
     b.textContent.includes('目前方案') ||
     b.textContent.includes('無法升級')
   );

   buttons.forEach((btn, i) => {
     console.log(`Button ${i + 1}:`, {
       text: btn.textContent,
       disabled: btn.disabled,
       className: btn.className
     });
   });
   ```

**預期結果**:
- ✅ 所有方案按鈕顯示「開始使用」
- ✅ 所有按鈕都是 enabled (不是 disabled)
- ✅ 可以點擊任何方案按鈕

**實際結果**: [請填寫]

---

## Test 2: 建立 Starter 月繳訂閱

**測試步驟**:
1. 點擊 Starter 月繳方案的「開始使用」按鈕
2. 在 Console 查看是否有錯誤
3. 檢查是否成功跳轉到支付頁面

**監控 Console**:
```javascript
// 在點擊前執行此指令，監控 API 請求
console.log('開始監控 API 請求...');

// 監控所有網路錯誤
window.addEventListener('error', (e) => {
  console.error('錯誤:', e.message);
});

// 監控未處理的 Promise rejection
window.addEventListener('unhandledrejection', (e) => {
  console.error('Promise 錯誤:', e.reason);
});
```

**預期結果**:
- ✅ 成功建立訂閱請求
- ✅ 跳轉到藍新金流支付頁面
- ✅ Console 無錯誤訊息

**實際結果**: [請填寫]

---

## Test 3: 月繳用戶升級到年繳（同階層）

**前置條件**:
- 需要先完成 Test 2，建立 Starter 月繳訂閱
- 等待支付完成後回到 Pricing 頁面

**測試步驟**:
1. 確認當前有 active Starter 月繳 mandate
2. 檢查資料庫確認狀態：
   ```bash
   npm run check-user
   ```
3. 重新訪問 Pricing 頁面
4. 檢查按鈕狀態：
   ```javascript
   const buttons = Array.from(document.querySelectorAll('button')).filter(b =>
     b.textContent.includes('開始使用') ||
     b.textContent.includes('目前方案') ||
     b.textContent.includes('無法升級')
   );

   buttons.forEach((btn, i) => {
     console.log(`Button ${i + 1}:`, {
       text: btn.textContent,
       disabled: btn.disabled
     });
   });
   ```

**預期結果**:
- ✅ Starter 月繳顯示「目前方案」且 disabled
- ✅ Starter 年繳顯示「開始使用」且 enabled（可升級）
- ✅ Business/Professional/Agency 都可升級
- ✅ 點擊 Starter 年繳可以成功建立訂閱

**實際結果**: [請填寫]

---

## Test 4: 年繳用戶無法降級到月繳（同階層）

**前置條件**:
- 如果已經有 Starter 年繳訂閱，可以直接測試
- 否則需要先建立 Starter 年繳訂閱

**測試步驟**:
1. 確認當前有 active Starter 年繳 mandate
2. 訪問 Pricing 頁面
3. 檢查 Starter 月繳按鈕狀態

**預期結果**:
- ✅ Starter 月繳按鈕 disabled 並顯示「無法升級」
- ✅ Starter 年繳顯示「目前方案」且 disabled
- ✅ 如果強制發送 API 請求，後端應返回 400 錯誤

**測試後端驗證**（在 Console 執行）:
```javascript
// 強制發送降級請求（應該失敗）
fetch('/api/payment/recurring/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    planId: 'starter_plan_id',  // 替換為實際 plan ID
    periodType: 'M',
    periodStartType: 1
  })
})
.then(r => r.json())
.then(data => console.log('API 回應:', data))
.catch(err => console.error('錯誤:', err));
```

**實際結果**: [請填寫]

---

## Test 5: 跨階層升級（Starter → Business）

**前置條件**:
- 當前有 Starter 訂閱（月繳或年繳皆可）

**測試步驟**:
1. 訪問 Pricing 頁面
2. 檢查 Business 和 Professional 按鈕狀態
3. 嘗試點擊 Business 月繳或年繳

**預期結果**:
- ✅ Business 和 Professional 都可升級（enabled）
- ✅ Starter 按鈕 disabled（無法降級）
- ✅ 後端接受 Business 訂閱請求

**實際結果**: [請填寫]

---

## Test 6: 無法降級到低階層

**前置條件**:
- 建立一個 Professional 或 Business 訂閱

**測試步驟**:
1. 訪問 Pricing 頁面
2. 檢查 Starter 按鈕狀態
3. 嘗試強制發送降級請求（使用上面的 API 測試代碼）

**預期結果**:
- ✅ Starter 按鈕 disabled
- ✅ 顯示「無法升級」或類似訊息
- ✅ 如果強制發送 API 請求，後端應返回 400 錯誤並記錄「無法降級到低階層方案」

**實際結果**: [請填寫]

---

## Test 7: 終身方案無法變更

**注意**: 此測試需要購買終身方案，成本較高，可以選擇跳過或使用測試環境

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

**實際結果**: [請填寫或標記為 SKIPPED]

---

## Test 8-9: 後端 API 驗證

**測試**: 使用 Vercel Logs 監控後端日誌

1. **開啟日誌監控**:
   ```bash
   vercel logs seo.zhenhe-dm.com --scope acejou27s-projects --follow
   ```

2. **執行升級請求**，觀察日誌：
   - 有效升級：應該看到「[API] 升級驗證通過」
   - 無效降級：應該看到「[API] 升級驗證失敗」和錯誤原因

**預期日誌**:
```
有效升級:
[API] 升級驗證通過: {
  currentTierSlug: 'starter',
  currentBillingPeriod: 'monthly',
  targetPlanSlug: 'business',
  targetBillingPeriod: 'monthly'
}

無效降級:
[API] 升級驗證失敗: {
  currentTierSlug: 'business',
  currentBillingPeriod: 'monthly',
  targetPlanSlug: 'starter',
  targetBillingPeriod: 'monthly',
  reason: '無法降級到低階層方案'
}
```

---

## 測試完成後

1. **記錄所有測試結果**到 `TEST_PLAN.md`
2. **截圖重要的測試畫面**（特別是按鈕狀態和 Console 輸出）
3. **如果發現任何問題**，記錄到 `ISSUELOG.md`

## 檢查資料庫狀態

隨時可以使用此指令檢查當前訂閱狀態：
```bash
npm run check-user
```

或直接執行：
```bash
npx tsx src/scripts/check-user-subscription.ts
```

# Proposal: Implement Subscription Upgrade Rules

## Change ID
implement-subscription-upgrade-rules

## Why

目前的訂閱升級規則邏輯存在以下問題：

1. **階層定義錯誤**：代碼中的階層順序與實際定價不符
   - 代碼定義：Starter (1) < Business (2) < Professional (3) < Agency (4)
   - 實際定價：Starter (NT$599) < Professional (NT$2,499) < Business (NT$5,999) < Agency (NT$11,999)

2. **跨階層升級時計費週期規則不完整**：
   - 目前允許任何階層提升，不考慮計費週期變化
   - 例如：允許「月繳 Business → 終身 Professional」（實際上是降階 + 延長週期）

3. **缺少跨階層 + 計費週期的複合規則**：
   - 需要明確規範：跨階層升級時，計費週期是否可以縮短

## What Changes

### 核心升級規則

#### 階層規則
- **正確的階層順序**：Starter (1) < Professional (2) < Business (3) < Agency (4)
- **不能降階**：目標階層必須 ≥ 當前階層

#### 計費週期規則
- **週期順序**：月繳 (M) < 年繳 (Y) < 終身 (L)
- **同階層升級**：只能延長計費週期（月→年、年→終身、月→終身）
- **跨階層升級**：
  - ✅ 階層提升 + 計費週期延長或相同
  - ❌ 階層提升 + 計費週期縮短

#### 特殊規則
- 終身方案可以升級到更高階層的終身方案
- 終身方案不能降級到低階層（無論計費週期）
- 終身方案不能縮短計費週期（變成月繳或年繳）
- 當前方案無法「升級」到相同方案

### 升級規則矩陣

| 當前方案 | 當前週期 | 目標方案 | 目標週期 | 允許？ | 規則 |
|---------|---------|---------|---------|-------|------|
| Starter | 月繳 | Starter | 年繳 | ✅ | 同階層延長 |
| Starter | 月繳 | Starter | 終身 | ✅ | 同階層延長 |
| Starter | 月繳 | Professional | 月繳 | ✅ | 跨階層同週期 |
| Starter | 月繳 | Professional | 年繳 | ✅ | 跨階層延長 |
| Starter | 月繳 | Professional | 終身 | ✅ | 跨階層延長 |
| Starter | 月繳 | Business | 月繳 | ✅ | 跨階層同週期 |
| Starter | 月繳 | Business | 年繳 | ✅ | 跨階層延長 |
| Starter | 月繳 | Business | 終身 | ✅ | 跨階層延長 |
| Starter | 月繳 | Agency | 月繳 | ✅ | 跨階層同週期 |
| Starter | 月繳 | Agency | 年繳 | ✅ | 跨階層延長 |
| Starter | 月繳 | Agency | 終身 | ✅ | 跨階層延長 |
| Starter | 年繳 | Starter | 月繳 | ❌ | 同階層縮短 |
| Starter | 年繳 | Starter | 終身 | ✅ | 同階層延長 |
| Starter | 年繳 | Professional | 月繳 | ❌ | 跨階層縮短 |
| Starter | 年繳 | Professional | 年繳 | ✅ | 跨階層同週期 |
| Starter | 年繳 | Professional | 終身 | ✅ | 跨階層延長 |
| Starter | 年繳 | Business | 月繳 | ❌ | 跨階層縮短 |
| Starter | 年繳 | Business | 年繳 | ✅ | 跨階層同週期 |
| Starter | 年繳 | Business | 終身 | ✅ | 跨階層延長 |
| Starter | 年繳 | Agency | 月繳 | ❌ | 跨階層縮短 |
| Starter | 年繳 | Agency | 年繳 | ✅ | 跨階層同週期 |
| Starter | 年繳 | Agency | 終身 | ✅ | 跨階層延長 |
| Starter | 終身 | Starter | 月繳 | ❌ | 終身不能縮短週期 |
| Starter | 終身 | Starter | 年繳 | ❌ | 終身不能縮短週期 |
| Starter | 終身 | Professional | 終身 | ✅ | 跨階層升級 |
| Starter | 終身 | Business | 終身 | ✅ | 跨階層升級 |
| Starter | 終身 | Agency | 終身 | ✅ | 跨階層升級 |
| Starter | 終身 | Professional | 月繳 | ❌ | 終身不能縮短週期 |
| Starter | 終身 | Professional | 年繳 | ❌ | 終身不能縮短週期 |
| Professional | 月繳 | Professional | 年繳 | ✅ | 同階層延長 |
| Professional | 月繳 | Professional | 終身 | ✅ | 同階層延長 |
| Professional | 月繳 | Business | 月繳 | ✅ | 跨階層同週期 |
| Professional | 月繳 | Business | 年繳 | ✅ | 跨階層延長 |
| Professional | 月繳 | Business | 終身 | ✅ | 跨階層延長 |
| Professional | 月繳 | Agency | 月繳 | ✅ | 跨階層同週期 |
| Professional | 月繳 | Agency | 年繳 | ✅ | 跨階層延長 |
| Professional | 月繳 | Agency | 終身 | ✅ | 跨階層延長 |
| Professional | 月繳 | Starter | 任何 | ❌ | 降階 |
| Professional | 年繳 | Professional | 月繳 | ❌ | 同階層縮短 |
| Professional | 年繳 | Professional | 終身 | ✅ | 同階層延長 |
| Professional | 年繳 | Business | 月繳 | ❌ | 跨階層縮短 |
| Professional | 年繳 | Business | 年繳 | ✅ | 跨階層同週期 |
| Professional | 年繳 | Business | 終身 | ✅ | 跨階層延長 |
| Professional | 年繳 | Agency | 月繳 | ❌ | 跨階層縮短 |
| Professional | 年繳 | Agency | 年繳 | ✅ | 跨階層同週期 |
| Professional | 年繳 | Agency | 終身 | ✅ | 跨階層延長 |
| Professional | 終身 | Professional | 月繳 | ❌ | 終身不能縮短週期 |
| Professional | 終身 | Professional | 年繳 | ❌ | 終身不能縮短週期 |
| Professional | 終身 | Business | 終身 | ✅ | 跨階層升級 |
| Professional | 終身 | Agency | 終身 | ✅ | 跨階層升級 |
| Professional | 終身 | Business | 月繳 | ❌ | 終身不能縮短週期 |
| Professional | 終身 | Business | 年繳 | ❌ | 終身不能縮短週期 |
| Professional | 終身 | Starter | 任何 | ❌ | 降階 |
| Business | 月繳 | Business | 年繳 | ✅ | 同階層延長 |
| Business | 月繳 | Business | 終身 | ✅ | 同階層延長 |
| Business | 月繳 | Agency | 月繳 | ✅ | 跨階層同週期 |
| Business | 月繳 | Agency | 年繳 | ✅ | 跨階層延長 |
| Business | 月繳 | Agency | 終身 | ✅ | 跨階層延長 |
| Business | 月繳 | Starter | 任何 | ❌ | 降階 |
| Business | 月繳 | Professional | 任何 | ❌ | 降階 |
| Business | 年繳 | Business | 月繳 | ❌ | 同階層縮短 |
| Business | 年繳 | Business | 終身 | ✅ | 同階層延長 |
| Business | 年繳 | Agency | 月繳 | ❌ | 跨階層縮短 |
| Business | 年繳 | Agency | 年繳 | ✅ | 跨階層同週期 |
| Business | 年繳 | Agency | 終身 | ✅ | 跨階層延長 |
| Business | 終身 | Business | 月繳 | ❌ | 終身不能縮短週期 |
| Business | 終身 | Business | 年繳 | ❌ | 終身不能縮短週期 |
| Business | 終身 | Agency | 終身 | ✅ | 跨階層升級 |
| Business | 終身 | Agency | 月繳 | ❌ | 終身不能縮短週期 |
| Business | 終身 | Agency | 年繳 | ❌ | 終身不能縮短週期 |
| Business | 終身 | Starter | 任何 | ❌ | 降階 |
| Business | 終身 | Professional | 任何 | ❌ | 降階 |
| Agency | 月繳 | Agency | 年繳 | ✅ | 同階層延長 |
| Agency | 月繳 | Agency | 終身 | ✅ | 同階層延長 |
| Agency | 月繳 | 任何低階 | 任何 | ❌ | 降階 |
| Agency | 年繳 | Agency | 月繳 | ❌ | 同階層縮短 |
| Agency | 年繳 | Agency | 終身 | ✅ | 同階層延長 |
| Agency | 終身 | Agency | 月繳 | ❌ | 終身不能縮短週期 |
| Agency | 終身 | Agency | 年繳 | ❌ | 終身不能縮短週期 |
| Agency | 終身 | 任何低階 | 任何 | ❌ | 降階 |

## Impact Assessment

- **受影響模組**:
  - `src/lib/subscription/upgrade-rules.ts` - 核心升級規則邏輯
  - `src/app/pricing/page.tsx` - 前端定價頁面
  - `src/app/(dashboard)/dashboard/subscription/subscription-plans.tsx` - 訂閱管理頁面
  - `src/app/api/payment/recurring/create/route.ts` - 定期定額支付 API

- **破壞性變更**: 否（僅修正邏輯，不改變 API 接口）

- **資料庫變更**: 否

- **API 變更**: 否

## Success Criteria

- [ ] `TIER_HIERARCHY` 正確反映實際階層順序
- [ ] 所有升級規則測試通過
- [ ] 前端正確顯示可升級/不可升級的方案
- [ ] 後端 API 正確拒絕不符合規則的升級請求
- [ ] 用戶無法通過任何方式繞過升級規則限制

## Dependencies

- 依賴 `payment-processing` spec
- 依賴 `payment-callbacks` spec

## Timeline

預計 2-3 小時完成實作和測試

## Risks and Mitigation

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|---------|
| 影響現有用戶升級 | 中 | 中 | 仔細測試所有升級路徑 |
| 前後端邏輯不一致 | 低 | 高 | 共用相同的 upgrade-rules.ts |
| 階層順序理解錯誤 | 低 | 高 | 參考實際定價截圖驗證 |

## 關鍵變更總結

### 階層定義修正

| 方案 | 舊階層值 | 新階層值 | 月費 | 說明 |
|------|---------|---------|------|------|
| Starter | 1 | 1 | NT$599 | 保持不變 |
| Professional | 3 ❌ | 2 ✅ | NT$2,499 | 修正為正確順序 |
| Business | 2 ❌ | 3 ✅ | NT$5,999 | 修正為正確順序 |
| Agency | 4 | 4 | NT$11,999 | 保持不變 |

### 升級規則邏輯修正

**修正前**：
```typescript
// 升級到更高階層 → 允許（任何計費週期）
if (targetTierLevel > currentTierLevel) {
  return true  // ❌ 問題：允許「年繳 → 月繳」的跨階層升級
}

// 終身方案 → 不允許任何變更
if (currentBillingPeriod === 'lifetime') {
  return false  // ❌ 問題：連升級到更高階層終身都不行
}
```

**修正後**：
```typescript
// 終身方案 → 可以升級到更高階層終身
if (currentBillingPeriod === 'lifetime') {
  if (targetTierLevel > currentTierLevel && targetBillingPeriod === 'lifetime') {
    return true  // ✅ 允許：終身 Starter → 終身 Agency
  }
  return false  // ❌ 不允許：終身 → 月繳/年繳
}

// 升級到更高階層 → 檢查計費週期
if (targetTierLevel > currentTierLevel) {
  // 計費週期不能縮短
  if (isBillingPeriodShorter(currentBillingPeriod, targetBillingPeriod)) {
    return false  // ❌ 不允許：年繳 Starter → 月繳 Agency
  }
  return true  // ✅ 允許：月繳 Starter → 年繳 Agency
}
```

### 完整升級規則圖示

```
階層順序（由低到高）：
┌─────────┬──────────────┬──────────┬────────┐
│ Starter │ Professional │ Business │ Agency │
│  $599   │   $2,499     │  $5,999  │$11,999 │
└─────────┴──────────────┴──────────┴────────┘
    1            2             3         4

計費週期順序：
月繳 (M) ──> 年繳 (Y) ──> 終身 (L)

允許的升級路徑：
✅ 同階層：M→Y, M→L, Y→L
✅ 跨階層+延長：M Starter → Y Business
✅ 跨階層+相同：M Starter → M Agency
✅ 終身跨階層：L Starter → L Agency

禁止的升級路徑：
❌ 同階層縮短：Y→M, L→Y, L→M
❌ 跨階層縮短：Y Starter → M Agency
❌ 降階層：Business → Starter
❌ 終身降階：L Business → L Starter
```

## Open Questions

- [ ] 是否需要提供「降級」功能？（目前規則完全禁止）
- [ ] 是否需要處理「暫停訂閱」的情況？

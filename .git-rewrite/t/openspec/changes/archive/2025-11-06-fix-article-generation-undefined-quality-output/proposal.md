# 修正文章生成中未定義的 qualityOutput 錯誤

## Why

文章生成流程在執行時會發生錯誤或產生空值結果，原因是 `ParallelOrchestrator` 中引用了未定義的 `qualityOutput` 變數。

### 問題描述

在 orchestrator.ts 中的三個位置引用了未定義的 `qualityOutput` 變數：

1. **orchestrator.ts:278** - `result.success = qualityOutput.passed;`
2. **orchestrator.ts:285** - `const finalStatus = qualityOutput.passed ? 'completed' : 'quality_failed';`
3. **orchestrator.ts:289** - `if (qualityOutput.passed || result.wordpress) {`

根據程式碼註解（orchestrator.ts:176），QualityAgent 已被移除，品質檢查由其他 agents 負責。但相關的引用程式碼未被清理。

### 根本原因

在移除 QualityAgent 時，未正確清理相關的引用程式碼，導致：
- `qualityOutput` 變數未定義
- `phaseTimings.qualityCheck` 未賦值但仍被使用
- 文章生成流程無法正確判斷成功狀態
- 文章儲存條件依賴於不存在的品質檢查結果

### 影響範圍

- 文章生成會中斷並拋出錯誤
- 無法正確判斷文章生成是否成功
- 文章可能無法儲存到資料庫
- job 狀態無法正確更新

## What Changes

### 1. 移除 qualityOutput 引用

將所有引用 `qualityOutput` 的程式碼替換為基於實際生成結果的判斷：

```typescript
// 原本（錯誤）
result.success = qualityOutput.passed;
const finalStatus = qualityOutput.passed ? 'completed' : 'quality_failed';
if (qualityOutput.passed || result.wordpress) {

// 修正後
result.success = !!(result.writing && result.meta);
const finalStatus = result.success ? 'completed' : 'failed';
if (result.success || result.wordpress) {
```

### 2. 修正執行統計

移除未使用的 `qualityCheck` 計時：

```typescript
// 原本
const serialTime =
  phaseTimings.research +
  phaseTimings.strategy +
  phaseTimings.contentGeneration +
  phaseTimings.metaGeneration +
  phaseTimings.qualityCheck;  // ← 這個值永遠是 0

// 修正後
const serialTime =
  phaseTimings.research +
  phaseTimings.strategy +
  phaseTimings.contentGeneration +
  phaseTimings.metaGeneration;
```

### 3. 成功判斷邏輯

文章生成成功的條件：
- `result.writing` 存在（文章內容已生成）
- `result.meta` 存在（SEO 元資料已生成）
- 可選：`result.wordpress` 存在（表示已發布到 WordPress，即使其他步驟失敗也算部分成功）

## 相關規格

這個變更不需要建立新的規格檔案，因為只是修正程式碼中的錯誤引用。

## 風險評估

- **低風險** - 純粹移除錯誤的程式碼引用
- **向後相容** - 不影響現有 API 介面
- **測試需求** - 需要驗證文章生成流程完整性

## 驗收標準

1. 文章生成流程不會因 `qualityOutput` 未定義而中斷
2. 文章成功生成後能正確儲存到資料庫
3. job 狀態能正確反映文章生成結果（completed/failed）
4. 執行統計不包含無效的 qualityCheck 時間

## 參考資料

- orchestrator.ts:176 - 「QualityAgent 已移除」註解
- orchestrator.ts:278-289 - 錯誤發生位置

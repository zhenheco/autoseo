# 技術設計文件

## Context

### 問題背景
文章生成系統在生產環境中出現致命錯誤，導致核心功能完全無法使用。根據錯誤日誌分析和代碼審查，問題源於對第三方庫（linkedom）行為的不正確假設。

### 技術堆疊
- **HTML 解析**: linkedom v0.18.x（Server-side DOM 實現）
- **部署環境**: Vercel Edge Runtime
- **語言**: TypeScript 5.x + Next.js 15.x
- **AI Agents**: 自定義 Agent 架構（ResearchAgent, WritingAgent, HTMLAgent 等）

### 核心約束
1. **向後兼容**: 修復不能破壞現有文章
2. **性能要求**: HTMLAgent 處理時間 <500ms
3. **可靠性**: 錯誤不能中斷文章生成流程
4. **成本控制**: 避免使用昂貴的模型（如 GPT-3.5/4）

## Goals / Non-Goals

### Goals
1. **立即恢復功能**: 修復 HTMLAgent fatal error，使文章生成成功率達到 100%
2. **防禦性編程**: 確保任何單一組件失敗不會中斷整個流程
3. **可觀察性**: 提供足夠的診斷日誌以快速定位問題
4. **成本優化**: 確保所有 Agent 使用正確（經濟）的模型

### Non-Goals
1. **完全重寫 HTMLAgent**: 保留現有架構，僅修復關鍵問題
2. **實時預覽**: 不在此次變更範圍
3. **SEO 優化**: FAQ Schema 以外的 SEO 功能不在範圍
4. **R2 上傳完美解決**: 僅提供診斷工具，實際修復取決於環境配置

## Decisions

### Decision 1: 使用 linkedom 的正確模式

**問題**: linkedom 在處理 HTML 片段時不會自動創建 `<html>`, `<head>`, `<body>` 結構

**選項**:
1. **修改 WritingAgent 輸出完整 HTML** - 但這會改變 Agent 職責，且可能影響其他消費者
2. **在 HTMLAgent 中包裝片段** ✅ - 職責清晰，影響範圍最小
3. **切換到 jsdom** - 在 Vercel Edge Runtime 有 ESM 問題

**決定**: 選項 2 - 在 HTMLAgent 的 `process` 方法中自動檢測並包裝 HTML 片段

**理由**:
- HTMLAgent 的職責就是處理 HTML，這是最自然的位置
- 不影響 WritingAgent 的輸出格式
- 向後兼容（如果輸入已經是完整文檔，不會重複包裝）

**實現**:
```typescript
if (!fullHtml.includes('<html>') && !fullHtml.includes('<!DOCTYPE')) {
  fullHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${fullHtml}
</body>
</html>`;
}
```

### Decision 2: FAQ Schema 插入位置

**問題**: 原代碼嘗試將 FAQ Schema 插入 `<head>`，但最終只返回 `body.innerHTML`，導致 Schema 丟失

**選項**:
1. **修改返回值包含 head** - 需要改變 API 契約，影響下游
2. **將 Schema 插入 body 末尾** ✅ - 符合 Schema.org 規範，技術上可行
3. **完全移除 FAQ Schema** - 損失 SEO 價值

**決定**: 選項 2 - 將 `<script type="application/ld+json">` 插入 `<body>` 末尾

**理由**:
- Schema.org JSON-LD 可以放在 `<head>` 或 `<body>` 任何位置
- Google 和其他搜索引擎都能正確解析 body 中的 JSON-LD
- 不改變 HTMLAgent 的返回格式（仍然是 `body.innerHTML`）

**參考**: [Google Structured Data Guidelines](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data#structured-data-format)

### Decision 3: 錯誤處理策略

**問題**: 任何子功能（FAQ Schema, 內部連結等）失敗都會導致整個文章生成中斷

**選項**:
1. **繼續拋出錯誤，讓調用者處理** - 當前行為，但調用者未正確處理
2. **吞掉所有錯誤，靜默失敗** - 可能隱藏問題
3. **防禦性編程 + 詳細日誌** ✅ - 功能優先，但保留可觀察性

**決定**: 選項 3 - 每個子方法使用 try-catch，記錄警告但不拋出錯誤

**實現**:
```typescript
try {
  this.insertFAQSchema(document, body);
} catch (error) {
  this.logger.warn('⚠️ Failed to insert FAQ schema, continuing...', { error });
  // 不拋出錯誤，允許流程繼續
}
```

**理由**:
- **功能優先**: 80% 功能正常 > 100% 功能或 0% 功能
- **可追蹤性**: 日誌中保留完整錯誤信息
- **漸進式修復**: 可以逐步修復子功能，不影響主流程

### Decision 4: R2 上傳診斷方法

**問題**: "Invalid character in header content" 錯誤難以追蹤，可能原因多樣

**選項**:
1. **直接修復所有可能原因** - 但我們不確定根本原因
2. **先診斷再修復** ✅ - 提供足夠的日誌和驗證
3. **移除 R2 上傳，只用臨時 URL** - 功能降級

**決定**: 選項 2 - 增強診斷能力

**實現**:
- 在 ImageAgent 中記錄環境變數狀態（SET/MISSING）
- 在 R2Client 中檢查 credentials 格式：
  - 是否包含非 ASCII 字符
  - 是否正確 trim（無多餘空白）
- 詳細記錄錯誤堆疊

**理由**:
- 無法在本地重現問題（Vercel 環境變數）
- 診斷日誌幫助運維人員快速定位
- 不影響主功能（有 fallback 機制）

### Decision 5: 模型配置驗證

**問題**: MetaAgent 使用了未預期的 `gpt-3.5-turbo`，成本高昂

**選項**:
1. **硬編碼所有模型名稱** - 失去靈活性
2. **添加驗證日誌** ✅ - 可觀察性優先
3. **在代碼中強制覆蓋** - 可能與資料庫配置衝突

**決定**: 選項 2 - 在 Orchestrator 中記錄所有 Agent 的模型配置

**實現**:
```typescript
this.logger.info('📋 Agent Models Configuration', {
  research_model: researchModel,
  strategy_model: strategyModel,
  writing_model: writingModel,
  meta_model: agentConfig.meta_model || agentConfig.simple_processing_model || 'deepseek-chat',
  image_model: 'gpt-image-1-mini',
});
```

**理由**:
- 配置可能來自多個來源（資料庫、環境變數、代碼預設）
- 日誌記錄幫助確認實際使用的模型
- 不改變配置邏輯，僅增加可見性

## Risks / Trade-offs

### Risk 1: linkedom 與瀏覽器行為差異
**風險**: linkedom 的其他行為可能與瀏覽器不同，導致未來問題

**緩解**:
- 增加測試覆蓋，特別是 DOM 操作相關
- 在文檔中明確記錄 linkedom 的限制
- 考慮添加 E2E 測試驗證最終 HTML 輸出

**接受度**: 低風險 - linkedom 是成熟的專案，廣泛用於 SSR

### Risk 2: FAQ Schema 位置影響 SEO
**風險**: 搜索引擎是否正確解析 body 中的 JSON-LD

**緩解**:
- 已驗證 Google Structured Data Testing Tool 支援
- Schema.org 官方文檔確認可行
- 如有問題，可以快速回滾到不插入 Schema（僅損失 SEO 增強）

**接受度**: 極低風險 - 業界標準做法

### Risk 3: 防禦性編程隱藏 Bug
**風險**: try-catch 可能掩蓋真正需要修復的問題

**緩解**:
- 所有錯誤都記錄 WARN 級別日誌
- 定期審查警告日誌
- 在測試環境中設定更嚴格的錯誤處理（可選）

**接受度**: 中風險 - 但優先保證用戶體驗

### Trade-off: 功能優先 vs 完美主義
**選擇**: 優先恢復功能，而非追求完美的錯誤處理

**理由**:
- 用戶當前完全無法使用系統
- 可以在後續迭代中改進錯誤處理
- 日誌提供足夠的可觀察性

## Migration Plan

### 部署步驟
1. **本地驗證**: 執行 `npm run build` 和 `npm run typecheck`
2. **提交代碼**: Git commit + push
3. **Vercel 自動部署**: 約 2-3 分鐘
4. **冒煙測試**: 生成 1 篇測試文章，驗證流程正常
5. **監控日誌**: 觀察 30 分鐘，確認無新錯誤

### 回滾計劃
**觸發條件**:
- 文章生成成功率 <50%
- 出現新的致命錯誤
- 性能顯著下降（>2x 處理時間）

**回滾步驟**:
1. 在 Vercel Dashboard 回滾到上一個部署
2. 或使用 Git revert 提交回滾 commit
3. 重新分析問題，準備新的修復方案

**預估回滾時間**: <5 分鐘

### 資料兼容性
無資料遷移需求 - 所有修改都是代碼級別

### 向後兼容性
完全向後兼容：
- HTMLAgent 仍接受相同的輸入格式
- 返回值格式不變（`body.innerHTML`）
- 現有文章不受影響

## Open Questions

### Q1: R2 上傳失敗的根本原因
**狀態**: 待診斷

**行動**: 部署診斷代碼後，根據日誌確定根因

**可能原因**:
1. 環境變數缺失或格式錯誤
2. Cloudflare R2 API 變更
3. AWS SDK 版本兼容性問題

### Q2: MetaAgent 模型配置來源
**狀態**: 待查詢資料庫

**行動**: 執行 SQL 查詢檢查 `agent_configs` 表

**假設**: 可能是資料庫配置錯誤，而非代碼硬編碼

### Q3: 是否需要更多的 HTML 驗證
**狀態**: 觀察

**行動**: 部署後監控，如果出現 HTML 格式問題，考慮添加驗證

**選項**:
- 添加 HTML 格式驗證（如檢查未閉合標籤）
- 使用 HTML sanitizer
- 保持當前簡單邏輯

## Performance Considerations

### HTMLAgent 性能分析

**當前處理時間**: 約 200-300ms

**新增開銷**:
- HTML 包裝邏輯: <1ms（字串操作）
- FAQ Schema 生成: ~10-20ms（DOM 遍歷 + JSON 序列化）
- Try-catch 開銷: 可忽略（無異常時）

**預期總處理時間**: <350ms（仍遠低於 500ms 目標）

### 內存使用
- linkedom 解析: ~2-5MB（取決於 HTML 大小）
- 峰值增加: <1MB（包裝和 Schema 生成）

**評估**: 在 Vercel Edge Runtime 限制內（128MB）

## Security Considerations

### XSS 防護
HTMLAgent 處理的是 AI 生成的內容，已通過 WritingAgent 的輸出過濾

**現狀**: 依賴 WritingAgent 的安全性

**改進建議**（超出範圍）:
- 在 HTMLAgent 中添加 HTML sanitization
- 使用 DOMPurify 或類似庫

### 敏感資訊洩漏
診斷日誌會記錄環境變數「狀態」（SET/MISSING），但不記錄實際值

**安全性**: ✅ 符合最佳實踐

## Testing Strategy

### 單元測試（超出範圍，未來改進）
- `HTMLAgent.process` 方法：
  - 輸入片段 → 輸出完整 HTML
  - 輸入完整文檔 → 不重複包裝
- `insertFAQSchema` 方法：
  - 有效 FAQ 區域 → 正確生成 Schema
  - 無 FAQ → 無 Schema，無錯誤

### 整合測試（手動執行）
1. 生成包含 FAQ 的文章 → 驗證 Schema 存在
2. 生成不含 FAQ 的文章 → 驗證無錯誤
3. 生成長文章（>5000 字）→ 驗證性能

### 生產驗證
- 前 10 篇文章手動檢查
- 監控錯誤率（目標: <1%）
- 監控處理時間（目標: p95 <500ms）

## Monitoring

### 關鍵指標

1. **文章生成成功率**
   - 來源: `ArticleStorageService` 日誌
   - 目標: 100%
   - 告警: <95%

2. **HTMLAgent 錯誤率**
   - 來源: HTMLAgent 錯誤日誌
   - 目標: 0%
   - 告警: >0.1%

3. **FAQ Schema 插入成功率**
   - 來源: "FAQ Schema inserted" 日誌
   - 目標: >90%（取決於文章是否有 FAQ）
   - 監控: 每日統計

4. **R2 上傳成功率**
   - 來源: ImageAgent 日誌
   - 目標: >90%
   - 告警: <50%

5. **模型成本**
   - 來源: AI provider API logs
   - 目標: DeepSeek 使用率 100%
   - 告警: 檢測到 GPT-3.5/4 調用

### 日誌查詢範例

```bash
# 檢查 HTMLAgent 錯誤
vercel logs | grep "\[HTMLAgent\].*error"

# 檢查模型配置
vercel logs | grep "Agent Models Configuration"

# 檢查 R2 上傳
vercel logs | grep "R2 upload"

# 統計成功率
vercel logs | grep "Article generation" | grep -c "completed"
```

## Future Improvements

### 優先級 P1（下一次迭代）
1. **R2 上傳完全修復**: 根據診斷結果實施修復
2. **添加單元測試**: HTMLAgent 核心方法
3. **HTML 驗證**: 檢查未閉合標籤、無效結構

### 優先級 P2（後續規劃）
1. **Schema.org 擴展**: 支援 Article, BreadcrumbList 等
2. **HTML 優化**: 壓縮、minify
3. **A/B 測試**: 不同 FAQ 格式的 SEO 效果
4. **性能監控**: 添加 OpenTelemetry tracing

### 優先級 P3（可選）
1. **切換到更強大的 HTML 處理器**: 如 happy-dom
2. **視覺化 HTML 預覽**: 在 Dashboard 中
3. **批量文章生成**: 並行處理多篇文章

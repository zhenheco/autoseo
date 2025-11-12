# 重構為多 Agent 文章生成架構

## Why

當前的單一 WritingAgent 文章生成系統存在以下問題：

1. **"No main sections parsed" 頻繁發生**
   - StrategyAgent 的 `parseOutlineText()` 依賴模糊的 Markdown 解析
   - 當 AI 輸出格式不符預期時，`mainSections` 為空陣列
   - 觸發 fallback 導致文章品質下降或生成失敗

2. **單一 prompt 負擔過重**
   - WritingAgent 的 prompt 超過 124 行，包含所有指示
   - 難以針對特定部分（標題、內容、FAQ）進行調整和優化
   - AI 容易遺漏某些要求或產生不一致的內容

3. **缺乏容錯機制**
   - 任一部分生成失敗導致整篇文章失敗
   - 無法針對失敗的部分單獨重試
   - 錯誤追蹤困難，難以定位問題

4. **無法獨立優化**
   - 前言、段落、FAQ 的品質無法單獨調整
   - 無法為不同部分使用不同的 AI 模型或參數
   - 難以進行 A/B 測試比較不同策略

## What Changes

### 架構變更

- **去除 TitleAgent**：StrategyAgent 已完成標題生成和選擇，避免重複
- **新增 4 個專門 agent**：
  - `IntroductionAgent` - 生成前言並插入主圖
  - `SectionAgent` - 逐段生成主要內容（可重複使用）
  - `ConclusionAgent` - 生成結論
  - `QAAgent` - 生成常見問題和答案
- **新增 ContentAssemblerAgent** - 組合所有部分成完整 Markdown
- **強化 StrategyAgent** - 改善 JSON 解析，增加多個 fallback 解析器
- **重構 Orchestrator** - 實作新的協調流程，支援分批並行執行

### 執行流程變更

```
舊流程：
Research → Strategy → Writing (單一 agent) → HTML/Meta/Image (並行)

新流程：
Research → Strategy → Image → Content Generation (分批) → Assembly → HTML → Meta
```

### 重試機制（新增）

- 每個 agent 獨立重試配置（次數、間隔、策略）
- Exponential backoff 重試間隔
- 智能參數調整（如增加 temperature）
- 最終 fallback 到舊 WritingAgent

### 錯誤追蹤（新增）

- 結構化日誌格式（JSON）
- 錯誤分類和聚合統計
- 詳細的上下文資訊（agent、輸入、執行時間）
- 與監控系統整合

### Feature Flag（新增）

- `USE_MULTI_AGENT_ARCHITECTURE` 環境變數控制
- 基於 article ID hash 的 A/B 測試分流
- 漸進式切換（10% → 50% → 100%）
- 失敗自動 fallback

## Impact

### Affected Specs

- `article-generation` (新建) - 多 agent 文章生成流程
- `agent-orchestration` (修改) - Orchestrator 協調邏輯
- `content-assembly` (新建) - 內容組合流程
- `error-handling` (新建) - 重試機制和錯誤追蹤

### Affected Code

#### 新建檔案
- `src/lib/agents/introduction-agent.ts` - 前言生成
- `src/lib/agents/section-agent.ts` - 段落生成
- `src/lib/agents/conclusion-agent.ts` - 結論生成
- `src/lib/agents/qa-agent.ts` - FAQ 生成
- `src/lib/agents/content-assembler-agent.ts` - 內容組合
- `src/lib/agents/retry-config.ts` - 重試配置
- `src/lib/agents/error-tracker.ts` - 錯誤追蹤

#### 修改檔案
- `src/lib/agents/strategy-agent.ts` - 強化 JSON 解析
- `src/lib/agents/orchestrator.ts` - 重大修改（新執行流程）
- `src/lib/agents/html-agent.ts` - 調整為只處理連結插入和格式化
- `src/lib/agents/base-agent.ts` - 新增重試和錯誤追蹤支援

#### 保留但棄用
- `src/lib/agents/writing-agent.ts` - 保留作為 fallback

### Breaking Changes

**無** - 透過 Feature Flag 控制，舊系統保留作為 fallback

### Migration Plan

1. **Phase 1 (Week 1-2)**: 實作新 agent 和基礎設施
2. **Phase 2 (Week 2-3)**: 整合測試和 bug 修復
3. **Phase 3 (Week 3-4)**: 漸進式部署（10% → 50% → 100%）
4. **Phase 4 (Week 4+)**: 監控、優化、移除舊系統

### Rollback Strategy

- Feature Flag 立即切回舊系統（設定 `USE_MULTI_AGENT_ARCHITECTURE=false`）
- 每個 agent 失敗時自動 fallback 到舊 WritingAgent
- 保留舊系統至少 30 天確保穩定性

## Success Metrics

### 品質指標
- "No main sections parsed" 錯誤率 < 1%（當前 ~10-15%）
- 文章生成成功率 > 95%（當前 ~85%）
- 文章可讀性分數 > 70（Flesch Reading Ease）
- SEO 分數 > 80

### 效能指標
- 平均生成時間 < 3 分鐘（當前 ~2-4 分鐘）
- Token 使用成本 < $0.50/篇
- 各 agent 執行成功率 > 95%
- 重試次數平均 < 0.5 次/agent

### 可靠性指標
- 系統可用性 > 99.5%
- 錯誤恢復時間 < 5 秒
- Fallback 使用率 < 5%

## Dependencies

### 技術依賴
- TypeScript 5.x
- 現有的 AI client 架構
- linkedom（HTML 處理）
- 現有的 Supabase/R2 儲存

### 環境變數（新增）
```bash
# Feature Flag
USE_MULTI_AGENT_ARCHITECTURE=true

# A/B 測試
MULTI_AGENT_ROLLOUT_PERCENTAGE=10  # 10%, 50%, 100%

# 重試配置（可選，有預設值）
AGENT_RETRY_MAX_ATTEMPTS=3
AGENT_RETRY_INITIAL_DELAY_MS=1000
AGENT_RETRY_MAX_DELAY_MS=30000

# 錯誤追蹤（可選）
ERROR_TRACKING_ENABLED=true
SENTRY_DSN=https://...  # 如果使用 Sentry
```

### 外部服務
- 無新增外部服務依賴
- 使用現有的 AI API（OpenAI, DeepSeek, OpenRouter）
- 使用現有的儲存服務（R2, Supabase Storage）

## Risks and Mitigations

| 風險 | 影響 | 機率 | 緩解策略 |
|------|------|------|----------|
| **內容重複或矛盾** | 高 | 中 | ContentAssembler 檢查重複；各 agent 共享 BrandVoice |
| **風格不一致** | 高 | 中 | 所有 agent 使用相同 brandVoice 參數和 temperature |
| **Token 成本增加** | 中 | 高 | 使用較小模型（deepseek-chat）；設定 maxTokens 限制 |
| **執行時間增加** | 低 | 中 | 分批並行執行；優化 prompt 長度 |
| **複雜度增加** | 高 | 確定 | 詳細日誌；完善的錯誤追蹤；充分的測試 |
| **過渡段落不自然** | 中 | 中 | SectionAgent 接收前一段落摘要保持連貫性 |
| **重試風暴** | 中 | 低 | Exponential backoff；最大重試次數限制 |
| **Cascading failures** | 高 | 低 | 獨立重試；critical agent（Strategy）有更多重試次數 |

## Open Questions

- [ ] 是否需要 CoordinatorAgent 來管理 agent 間的依賴關係？（目前由 Orchestrator 直接管理）
- [ ] SectionAgent 是否需要支援完全並行執行模式？（目前是順序執行）
- [ ] 錯誤追蹤是否需要整合第三方服務（Sentry, Datadog）？（目前使用內建日誌）
- [ ] 是否需要為每個 agent 設定不同的 timeout？（目前統一 2 分鐘）

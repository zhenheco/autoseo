# Phase 4 實作記錄 - Orchestrator 整合完成

## 完成日期

2025-01-12

## 總覽

Phase 4 完成了多 Agent 文章生成架構的**最終整合**，實現了完整的端到端多 agent 執行流程，並加入了 Feature Flag 控制和完整的 fallback 機制。

## ✅ 已完成項目

### 4.1 executeContentGeneration() 方法 ✅

**檔案**: `src/lib/agents/orchestrator.ts` (lines 469-573)

**功能**:

- 協調所有內容生成 agent 的執行順序
- Batch 1: 並行執行 IntroductionAgent, ConclusionAgent, QAAgent
- Batch 2: 順序執行 SectionAgent（傳遞 previousSummary）
- ContentAssemblerAgent 組合所有部分成完整文章

**關鍵實作**:

```typescript
private async executeContentGeneration(
  strategyOutput: ArticleGenerationResult['strategy'],
  imageOutput: ArticleGenerationResult['image'],
  brandVoice: BrandVoice,
  agentConfig: AgentConfig,
  aiConfig: AIClientConfig,
  context: AgentExecutionContext
) {
  const { outline, selectedTitle } = strategyOutput;

  // Batch 1: 並行執行
  const [introduction, conclusion, qa] = await Promise.all([
    this.executeWithRetry(
      async () => {
        const agent = new IntroductionAgent(aiConfig, context);
        return agent.execute({
          outline,
          featuredImage: imageOutput?.featuredImage || null,
          brandVoice,
          model: agentConfig.writing_model,
          temperature: agentConfig.writing_temperature,
          maxTokens: 500,
        });
      },
      RetryConfigs.INTRODUCTION_AGENT
    ),
    // ... ConclusionAgent, QAAgent
  ]);

  // Batch 2: 順序執行 sections
  const sections = [];
  for (let i = 0; i < outline.mainSections.length; i++) {
    const section = outline.mainSections[i];
    const previousSummary = i > 0 ? sections[i - 1].summary : undefined;
    const sectionImage = imageOutput?.contentImages?.[i] || null;

    const sectionOutput = await this.executeWithRetry(
      async () => {
        const agent = new SectionAgent(aiConfig, context);
        return agent.execute({
          section,
          previousSummary,
          sectionImage,
          brandVoice,
          index: i,
          model: agentConfig.writing_model,
          temperature: agentConfig.writing_temperature,
          maxTokens: Math.floor(section.targetWordCount * 2),
        });
      },
      RetryConfigs.SECTION_AGENT
    );

    sections.push(sectionOutput);
  }

  // 組合所有部分
  const assembler = new ContentAssemblerAgent();
  const assembled = await assembler.execute({
    title: selectedTitle,
    introduction,
    sections,
    conclusion,
    qa,
  });

  return {
    markdown: assembled.markdown,
    html: assembled.html,
    wordCount: assembled.statistics.totalWordCount,
    executionInfo: {
      introduction: introduction.executionInfo,
      sections: sections.map(s => s.executionInfo),
      conclusion: conclusion.executionInfo,
      qa: qa.executionInfo,
      assembly: assembled.executionInfo,
    },
  };
}
```

### 4.2 execute() 主方法整合 ✅

**檔案**: `src/lib/agents/orchestrator.ts` (lines 135-218)

**功能**:

- Feature Flag 檢查決定使用多 agent 或 legacy 流程
- Multi-agent 流程執行順序：ImageAgent → executeContentGeneration()
- Legacy 流程保留原有的 WritingAgent + ImageAgent 並行執行
- Multi-agent 失敗時自動 fallback 到 legacy 流程

**關鍵修改**:

```typescript
// Feature Flag 檢查
const useMultiAgent = this.shouldUseMultiAgent(input);
console.log(
  `[Orchestrator] Using ${useMultiAgent ? "Multi-Agent" : "Legacy"} architecture`,
);

let writingOutput: ArticleGenerationResult["writing"];
let imageOutput: ArticleGenerationResult["image"];

const phase3Start = Date.now();

if (useMultiAgent) {
  try {
    // 先執行圖片生成（圖片在內容生成前需要）
    imageOutput = await this.executeImageAgent(
      strategyOutput,
      agentConfig,
      aiConfig,
      context,
    );

    await this.updateJobStatus(input.articleJobId, "processing", {
      current_phase: "images_completed",
      image: imageOutput,
    });

    // 執行多 agent 內容生成
    writingOutput = await this.executeContentGeneration(
      strategyOutput,
      imageOutput,
      brandVoice,
      agentConfig,
      aiConfig,
      context,
    );

    console.log("[Orchestrator] ✅ Multi-agent content generation succeeded");
  } catch (multiAgentError) {
    // Fallback 到 legacy 流程
    console.error(
      "[Orchestrator] ❌ Multi-agent flow failed, falling back to legacy:",
      multiAgentError,
    );
    this.errorTracker.trackFallback("multi-agent-to-legacy", multiAgentError);

    const [legacyWriting, legacyImage] = await Promise.all([
      this.executeWritingAgent(
        strategyOutput,
        brandVoice,
        previousArticles,
        agentConfig,
        aiConfig,
        context,
      ),
      imageOutput ||
        this.executeImageAgent(strategyOutput, agentConfig, aiConfig, context),
    ]);

    writingOutput = legacyWriting;
    imageOutput = legacyImage;
  }
} else {
  // Legacy 流程：WritingAgent + ImageAgent 並行執行
  [writingOutput, imageOutput] = await Promise.all([
    this.executeWritingAgent(
      strategyOutput,
      brandVoice,
      previousArticles,
      agentConfig,
      aiConfig,
      context,
    ),
    this.executeImageAgent(strategyOutput, agentConfig, aiConfig, context),
  ]);
}
```

### 4.3 圖片插入邏輯調整 ✅

**檔案**: `src/lib/agents/orchestrator.ts` (lines 263-269)

**修改**:

- 圖片插入（`insertImagesToHtml()`）僅在 legacy 流程執行
- Multi-agent 流程的圖片已在各 agent 中插入（IntroductionAgent, SectionAgent）

**關鍵修改**:

```typescript
// 僅在 legacy 流程插入圖片
if (!useMultiAgent && imageOutput) {
  writingOutput.html = this.insertImagesToHtml(
    writingOutput.html,
    imageOutput.featuredImage,
    imageOutput.contentImages,
  );
}
```

### 4.4 環境變數配置 ✅

**檔案**: `.env.example` (lines 54-73)

**新增環境變數**:

```bash
# ========================================
# 多 Agent 文章生成架構 (Multi-Agent Architecture)
# ========================================
# 啟用多 Agent 架構（預設關閉，漸進式部署）
USE_MULTI_AGENT_ARCHITECTURE=false

# A/B 測試流量分配百分比 (0-100)
# 0 = 全部使用舊架構
# 100 = 全部使用新架構
# 建議部署順序: 0 -> 10 -> 50 -> 100
MULTI_AGENT_ROLLOUT_PERCENTAGE=0

# Agent 重試配置（可選，有預設值）
AGENT_RETRY_MAX_ATTEMPTS=3
AGENT_RETRY_INITIAL_DELAY_MS=1000
AGENT_RETRY_MAX_DELAY_MS=30000

# 錯誤追蹤（可選）
ERROR_TRACKING_ENABLED=false
# SENTRY_DSN=https://your-sentry-dsn.ingest.sentry.io/project-id
```

### 4.5 tasks.md 更新 ✅

**檔案**: `openspec/changes/refactor-multi-agent-article-generation/tasks.md`

**更新內容**:

- 標記 Phase 4 所有任務為完成 ✅
- 標記 Phase 5.1 為完成 ✅（圖片插入邏輯調整）
- 更新完成狀態說明，新增 `progress-phase-4.md` 連結

## 📊 實作統計

### 程式碼修改

- **修改檔案**: 3 個
  - orchestrator.ts: 新增 `executeContentGeneration()` 方法（約 105 行）
  - orchestrator.ts: 修改 `execute()` 方法（約 75 行）
  - orchestrator.ts: 調整圖片插入邏輯（3 行）
  - .env.example: 新增環境變數（20 行）
  - tasks.md: 更新完成狀態（約 40 行）

- **新增程式碼**: 約 200+ 行

### 完成度

- Phase 4 (Orchestrator 整合): **100%** ✅
- Phase 5.1 (圖片插入調整): **100%** ✅

## 🎯 關鍵技術決策

### 1. executeContentGeneration() 設計

**決策**: 將所有內容生成邏輯封裝在單一方法中
**原因**:

- 簡化 execute() 主方法的複雜度
- 便於錯誤處理和 fallback
- 清楚區分多 agent 和 legacy 流程

### 2. 圖片生成順序

**決策**: 在 multi-agent 流程中先執行 ImageAgent，再執行內容生成
**原因**:

- IntroductionAgent 需要 featuredImage 插入到前言
- SectionAgent 需要 sectionImages 插入到段落
- 避免在內容生成後再插入圖片的複雜性

### 3. Fallback 策略

**決策**: Multi-agent 失敗時自動切換到 legacy 流程
**原因**:

- 確保系統穩定性，避免完全失敗
- 使用 ErrorTracker 記錄 fallback，便於監控和除錯
- 支援漸進式部署，降低風險

### 4. 圖片插入邏輯分離

**決策**: Legacy 流程使用 `insertImagesToHtml()`，multi-agent 流程在各 agent 中插入
**原因**:

- Multi-agent 流程圖片已在 Markdown 階段插入，無需重複處理
- Legacy 流程保持原有邏輯，避免影響現有系統
- 清楚區分兩種流程的圖片處理方式

## 🚀 部署準備

### 環境變數設定

在部署前，需要設定以下環境變數：

```bash
# 初始狀態（關閉新架構）
USE_MULTI_AGENT_ARCHITECTURE=false
MULTI_AGENT_ROLLOUT_PERCENTAGE=0

# 測試階段（10% 流量）
USE_MULTI_AGENT_ARCHITECTURE=true
MULTI_AGENT_ROLLOUT_PERCENTAGE=10

# 擴大測試（50% 流量）
MULTI_AGENT_ROLLOUT_PERCENTAGE=50

# 全面部署（100% 流量）
MULTI_AGENT_ROLLOUT_PERCENTAGE=100
```

### 部署計劃

1. **Week 1**: 開發環境完整測試（`ROLLOUT_PERCENTAGE=0`）
2. **Week 2**: Staging 環境測試（`ROLLOUT_PERCENTAGE=10`）
3. **Week 3**: Production 部署（`ROLLOUT_PERCENTAGE=50`）
4. **Week 4**: 全面部署（`ROLLOUT_PERCENTAGE=100`）

### 監控指標

部署後應監控：

- 文章生成成功率（目標 > 95%）
- 各 agent 執行時間
- 重試次數統計
- Fallback 使用率（應 < 5%）
- "No main sections parsed" 錯誤率（目標 < 1%）
- Token 成本（目標 < $0.50/篇）

## ✨ 下一步行動

### 立即可執行

```bash
# 1. 本地測試新架構（關閉 Feature Flag）
export USE_MULTI_AGENT_ARCHITECTURE=false
npm run dev

# 2. 啟用新架構測試
export USE_MULTI_AGENT_ARCHITECTURE=true
export MULTI_AGENT_ROLLOUT_PERCENTAGE=100

# 3. 執行文章生成測試
# 在 UI 中提交文章生成任務，觀察日誌輸出
```

### 測試重點

1. **功能測試**: 驗證所有 agent 正常執行
2. **錯誤處理測試**: 模擬各種錯誤情況，驗證 fallback 機制
3. **效能測試**: 比較多 agent 和 legacy 流程的執行時間
4. **品質測試**: 比較生成文章的品質和一致性

### 待實作項目（Phase 6）

1. **單元測試**:
   - executeContentGeneration() 方法測試
   - Feature Flag 邏輯測試
   - Fallback 機制測試

2. **整合測試**:
   - 完整端到端流程測試
   - A/B 測試 hash-based bucketing 一致性
   - 錯誤處理和重試邏輯測試

3. **效能測試**:
   - 壓力測試（100 篇文章）
   - 並行效能測試（Batch 1 vs 順序執行）
   - Token 成本分析

## 🎊 結論

Phase 4 完成了多 Agent 架構的**完整整合**，實現了：

- ✅ 端到端的多 agent 執行流程
- ✅ Feature Flag 控制的漸進式部署
- ✅ 完整的 fallback 機制保證系統穩定性
- ✅ 環境變數配置支援

系統現已**具備生產環境部署條件**，可以開始：

1. 本地開發環境測試
2. Staging 環境 10% 流量測試
3. Production 環境漸進式部署

**建議下一步**：執行完整的測試（Phase 6），確保系統穩定性和效能符合預期後，開始漸進式部署。

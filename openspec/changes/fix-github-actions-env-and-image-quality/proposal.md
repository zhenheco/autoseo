# 修復 GitHub Actions 環境變數換行符和圖片生成 API 參數錯誤

## 問題描述

發現三個影響系統運作的關鍵問題：

### 1. GitHub Secrets 環境變數包含換行符

從 GitHub Actions 日誌中發現所有環境變數都包含換行符，導致驗證步驟失敗：

```
❌ 錯誤: NEXT_PUBLIC_SUPABASE_URL 包含換行符
❌ 錯誤: NEXT_PUBLIC_SUPABASE_ANON_KEY 包含換行符
❌ 錯誤: SUPABASE_SERVICE_ROLE_KEY 包含換行符
❌ 錯誤: R2_ACCESS_KEY_ID 包含換行符
...（所有環境變數都有此問題）
```

**影響**：

- Workflow 在驗證環境變數步驟失敗
- R2 和 Multi-Agent 系統無法正常運作
- 文章生成任務無法執行

**根本原因**：
GitHub Secrets 在儲存時可能被加上了額外的換行符。這是 [已知問題](https://github.com/tuist/tuist/issues/4781)，GitHub Actions 可能在 secrets 值的末尾添加換行符。

### 2. StrategyAgent JSON Parser 返回空結果

```
[StrategyAgent] ⚠️ DirectJSONParser returned empty or invalid result
[StrategyAgent] ⚠️ DirectJSONParser returned empty or invalid result
[StrategyAgent] ⚠️ NestedJSONParser returned empty or invalid result
```

**影響**：

- 文章大綱生成失敗或品質下降
- 回退到 fallback outline，降低內容品質

**可能原因**：

- AI 回應使用 Markdown 代碼塊包裹 JSON（如 ` ```json...``` `）
- JSON 前後有額外說明文字
- 缺少專門處理這些格式的 Parser

### 3. 圖片生成 API quality 參數錯誤

```
Error: Image generation failed: OpenAI API error: {
  "error": {
    "message": "Invalid value: 'standard'. Supported values are: 'low', 'medium', 'high', and 'auto'.",
    "type": "invalid_request_error",
    "param": "quality",
    "code": "invalid_value"
  }
}
```

**影響**：

- 圖片生成完全失敗
- 文章無法獲得配圖
- 無法使用 gpt-image-1-mini 模型

**根本原因**：
系統預設使用 **gpt-image-1-mini** 模型，其支援的 quality 參數值為：

| 參數值     | 說明                 | 成本       | 品質       |
| ---------- | -------------------- | ---------- | ---------- |
| `'low'`    | 低品質，快速生成     | ~$0.02/張  | ⭐         |
| `'medium'` | 中等品質（**預設**） | ~$0.07/張  | ⭐⭐⭐     |
| `'high'`   | 高品質，慢速生成     | ~$0.19/張  | ⭐⭐⭐⭐⭐ |
| `'auto'`   | 自動選擇             | 視情況而定 | 自動       |

程式碼目前在以下位置使用了**不支援的值** `'standard'` 和 `'hd'`：

- `src/lib/agents/orchestrator.ts:610` - `quality: 'standard' as const` ❌
- `src/lib/agents/retry-config.ts:84` - `quality: attempt > 1 ? 'standard' : 'hd'` ❌

導致 gpt-image-1-mini API 拒絕請求。

## 解決方案

### 1. 修復 GitHub Actions 環境變數換行符問題

**推薦方案：在 workflow 中自動清理換行符**

基於 [GitHub Actions 最佳實踐](https://github.com/orgs/community/discussions/142004)：

```yaml
- name: Clean environment variables
  run: |
    # 清理所有環境變數的換行符和回車符
    echo "NEXT_PUBLIC_SUPABASE_URL=$(echo -n '${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo -n '${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "SUPABASE_SERVICE_ROLE_KEY=$(echo -n '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "OPENAI_API_KEY=$(echo -n '${{ secrets.OPENAI_API_KEY }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "DEEPSEEK_API_KEY=$(echo -n '${{ secrets.DEEPSEEK_API_KEY }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "R2_ACCESS_KEY_ID=$(echo -n '${{ secrets.R2_ACCESS_KEY_ID }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "R2_SECRET_ACCESS_KEY=$(echo -n '${{ secrets.R2_SECRET_ACCESS_KEY }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "R2_ACCOUNT_ID=$(echo -n '${{ secrets.R2_ACCOUNT_ID }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "R2_BUCKET_NAME=$(echo -n '${{ secrets.R2_BUCKET_NAME }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "USE_MULTI_AGENT_ARCHITECTURE=$(echo -n '${{ secrets.USE_MULTI_AGENT_ARCHITECTURE }}' | tr -d '\n\r')" >> $GITHUB_ENV
```

**優點**：

- 不需要手動重新設定所有 Secrets
- 自動化處理，避免人為錯誤
- 適用於所有現有和未來的 Secrets
- 使用 `echo -n` 確保不添加換行符
- 使用 `tr -d '\n\r'` 移除所有換行符和回車符

### 2. 增強 StrategyAgent Parser 錯誤處理

**基於 2025 年 LLM Output Parsing 最佳實踐**：

1. **新增 Markdown 代碼塊 Parser**

   ````typescript
   private tryMarkdownCodeBlockParse(content: string): StrategyOutput['outline'] | null {
     // 提取 ```json...``` 或 ``` {...} ``` 格式
     const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
     if (codeBlockMatch && codeBlockMatch[1]) {
       try {
         return JSON.parse(codeBlockMatch[1]);
       } catch {
         return null;
       }
     }
     return null;
   }
   ````

2. **改進 AI Prompt（使用 Assistant Prefills 技巧）**

   ```typescript
   const prompt = `...
   
   CRITICAL: Output ONLY raw JSON. No explanations, no markdown, no code blocks.
   Start your response with { and end with }
   
   Example CORRECT output:
   {"introduction": {...}, "mainSections": [...]}
   
   Example WRONG output (DO NOT DO THIS):
   Here is the outline in JSON format:
   \`\`\`json
   {...}
   \`\`\`
   `;
   ```

3. **使用 OpenAI Structured Outputs**（如果可用）
   ```typescript
   const response = await this.complete(prompt, {
     model: input.model,
     format: "json",
     response_format: {
       type: "json_schema",
       json_schema: outlineSchema,
     },
   });
   ```

### 3. 修正 gpt-image-1-mini quality 參數

**直接修改為正確的值**：

**修改位置 1**: `src/lib/agents/orchestrator.ts:610`

```typescript
// ❌ 錯誤
quality: 'standard' as const,

// ✅ 正確
quality: 'medium' as const,
```

**修改位置 2**: `src/lib/agents/retry-config.ts:84`

```typescript
// ❌ 錯誤
paramAdjustment: (attempt: number) => ({
  quality: attempt > 1 ? 'standard' : 'hd'
}),

// ✅ 正確（第一次嘗試用 high，重試時降級為 medium）
paramAdjustment: (attempt: number) => ({
  quality: attempt > 1 ? 'medium' : 'high'
}),
```

**修改位置 3**: `src/types/agents.ts` 和 `src/lib/agents/base-agent.ts`（如果有定義）

```typescript
// ❌ 錯誤
quality?: 'standard' | 'hd';

// ✅ 正確（gpt-image-1-mini 支援的值）
quality?: 'low' | 'medium' | 'high' | 'auto';
```

## 影響範圍

**修改檔案**：

- `.github/workflows/process-article-jobs.yml` - 環境變數清理
- `src/lib/agents/strategy-agent.ts` - 增強 Parser
- `src/lib/agents/orchestrator.ts` - 修正 quality 值
- `src/lib/agents/retry-config.ts` - 修正 quality 值
- `src/lib/agents/base-agent.ts` - 更新 quality 型別
- `src/types/agents.ts` - 更新 quality 型別定義

**相關系統**：

- GitHub Actions workflows
- Multi-Agent 文章生成系統
- gpt-image-1-mini 圖片生成服務
- 環境變數驗證機制

## 驗證計劃

1. **環境變數修復驗證**：
   - 觸發 workflow 並檢查環境變數驗證步驟是否通過
   - 確認所有環境變數都沒有換行符
   - 檢查 `GITHUB_ENV` 輸出

2. **StrategyAgent 驗證**：
   - 執行文章生成測試
   - 檢查日誌中 Parser 成功率
   - 確認不再使用 fallback outline

3. **gpt-image-1-mini 圖片生成驗證**：
   - 測試使用 `medium` quality（預設）
   - 測試使用 `high` quality（重試前）
   - 確認成本計算正確（~$0.07/張 for medium）
   - 檢查錯誤日誌，確認不再有 "Invalid value: 'standard'" 錯誤

## 相依性與優先順序

| 問題                          | 優先級  | 阻斷等級                | 預估修復時間 |
| ----------------------------- | ------- | ----------------------- | ------------ |
| 環境變數換行符                | 🔴 最高 | 完全阻斷                | 30 分鐘      |
| gpt-image-1-mini quality 參數 | 🟠 次高 | 完全阻斷圖片功能        | 20 分鐘      |
| StrategyAgent Parser          | 🟡 中等 | 部分影響（有 fallback） | 1 小時       |

**建議執行順序**：

1. 環境變數（最高優先，影響所有功能）
2. gpt-image-1-mini quality 參數（次高，完全阻斷圖片功能，修復快速）
3. StrategyAgent Parser（較低，有 fallback 機制）

**總預估時間**：~2 小時

## 參考資料

- [GitHub Actions Multiline Secrets Issue](https://github.com/tuist/tuist/issues/4781)
- [LLM Output Parser (2025)](https://kamenialexnea.github.io/portfolio/2025-03-01-llm-output-parser/)
- [OpenAI gpt-image-1 Quality Parameters](https://docs.aimlapi.com/api-references/image-models/openai/gpt-image-1)
- [GitHub Actions Secrets Best Practices](https://www.blacksmith.sh/blog/best-practices-for-managing-secrets-in-github-actions)

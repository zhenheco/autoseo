# 免費 AI 模型清單

## 推薦的免費模型

基於成本優化策略，以下是可用的免費 OpenRouter 模型：

### 1. Google Gemini 2.0 Flash Exp (FREE)
- **Model ID**: `google/gemini-2.0-flash-exp:free`
- **Context Length**: 1M tokens
- **適用於**: Research, Strategy (智能任務)
- **優點**: 超大 context，適合處理大量文檔

### 2. DeepSeek Chat V3.1 (FREE)
- **Model ID**: `deepseek/deepseek-chat-v3.1:free`
- **Context Length**: 164K tokens
- **適用於**: Writing, Meta (一般任務)
- **優點**: 平衡的性能，適合內容生成

### 3. DeepSeek R1 (FREE)
- **Model ID**: `deepseek/deepseek-r1:free`
- **Context Length**: 164K tokens
- **適用於**: Writing, Strategy (推理任務)
- **優點**: 強化推理能力

### 4. GLM-4.5 Air (FREE)
- **Model ID**: `z-ai/glm-4.5-air:free`
- **適用於**: 輕量級任務
- **優點**: 快速響應

### 5. Llama 4 Maverick (FREE)
- **Model ID**: `meta-llama/llama-4-maverick:free`
- **適用於**: 多用途任務
- **優點**: Meta 最新開源模型

### 6. DeepSeek R1T2 Chimera (FREE)
- **Model ID**: `tngtech/deepseek-r1t2-chimera:free`
- **適用於**: 複雜推理任務
- **優點**: 增強的推理能力

## 免費模型限制

### Rate Limits (需確認)
- **RPM** (Requests Per Minute): 待確認
- **TPM** (Tokens Per Minute): 待確認
- **Daily Limit**: 待確認

### 虛擬成本計算
雖然這些模型免費使用，但我們需要按 GPT-5 價格計算虛擬成本用於向客戶收費：
- **Input**: $0.00125 / 1K tokens
- **Output**: $0.01 / 1K tokens

## 建議的模型配置

### 配置 1: 品質優先 (目前使用) ✅
**原則**: 關鍵任務用付費高品質模型，簡單任務可用免費模型
```typescript
{
  research_model: 'google/gemini-2.5-pro',        // 付費 - 需要深度分析
  strategy_model: 'google/gemini-2.5-pro',        // 付費 - 需要策略規劃
  writing_model: 'x-ai/grok-4-fast',              // 付費但便宜 - 大量文字生成
  meta_model: 'deepseek/deepseek-chat-v3.1:free', // 免費 - 簡單的 meta 標籤
  image_model: 'openai/gpt-5-image-mini'          // 付費 - 無免費替代
}
```

### 配置 2: 成本優化 (測試中)
**原則**: 在保證品質前提下，盡可能使用免費模型
```typescript
{
  research_model: 'google/gemini-2.5-pro',        // 付費 - Research 品質關鍵
  strategy_model: 'google/gemini-2.5-pro',        // 付費 - Strategy 品質關鍵
  writing_model: 'deepseek/deepseek-chat-v3.1:free', // 免費 - 待測試品質
  meta_model: 'deepseek/deepseek-chat-v3.1:free', // 免費 - 適合簡單任務
  image_model: 'openai/gpt-5-image-mini'          // 付費 - 無免費替代
}
```

### 配置 3: 全免費 (實驗性)
**原則**: 最大化成本節省，但需接受品質妥協
```typescript
{
  research_model: 'google/gemini-2.0-flash-exp:free', // 免費 - 品質待驗證
  strategy_model: 'google/gemini-2.0-flash-exp:free', // 免費 - 品質待驗證
  writing_model: 'deepseek/deepseek-chat-v3.1:free',  // 免費
  meta_model: 'deepseek/deepseek-chat-v3.1:free',     // 免費
  image_model: 'openai/gpt-5-image-mini'              // 付費 - 無免費替代
}
```

## 選擇原則

**優先順序**: 品質 > 成本 > 速度

1. **Research & Strategy**: 這是文章品質的基礎，建議用付費高品質模型
2. **Writing**: 可以測試免費模型，但需驗證輸出品質
3. **Meta**: 簡單任務，免費模型足夠
4. **Image**: 目前無高品質免費替代

## 品質驗證流程

在切換到免費模型前：
1. 用相同 input 測試免費和付費模型
2. 比較輸出品質（完整性、準確性、格式）
3. 測試邊界情況（長文本、複雜結構）
4. 確認 JSON 解析穩定性
5. 評估 token 限制影響

## 實作計畫

1. **Token Counter System**: 追蹤每個請求的 token 使用量
2. **Virtual Cost Calculator**: 按 GPT-5 價格計算虛擬成本
3. **Rate Limiting Queue**: 管理免費模型的請求頻率
4. **Cost Statistics**: 生成成本報告用於客戶計費
5. **Scheduled Writing**: 文章生成依排程執行，避免超過 rate limit

## 待辦事項

- [ ] 查詢各免費模型的實際 rate limits
- [ ] 實作 token counter 系統
- [ ] 實作 virtual cost calculator
- [ ] 建立 rate limiting queue
- [ ] 測試免費模型的品質
- [ ] 比較不同配置的效果

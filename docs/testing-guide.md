# 文章生成系統測試指南

## 📋 前置準備

### 1. 環境變數設定

在 `.env.local` 中加入以下設定：

```bash
# OpenRouter API Key（必須）
# 申請地址: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# Supabase（已設定）
NEXT_PUBLIC_SUPABASE_URL=https://vdjzeregvyimgzflfalv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# SerpAPI（選填，用於實際 SERP 分析）
SERPAPI_API_KEY=your_serpapi_key
```

### 2. 資料庫準備

確保已執行所有 migrations：

```bash
npm run db:migrate
```

驗證資料表：
```bash
node -e "
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
(async () => {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const result = await client.query('SELECT COUNT(*) FROM ai_models WHERE is_active = true');
  console.log('可用的 AI 模型數量:', result.rows[0].count);
  await client.end();
})();
"
```

預期輸出：`可用的 AI 模型數量: 12`

### 3. 測試資料

測試腳本會自動：
- 使用現有的第一個公司
- 使用現有的第一個使用者
- 建立測試網站（如果不存在）
- 建立測試文章任務

## 🚀 執行測試

### 方法 1：使用測試腳本（推薦）

```bash
./scripts/run-test.sh
```

### 方法 2：直接執行

```bash
npx tsx scripts/test-article-generation.ts
```

## 📊 測試流程

測試腳本會依序執行以下步驟：

1. **環境檢查** ✅
   - 驗證環境變數
   - 檢查資料庫連線
   - 確認 AI 模型可用

2. **資料準備** 📝
   - 取得測試公司
   - 取得測試使用者
   - 建立/使用測試網站

3. **文章生成** 🎯
   - 建立文章任務
   - 執行 Orchestrator
   - 監控各階段執行

4. **結果驗證** ✨
   - 檢查執行統計
   - 驗證品質分數
   - 確認資料庫更新

## 📈 預期結果

成功的測試輸出範例：

```
🚀 開始測試文章生成流程

📋 檢查環境設定...
✅ 環境變數檢查通過

🔌 檢查資料庫連線...
✅ 資料庫連線正常

🤖 檢查 AI 模型配置...
✅ 找到 12 個可用的 AI 模型
   文字模型: 10
   圖片模型: 2

🏢 準備測試資料...
✅ 使用現有公司: xxx-xxx-xxx
✅ 使用測試使用者: yyy-yyy-yyy
✅ 使用現有網站: zzz-zzz-zzz

📝 建立測試文章任務...
✅ 文章任務已建立: aaa-aaa-aaa
   關鍵字: Next.js 15 新功能介紹

🎯 開始執行文章生成流程...

============================================================
Phase 1: Research Agent...
Phase 2: Strategy Agent...
Phase 3: Writing & Image Agents (並行)...
Phase 4: Meta Agent...
Phase 5: Quality Check...
============================================================

🎉 文章生成完成！

📊 執行統計:
   總執行時間: 45.23s
   成功: ✅

⏱️  各階段執行時間:
   Research: 8.12s
   Strategy: 9.45s
   Content: 18.67s
   Meta: 4.32s
   Quality: 4.67s
   並行加速: 1.85x

✨ 品質檢查結果:
   分數: 85/100
   通過: ✅

📝 文章資訊:
   字數: 2150
   段落數: 12
   閱讀時間: 9 分鐘

💾 資料庫狀態:
   任務狀態: completed
   內容長度: 15234 字元

✅ 測試完成！
```

## 🐛 常見問題

### 1. OPENROUTER_API_KEY 未設定

**錯誤訊息**：
```
❌ 缺少必要的環境變數: OPENROUTER_API_KEY
```

**解決方法**：
1. 前往 https://openrouter.ai/keys
2. 註冊並取得 API Key
3. 在 `.env.local` 中設定：
   ```
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
   ```

### 2. 找不到測試公司

**錯誤訊息**：
```
❌ 找不到測試公司，請先建立公司資料
```

**解決方法**：
1. 確保已執行 migrations
2. 透過註冊流程建立第一個使用者和公司
3. 或手動在資料庫中建立測試資料

### 3. AI 模型呼叫失敗

**錯誤訊息**：
```
❌ AI completion failed: ...
```

**可能原因**：
- API Key 無效或額度不足
- 網路連線問題
- 模型 ID 錯誤

**解決方法**：
1. 驗證 API Key 是否有效
2. 檢查 OpenRouter 帳戶額度
3. 測試 API 連線：
   ```bash
   curl https://openrouter.ai/api/v1/models \
     -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

### 4. 品質檢查未通過

**結果**：
```
✨ 品質檢查結果:
   分數: 65/100
   通過: ❌
```

**原因**：
- 文章字數不足
- 關鍵字密度不符
- 結構不完整

**處理方式**：
測試腳本會正常完成，但文章不會自動發布到 WordPress。
可以檢視 `quality_report` 欄位了解詳細問題。

## 📝 手動測試步驟

如果需要更詳細的控制，可以手動測試各個 Agent：

### 1. 測試 Research Agent

```typescript
import { ResearchAgent } from './src/lib/agents/research-agent';

const agent = new ResearchAgent(aiConfig, context);
const result = await agent.execute({
  keyword: 'Next.js 15',
  region: 'TW',
  competitorCount: 10,
  model: 'anthropic/claude-3.5-sonnet',
  temperature: 0.3,
  maxTokens: 4000,
});
console.log(result);
```

### 2. 測試 Strategy Agent

```typescript
import { StrategyAgent } from './src/lib/agents/strategy-agent';

const agent = new StrategyAgent(aiConfig, context);
const result = await agent.execute({
  researchData: researchOutput,
  brandVoice: { ... },
  targetWordCount: 2000,
  model: 'anthropic/claude-3.5-sonnet',
  temperature: 0.7,
  maxTokens: 4000,
});
console.log(result);
```

## 🔄 持續整合測試

可以將測試腳本整合到 CI/CD 流程：

```yaml
# .github/workflows/test.yml
name: Test Article Generation

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run test:article-generation
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## 📊 效能基準

基於 GPT-4o 和 Claude 3.5 Sonnet 的測試結果：

| 階段 | 平均時間 | 範圍 |
|------|---------|------|
| Research | 8-12s | 5-15s |
| Strategy | 9-12s | 7-15s |
| Writing | 15-25s | 12-30s |
| Image | 8-15s | 6-20s |
| Meta | 3-6s | 2-8s |
| Quality | 3-6s | 2-8s |
| **總計** | **40-60s** | **30-90s** |

並行加速比：約 **1.5-2.0x**

## 🎯 下一步

測試通過後，可以：

1. **建立 UI 測試頁面**
   - 在 Dashboard 中新增測試按鈕
   - 即時顯示生成進度

2. **整合 N8N Workflow**
   - 實際串接 N8N webhook
   - 測試完整的生產環境流程

3. **效能優化**
   - 調整 Agent 的 temperature 和 maxTokens
   - 測試不同模型的效果
   - 優化並行執行策略

4. **監控設定**
   - 設定錯誤告警
   - 建立效能儀表板
   - 追蹤成本和 Token 使用

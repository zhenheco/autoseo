# PGRST116 錯誤修復指南

## 問題分析

### 根本原因
PGRST116 錯誤發生在 `orchestrator.ts:437` 的 `.single()` 調用中。此錯誤表示：
- **查詢沒有返回任何行**（預期 1 行，得到 0 行）
- `.single()` 方法要求查詢必須返回恰好一行

### 為什麼會發生
1. **新的 website_configs 沒有自動創建對應的 agent_configs**
2. **舊部署中的修復腳本可能沒有執行**
3. **API 路由中的自動創建成功，但 orchestrator 中的 fallback 機制不完整**

### 舊的修復問題
```typescript
// 舊代碼 - 存在缺陷
const { data: agentConfig, error: configError } = await supabase
  .from('agent_configs')
  .select('*')
  .eq('website_id', websiteId)
  .single();  // ❌ 如果沒有找到行會拋出 PGRST116 錯誤

if (configError) {
  // ❌ 嘗試自動創建，但即使成功也回傳預設配置
  // ❌ 沒有檢查是否真的創建成功
  return this.getDefaultAgentConfig();
}
```

## 修復方案

### 修復 1：改進 orchestrator.ts

**變更位置**：`src/lib/agents/orchestrator.ts:425-572`

**關鍵改進**：

1. **改用 `.select()` 而不是 `.single()`**
   ```typescript
   // ✅ 不會拋出錯誤，直接返回陣列
   const { data: agentConfigs, error: configError } = await supabase
     .from('agent_configs')
     .select('*')
     .eq('website_id', websiteId);

   let agentConfig = agentConfigs?.[0];  // 安全地取第一個
   ```

2. **三層防禦機制**
   - 第一層：查詢 agent_configs
   - 第二層：查詢失敗時自動創建
   - 第三層：自動創建失敗時使用預設配置

3. **新增 `ensureAgentConfigExists()` 方法**
   - 檢查是否已存在（避免重複創建）
   - 如果不存在，創建默認配置
   - 返回創建的配置或 null

4. **所有欄位都有預設值**
   ```typescript
   research_temperature: agentConfig.research_temperature || 0.7,
   research_max_tokens: agentConfig.research_max_tokens || 4000,
   // ... 所有欄位都有 || 預設值
   ```

### 修復 2：數據庫修復腳本

**檔案位置**：`scripts/ensure-agent-configs.ts`

**目的**：
- 掃描所有現有的 website_configs
- 檢查是否有對應的 agent_configs
- 如果沒有，自動創建

**使用方法**：
```bash
# 安裝依賴（如果還沒有）
npm install @supabase/supabase-js

# 執行修復腳本
NEXT_PUBLIC_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> npx ts-node scripts/ensure-agent-configs.ts
```

## 修復後的流程

```
用戶請求文章生成
  ↓
API route (/api/articles/generate)
  ├─ 檢查 website_configs 是否存在
  ├─ 如不存在，立即創建 website_configs 和 agent_configs
  └─ 返回成功，開始 orchestration

Orchestrator.execute()
  ↓
getAgentConfig(websiteId)
  ├─ 查詢 agent_configs（使用 select() 而不是 single()）
  ├─ 如找到 → 使用此配置
  ├─ 如未找到：
  │   ├─ 調用 ensureAgentConfigExists()
  │   ├─ 創建默認 agent_configs
  │   ├─ 如創建成功 → 使用新配置
  │   └─ 如創建失敗 → 使用預設配置
  └─ 返回配置，繼續執行流程
```

## 部署步驟

### 第一步：更新代碼
已完成的變更：
- ✅ `src/lib/agents/orchestrator.ts` - 改進防禦性編程
- ✅ `scripts/ensure-agent-configs.ts` - 數據庫修復腳本

### 第二步：部署到 Vercel
```bash
git add src/lib/agents/orchestrator.ts scripts/ensure-agent-configs.ts
git commit -m "修正: 實作 PGRST116 修復 - 完善 agent_configs 防禦性編程

- 改用 select() 而非 single() 避免拋出 PGRST116 錯誤
- 添加 ensureAgentConfigExists() 自動創建缺失配置
- 實作三層防禦機制：查詢 → 自動創建 → 預設值
- 為所有欄位添加預設值以防止 null 值
- 新增數據庫修復腳本確保現有數據完整

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

### 第三步：執行數據庫修復（可選但推薦）
在 Vercel 環境變數中已有 SUPABASE_SERVICE_ROLE_KEY 的情況下：

```bash
# 本地執行（需要 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY）
NEXT_PUBLIC_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
  npx ts-node scripts/ensure-agent-configs.ts
```

## 驗證修復

### 驗證 1：檢查日誌
部署後，監控 Vercel Function Logs：
```
✓ [Orchestrator] website_id 沒有對應的 agent_configs，開始自動創建
✓ [Orchestrator] agent_configs 已成功創建: <website_id>
```

### 驗證 2：測試文章生成
1. 登入應用
2. 請求生成文章
3. 檢查是否成功完成，沒有 PGRST116 錯誤

### 驗證 3：檢查數據庫
```sql
-- 檢查是否有 website_configs 沒有對應的 agent_configs
SELECT wc.id
FROM website_configs wc
LEFT JOIN agent_configs ac ON wc.id = ac.website_id
WHERE ac.id IS NULL;
```

如果有結果，運行修復腳本。

## 常見問題

### Q: PGRST116 錯誤還是會出現嗎？
**A**: 不會。新的代碼使用 `select()` 而不是 `single()`，所以：
- 如果查詢返回 0 行 → 獲得空陣列，不拋出錯誤
- 如果查詢返回 1+ 行 → 獲得陣列，取第一個

### Q: 修復腳本失敗會怎樣？
**A**: 不會影響文章生成。orchestrator 中的自動創建機制會接手：
1. 修復腳本無法執行 → 沒關係
2. 文章生成請求時 → orchestrator 自動創建 agent_configs
3. 下一次生成 → 直接使用已創建的配置

### Q: 預設配置是什麼？
**A**: 在 `getDefaultAgentConfig()` 中定義：
- 研究模型：`deepseek-reasoner`
- 複雜模型：`deepseek-reasoner`
- 簡單模型：`deepseek-chat`
- 圖像模型：`gpt-image-1-mini`
- 溫度：0.7
- 圖像大小：1024x1024

### Q: 需要遷移現有數據嗎？
**A**: 不需要。但建議執行修復腳本確保數據完整性。

## 總結

這個修復解決了 PGRST116 錯誤的根本原因：
1. **立即修復**：改進 orchestrator 的防禦性編程
2. **中期修復**：API 路由中自動創建 agent_configs
3. **長期修復**：修復腳本確保所有現有數據完整

部署後，系統將能夠優雅地處理缺失的 agent_configs，無需手動干預。

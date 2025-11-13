# 設計文件

## 問題分析

### 1. 環境變數換行符問題

**技術細節**：
- GitHub Secrets 在儲存時會保留輸入的格式，包括換行符
- Bash 變數在使用 `${{ secrets.XXX }}` 語法時會直接展開
- YAML 多行語法可能導致意外的換行符

**當前驗證邏輯**：
```bash
check_env_var() {
  local var_value="${!var_name}"
  if printf '%s' "$var_value" | grep -q $'\n'; then
    echo "❌ 錯誤: $var_name 包含換行符"
    return 1
  fi
}
```

這個驗證非常嚴格，任何換行符都會導致失敗。

### 2. 圖片生成 API 參數不匹配

**OpenAI API 支援的 quality 值**：
- `'low'` - 低品質（快速、便宜）
- `'medium'` - 中等品質（平衡）
- `'high'` - 高品質（慢、貴）
- `'auto'` - 自動選擇

**程式碼目前使用的值**：
- `'standard'` - **不被支援**
- `'hd'` - **不被支援**（雖然 DALL-E 3 支援）

**不一致來源**：
- 可能是混淆了不同 API 的參數
- 或者是舊版 API 的遺留代碼

### 3. StrategyAgent Parser 失敗

**可能的失敗原因**：

1. **AI 回應格式不符合預期**：
   - AI 可能在 JSON 前後加上說明文字
   - JSON 格式不完整或有語法錯誤
   - 使用了 Markdown 代碼塊包裹 JSON

2. **Parser 邏輯不夠健全**：
   - 正則表達式無法匹配所有情況
   - 錯誤處理不足
   - 缺少日誌來診斷問題

## 解決方案設計

### 方案 1：環境變數清理（推薦）

**實作方式**：

在 workflow 中新增清理步驟：

```yaml
- name: Clean environment variables
  id: clean-env
  run: |
    echo "NEXT_PUBLIC_SUPABASE_URL=$(echo -n '${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}' | tr -d '\n\r')" >> $GITHUB_ENV
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo -n '${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}' | tr -d '\n\r')" >> $GITHUB_ENV
    # ... 其他環境變數
```

**優點**：
- 自動化處理，不需要手動操作
- 適用於所有現有 Secrets
- 避免未來再次發生

**缺點**：
- 需要列出所有環境變數
- workflow 檔案變長

**替代方案：修改驗證邏輯**

不驗證換行符，而是在使用前自動清理：

```bash
check_env_var() {
  local var_value="${!var_name}"
  # 自動清理換行符
  var_value=$(echo -n "$var_value" | tr -d '\n\r')
  export "$var_name=$var_value"

  if [ -z "$var_value" ]; then
    echo "❌ 錯誤: $var_name 未設定"
    return 1
  fi

  echo "✅ $var_name: 已設定且已清理"
  return 0
}
```

**優點**：
- 更簡潔
- 自動處理所有變數
- 不需要逐一列出

### 方案 2：圖片 quality 參數映射

**選項 A：直接修改為 API 支援的值**

```typescript
// orchestrator.ts
quality: 'medium' as const,  // 從 'standard' 改為 'medium'
```

**選項 B：建立映射層**

```typescript
// image-client.ts
const qualityMap = {
  'standard': 'medium',
  'hd': 'high',
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
  'auto': 'auto',
} as const;

const apiQuality = qualityMap[userQuality] || 'medium';
```

**推薦**：選項 B
- 保持向後相容性
- 更靈活
- 用戶友好的命名（standard/hd）映射到 API 值

### 方案 3：增強 Parser 健全性

**改進策略**：

1. **多重提取嘗試**：
   ```typescript
   // 嘗試 1：直接 JSON.parse
   // 嘗試 2：提取 ```json...``` 代碼塊
   // 嘗試 3：使用正則提取 {...}
   // 嘗試 4：fallback outline
   ```

2. **改進 AI Prompt**：
   ```typescript
   const prompt = `...

   ## 重要：輸出格式
   請直接輸出 JSON，不要包含任何額外說明或 Markdown 代碼塊。
   輸出必須以 { 開頭，以 } 結尾。

   範例正確輸出：
   {"introduction": {...}, "mainSections": [...], ...}

   範例錯誤輸出（不要這樣做）：
   以下是大綱的 JSON 格式：
   \`\`\`json
   {...}
   \`\`\`
   `;
   ```

3. **增加日誌**：
   ```typescript
   console.log('[StrategyAgent] AI Response length:', response.length);
   console.log('[StrategyAgent] First 200 chars:', response.substring(0, 200));
   console.log('[StrategyAgent] Last 200 chars:', response.substring(response.length - 200));
   ```

## 架構影響

### 修改點

```
.github/workflows/
  └── process-article-jobs.yml  ← 新增環境變數清理步驟

src/lib/
  ├── agents/
  │   ├── orchestrator.ts        ← 修改 quality: 'medium'
  │   └── strategy-agent.ts      ← 增強 parser 和日誌
  └── openai/
      └── image-client.ts        ← 新增 quality 映射層

src/types/
  ├── agents.ts                  ← 可能更新型別定義
  └── ai-models.ts               ← 可能更新型別定義
```

### 相依性

- 所有修改都是向下相容的
- 不影響現有的資料庫結構
- 不需要遷移現有資料

## 風險評估

| 風險 | 機率 | 影響 | 緩解措施 |
|------|------|------|----------|
| 環境變數清理導致值被意外修改 | 低 | 高 | 清理前後記錄日誌，驗證值正確性 |
| quality 映射導致圖片品質下降 | 中 | 低 | 'standard' → 'medium' 品質相近，且 API 穩定 |
| Parser 改進後仍然失敗 | 中 | 中 | 保留 fallback 機制，確保系統可用性 |
| 修改導致新的錯誤 | 低 | 中 | 完整的測試計劃，逐步驗證 |

## 測試策略

### 單元測試
- [ ] 環境變數清理函數測試
- [ ] quality 映射函數測試
- [ ] Parser fallback 邏輯測試

### 整合測試
- [ ] GitHub Actions workflow 端到端測試
- [ ] 圖片生成功能測試
- [ ] 文章生成完整流程測試

### 驗收標準
- ✅ 環境變數驗證步驟通過
- ✅ 圖片可以成功生成
- ✅ StrategyAgent Parser 錯誤減少 90% 以上
- ✅ 完整文章生成成功率 > 95%

## 回滾計劃

如果修復導致問題：

1. **環境變數**：移除清理步驟，回到原始 workflow
2. **圖片 quality**：恢復原始值，或使用映射層的預設值
3. **Parser**：恢復原始 parser 邏輯，保留 fallback

所有修改都應該提交獨立的 commit，方便 git revert。

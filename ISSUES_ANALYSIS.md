# 問題分析與修復方案

## 用戶回報的問題

1. ❌ 圖片模型使用 DALL-E，但用戶不要用 DALL-E，要用 `gpt-image-1`
2. ❌ 前端看到的是 markdown，而不是 HTML 加圖片
3. ⚠️  R2 上傳失敗後 fallback 到 Supabase，要確保回傳正確的圖片網址

---

## 問題 1: 圖片模型混淆 ✅ 已解決

### 原始分析（錯誤）

~~OpenAI 的 `/v1/images/generations` API 只支援 `dall-e-2` 和 `dall-e-3`~~

### ✅ 實際狀況（用戶驗證）

**用戶提供的 n8n workflow 證明**：OpenAI API **確實支援** `gpt-image-1-mini` 模型！

```json
{
  "model": "gpt-image-1-mini",
  "prompt": "...",
  "n": 1,
  "size": "1024x1024",
  "quality": "medium"
}
```

### 🔧 修復方案（已實作）

**修改 `ai-client.ts:250-261`**：直接使用 `options.model` 而不進行轉換

```typescript
// 直接使用指定的模型（支援 gpt-image-1-mini, gpt-image-1 等）
const requestBody: Record<string, unknown> = {
  model: options.model,  // ✅ 直接使用，不轉換
  prompt: prompt,
  n: 1,
  size: options.size || '1024x1024',
};

// 加入 quality 參數（支援 standard, hd, medium 等）
if (options.quality) {
  requestBody.quality = options.quality;
}
```

**關鍵發現**：
- OpenAI API 支援 `gpt-image-1-mini` 作為有效模型名稱
- 支援 `quality` 參數：`standard`, `hd`, `medium`
- 不需要任何模型名稱轉換

---

## 問題 2: 前端顯示 Markdown 而非 HTML

### 可能原因

1. **API 未返回 `html_content`**
   - 檢查 `/api/articles` 是否包含 `html_content` 在 select query
   - **已確認**: Line 43 有包含 `html_content`

2. **HTML 內容為空或 null**
   - 生成過程中未正確儲存 HTML
   - 需要檢查 `ArticleStorage` 是否正確儲存

3. **前端錯誤使用 markdown_content**
   - **已確認**: Line 373 使用 `html_content`
   ```tsx
   dangerouslySetInnerHTML={{ __html: selectedArticle.html_content || '<p>內容載入中...</p>' }}
   ```

### 🔍 診斷步驟

1. 檢查實際生成的文章資料：
```bash
pnpm exec tsx scripts/check-generated-articles.ts
```

2. 直接查詢資料庫確認 HTML 內容：
```sql
SELECT id, title,
  LENGTH(html_content) as html_length,
  LENGTH(markdown_content) as md_length
FROM generated_articles
ORDER BY created_at DESC
LIMIT 5;
```

3. 檢查 ArticleStorage 儲存邏輯

---

## 問題 3: 圖片上傳 Fallback URL 回傳

### 現狀分析

**上傳順序** (`image-agent.ts:214-250`):
1. **R2 優先** → 成功則 `finalUrl = uploaded.url`
2. **Supabase Storage 備援** → 成功則 `finalUrl = uploaded.url`
3. **OpenAI 臨時 URL 最後手段** → 保持 `result.url`（1小時有效）

### ✅ 代碼檢查結果

```typescript
// image-agent.ts:214-246 (Featured Image)
let finalUrl = result.url;  // 初始為 OpenAI URL
let uploadSuccess = false;

// 嘗試 R2
if (r2Config) {
  try {
    const uploaded = await r2Client.uploadImage(base64Data, filename, 'image/jpeg');
    finalUrl = uploaded.url;  // ✅ 更新為 R2 URL
    uploadSuccess = true;
  } catch (error) {
    console.warn('[ImageAgent] ⚠️ R2 上傳失敗:', error.message);
  }
}

// Fallback to Supabase
if (!uploadSuccess) {
  const supabaseConfig = getSupabaseStorageConfig();
  if (supabaseConfig) {
    try {
      const uploaded = await supabaseClient.uploadImage(base64Data, filename, 'image/jpeg');
      finalUrl = uploaded.url;  // ✅ 更新為 Supabase URL
      uploadSuccess = true;
    } catch (error) {
      console.warn('[ImageAgent] ⚠️ Supabase Storage 上傳失敗:', error.message);
    }
  }
}

// 返回最終 URL（R2 > Supabase > OpenAI 臨時）
return {
  url: finalUrl,  // ✅ 正確回傳
  altText: input.outline.mainSections[0].heading,
  width: 1024,
  height: 1024,
};
```

### ✅ 結論

**圖片 URL fallback 邏輯已正確實作**：
- R2 成功 → 回傳 R2 永久 URL
- R2 失敗 + Supabase 成功 → 回傳 Supabase 永久 URL
- 全部失敗 → 回傳 OpenAI 臨時 URL（⚠️ 1小時有效）

**建議**：確保以下環境變數已正確設定：
```bash
# R2 配置
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx

# Supabase Storage 配置（備援）
SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_STORAGE_BUCKET=xxx
```

---

## 優先修復順序

### 🔴 高優先級

1. **修正圖片模型調用**
   - 將 `gpt-image-1-mini` 轉換為 `dall-e-2`（成本效益）或 `dall-e-3`（最高品質）
   - 檔案: `src/lib/ai/ai-client.ts:264-265`

2. **診斷前端 markdown 問題**
   - 執行診斷腳本查看生成的文章實際內容
   - 確認 `html_content` 是否為空

### 🟡 中優先級

3. **確認 R2 環境變數**
   ```bash
   vercel env ls | grep R2
   ```

4. **測試完整流程**
   - 生成新文章
   - 確認圖片上傳到 R2 或 Supabase
   - 驗證前端正確顯示 HTML + 圖片

---

## 下一步行動

1. 修改 `ai-client.ts` 中的圖片模型轉換邏輯
2. 執行診斷腳本確認當前文章內容狀態
3. 如果 `html_content` 為空，檢查 `ArticleStorage` 儲存邏輯
4. 測試完整的文章生成流程

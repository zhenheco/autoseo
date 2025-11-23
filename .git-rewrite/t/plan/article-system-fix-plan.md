# 文章系統完整修復計劃

**日期**: 2025-11-11
**Request ID**: 7hjn8-1762866843622-c88459ce4490
**狀態**: 待執行

---

## 📊 問題根因分析

### 🔴 問題 1: HTMLAgent Fatal Error（P0 - 阻塞問題）

**錯誤訊息**:

```
TypeError: Cannot destructure property 'firstElementChild' of 'a' as it is null.
at D.insertFAQSchema (.next/server/chunks/2424.js:267:5197)
```

**根本原因**:

1. **WritingAgent 輸出格式**: 只輸出 HTML 片段（`<h2>`, `<p>` 等），沒有 `<html>`, `<head>`, `<body>` 包裹
2. **linkedom 行為**: 根據 GitHub Issue #106，linkedom 的 `parseHTML` 在處理片段時不會自動創建完整的 DOM 結構（不像瀏覽器）
3. **insertFAQSchema 假設**: 代碼假設 `document.head` 存在，並嘗試訪問 `firstElementChild`
4. **連鎖失敗**: FAQ Schema 插入失敗 → HTMLAgent 拋出錯誤 → 整個流程中斷 → 文章未儲存

**影響範圍**:

- ❌ 文章無法生成
- ❌ 資料庫沒有記錄
- ❌ 預覽顯示空白
- ❌ 用戶體驗嚴重受損

**證據（日誌）**:

```
2025-11-11 13:23:04.780 [error] [HTMLAgent] HTMLAgent failed {
  error: TypeError: Cannot destructure property 'firstElementChild' of 'a' as it is null.
}
2025-11-11 13:23:14.983 [error] Article generation error
```

---

### 🟡 問題 2: R2 Upload Failed（P1 - 有 Fallback）

**錯誤訊息**:

```
Failed to upload to R2, using original URL: Invalid character in header content ["authorization"]
```

**根本原因分析**:

1. **HTTP Header 限制**: HTTP headers 只能包含 ASCII 字符
2. **可能的原因**:
   - R2 credentials 包含非 ASCII 字符或特殊符號
   - Base64 編碼的 credentials 包含換行符
   - AWS SDK 與 Cloudflare R2 的兼容性問題
3. **代碼實現**: ImageAgent 使用 AWS S3Client，理論上應自動處理 Authorization（使用 AWS Signature V4）

**影響範圍**:

- ⚠️ 圖片使用 OpenAI 臨時 URL（會在 1 小時後過期）
- ⚠️ 無法享受 R2 的 CDN 和永久儲存
- ✅ 不會中斷文章生成流程（有 fallback）

**證據（日誌）**:

```
2025-11-11 13:20:14.416 [warning] [ImageAgent] Failed to upload to R2, using original URL: Invalid character in header content ["authorization"]
2025-11-11 13:21:48.528 [warning] [ImageAgent] Failed to upload to R2, using original URL: Invalid character in header content ["authorization"]
2025-11-11 13:22:24.281 [warning] [ImageAgent] Failed to upload to R2, using original URL: Invalid character in header content ["authorization"]
```

---

### 🟡 問題 3: MetaAgent 使用錯誤模型（P1 - 成本問題）

**日誌證據**:

```
2025-11-11 13:22:39.060 [warning] [RateLimiter] No rate limit config for model: gpt-3.5-turbo, using default
```

**根本原因分析**:

1. **配置優先順序**:
   ```
   meta_model → simple_processing_model → 預設 'deepseek-chat'
   ```
2. **可能的原因**:
   - 資料庫 `agent_configs` 表中配置了 `gpt-3.5-turbo`
   - 或代碼某處硬編碼了該模型
3. **代碼分析**: Orchestrator 應該正確傳遞模型，但實際執行時使用了 gpt-3.5-turbo

**影響範圍**:

- 💰 成本增加（GPT-3.5 比 DeepSeek 貴約 10 倍）
- ⚠️ 性能可能不一致
- ✅ 不影響功能正確性

**預期模型使用**:

- ✅ ResearchAgent: `deepseek-reasoner`
- ✅ WritingAgent: `deepseek-chat`
- ✅ ImageAgent: `gpt-image-1-mini`
- ❌ MetaAgent: `gpt-3.5-turbo` → 應該是 `deepseek-chat`

---

### 🟢 問題 4: 文章列表顯示關鍵字（P2 - UI 問題）

**現狀**:

```typescript
displayTitle: job.metadata?.title
  ? `${job.keywords[0] || ""} - ${job.metadata.title}` // "關鍵字 - 標題"
  : job.keywords.join(", ");
```

**期望**:

```typescript
displayTitle: job.metadata?.title || job.keywords.join(", "); // 只顯示標題
```

**影響範圍**:

- 📱 用戶體驗不佳（列表混亂）
- ✅ 不影響功能正確性

---

## 🔧 修復方案

### 修復 1: HTMLAgent 完整重構（P0）

**檔案**: `src/lib/agents/html-agent.ts`

#### 修改 1.1: 確保完整的 HTML 文檔結構

**位置**: `process` 方法

**修改前**:

```typescript
async process(
  html: string,
  internalLinks: InternalLink[] = [],
  externalReferences: ExternalReference[] = []
): Promise<string> {
  const { parseHTML } = await import('linkedom');
  const { document } = parseHTML(html);
  const body = document.body;

  // ... 處理邏輯

  return body.innerHTML;
}
```

**修改後**:

```typescript
async process(
  html: string,
  internalLinks: InternalLink[] = [],
  externalReferences: ExternalReference[] = []
): Promise<string> {
  try {
    // 🔴 關鍵修復：確保 HTML 有完整結構
    let fullHtml = html.trim();

    // 如果輸入是片段（沒有 <html> 標籤），包裝成完整文檔
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

    const { parseHTML } = await import('linkedom');
    const { document } = parseHTML(fullHtml);

    // 驗證必要元素存在
    if (!document.body) {
      this.logger.error('Failed to parse HTML: body element not found');
      return html; // 返回原始 HTML
    }

    const body = document.body;

    // 依序處理各項功能
    if (internalLinks.length > 0) {
      this.insertInternalLinks(body, internalLinks);
    }

    if (externalReferences.length > 0) {
      this.insertExternalReferences(body, externalReferences);
    }

    // 🔴 修復：安全地插入 FAQ Schema
    this.insertFAQSchema(document, body);

    this.optimizeForWordPress(body);

    // 只返回 body 內容（保持向後兼容）
    return body.innerHTML;

  } catch (error) {
    this.logger.error('HTML processing failed, returning original HTML', {
      error,
      htmlLength: html.length,
      htmlPreview: html.substring(0, 200)
    });
    return html; // 🔴 關鍵：出錯時返回原始 HTML，不中斷流程
  }
}
```

#### 修改 1.2: 重構 insertFAQSchema 方法

**位置**: `insertFAQSchema` 方法（完整替換）

**修改後**:

```typescript
private insertFAQSchema(document: Document, body: Element): void {
  try {
    // 🔴 多語言支援：支援多種 FAQ 標題格式
    const faqHeadings = Array.from(body.querySelectorAll('h2, h3')).filter((h) => {
      const text = (h.textContent || '').toLowerCase().trim();
      return (
        text.includes('常見問題') ||
        text.includes('faq') ||
        text.includes('frequently asked questions') ||
        text.includes('q&a') ||
        text.includes('問與答') ||
        text.includes('qa')
      );
    });

    if (faqHeadings.length === 0) {
      this.logger.info('ℹ️ No FAQ section found, skipping FAQ schema');
      return;
    }

    const faqSection = faqHeadings[0];
    let currentElement = faqSection.nextElementSibling;
    const faqs: { question: string; answer: string }[] = [];

    // 解析 FAQ 項目
    while (currentElement) {
      if (currentElement.tagName === 'H2' || currentElement.tagName === 'H3') {
        const text = currentElement.textContent || '';
        if (text.toLowerCase().includes('q:') || text.toLowerCase().includes('question')) {
          const question = text.replace(/^(###?|\*\*)?\\s*Q:\\s*/i, '').trim();
          let answer = '';
          let answerElement = currentElement.nextElementSibling;

          while (answerElement && answerElement.tagName !== 'H2' && answerElement.tagName !== 'H3') {
            const answerText = answerElement.textContent || '';
            if (answerText.toLowerCase().startsWith('a:') || answerText.toLowerCase().startsWith('answer')) {
              answer = answerText.replace(/^A:\\s*/i, '').trim();
            } else if (answer) {
              answer += ' ' + answerText;
            }
            answerElement = answerElement.nextElementSibling;
          }

          if (question && answer) {
            faqs.push({ question, answer });
          }
        }
      }
      currentElement = currentElement.nextElementSibling;
    }

    if (faqs.length === 0) {
      this.logger.info('ℹ️ No FAQ items found in FAQ section');
      return;
    }

    // 生成 Schema.org FAQPage JSON-LD
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    const scriptElement = document.createElement('script');
    scriptElement.setAttribute('type', 'application/ld+json');
    scriptElement.textContent = JSON.stringify(schema, null, 2);

    // 🔴 關鍵修復：安全地插入到 body 末尾（而非 head）
    // 因為我們最終只返回 body.innerHTML，插入到 head 會丟失
    body.appendChild(scriptElement);

    this.logger.info(`✅ FAQ Schema inserted with ${faqs.length} items`);

  } catch (error) {
    this.logger.warn('⚠️ Failed to insert FAQ schema, continuing...', { error });
    // 不拋出錯誤，允許流程繼續
  }
}
```

#### 修改 1.3: 增強錯誤處理

**位置**: `insertInternalLinks` 和 `insertExternalReferences` 方法

**修改**: 在每個方法外層包裹 try-catch，捕獲錯誤後記錄警告但不拋出

```typescript
private insertInternalLinks(body: Element, links: InternalLink[]): void {
  try {
    // 現有邏輯...
  } catch (error) {
    this.logger.warn('⚠️ Failed to insert internal links', {
      error,
      linksCount: links.length
    });
    // 不拋出錯誤
  }
}

private insertExternalReferences(body: Element, references: ExternalReference[]): void {
  try {
    // 現有邏輯...
  } catch (error) {
    this.logger.warn('⚠️ Failed to insert external references', {
      error,
      referencesCount: references.length
    });
    // 不拋出錯誤
  }
}
```

---

### 修復 2: R2 上傳診斷和修復（P1）

#### 階段 2.1: 檢查環境變數

**檢查項目**:

1. 登入 Vercel Dashboard
2. 進入專案 Settings → Environment Variables
3. 確認以下變數：
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_PUBLIC_DOMAIN`

**驗證**:

- 確認沒有多餘的空白字符
- 確認沒有非 ASCII 字符
- 確認 key 長度正確（Access Key 通常 32 字符）

#### 階段 2.2: 增強診斷日誌

**檔案**: `src/lib/agents/image-agent.ts`

**位置**: `uploadToR2` 方法（約 194-204 行）

**修改前**:

```typescript
const uploaded = await r2Client.uploadImage(base64Data, filename, contentType);
return uploaded.url;
```

**修改後**:

```typescript
private async uploadToR2(
  base64Data: string,
  filename: string,
  contentType: string
): Promise<string> {
  try {
    // 🔴 增加診斷日誌
    this.logger.info('🔍 R2 Upload Diagnostics', {
      filename,
      contentType,
      base64Length: base64Data.length,
      hasR2Config: !!this.r2Config,
      r2AccountId: this.r2Config?.accountId ? 'SET' : 'MISSING',
      r2AccessKeyId: this.r2Config?.accessKeyId ? 'SET' : 'MISSING',
      r2SecretAccessKey: this.r2Config?.secretAccessKey ? 'SET' : 'MISSING',
      r2BucketName: this.r2Config?.bucketName ? 'SET' : 'MISSING',
    });

    const r2Client = new R2Client(this.r2Config);
    const uploaded = await r2Client.uploadImage(base64Data, filename, contentType);

    this.logger.info('✅ R2 upload successful', {
      filename,
      url: uploaded.url
    });

    return uploaded.url;

  } catch (error) {
    // 🔴 詳細錯誤日誌
    this.logger.warn('❌ R2 upload failed', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      filename,
      contentType,
    });
    throw error;
  }
}
```

#### 階段 2.3: R2Client 診斷

**檔案**: `src/lib/storage/r2-client.ts`

**位置**: `uploadImage` 方法開頭

**新增**:

```typescript
async uploadImage(
  base64Data: string,
  filename: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  try {
    // 🔴 驗證 credentials
    if (!this.config.accessKeyId || !this.config.secretAccessKey) {
      throw new Error('R2 credentials not configured');
    }

    // 檢查是否包含非 ASCII 字符
    const hasNonASCII = (str: string) => /[^\x00-\x7F]/.test(str);

    if (hasNonASCII(this.config.accessKeyId) || hasNonASCII(this.config.secretAccessKey)) {
      throw new Error('R2 credentials contain non-ASCII characters');
    }

    // 現有上傳邏輯...

  } catch (error) {
    console.error('R2Client upload error:', error);
    throw error;
  }
}
```

---

### 修復 3: MetaAgent 模型配置（P1）

#### 階段 3.1: 檢查資料庫配置

**查詢 SQL**:

```sql
SELECT
  id,
  website_id,
  meta_model,
  simple_processing_model,
  created_at,
  updated_at
FROM agent_configs
WHERE website_id = '526b7300-a86f-4e90-91e7-788000b987fc';
```

**預期結果**:

- `meta_model` 應該是 `null` 或 `'deepseek-chat'`
- 如果是 `'gpt-3.5-turbo'`，需要更新

#### 階段 3.2: 搜尋硬編碼模型

**命令**:

```bash
grep -r "gpt-3.5-turbo" src/lib/agents/
grep -r "gpt-3.5-turbo" src/lib/services/
```

**預期**: 應該找不到硬編碼的 gpt-3.5-turbo

#### 階段 3.3: 統一模型配置

**檔案**: `src/lib/agents/orchestrator.ts`

**位置**: 約 606 行（MetaAgent 初始化）

**確保邏輯正確**:

```typescript
const metaAgent = new MetaAgent({
  model:
    agentConfig.meta_model ||
    agentConfig.simple_processing_model ||
    "deepseek-chat",
  temperature: 0.5,
  maxTokens: 500,
});
```

**新增驗證日誌**（在 execute 方法開頭）:

```typescript
// 在 execute 方法開始處（約 70 行）
this.logger.info("📋 Agent Models Configuration", {
  research_model: researchModel,
  strategy_model: strategyModel,
  writing_model: writingModel,
  meta_model:
    agentConfig.meta_model ||
    agentConfig.simple_processing_model ||
    "deepseek-chat",
  image_model: "gpt-image-1-mini",
});
```

---

### 修復 4: 文章列表顯示（P2）

**檔案**: `src/app/(dashboard)/dashboard/articles/page.tsx`

**位置**: 約 109-110 行

**修改前**:

```typescript
displayTitle: job.metadata?.title
  ? `${job.keywords[0] || ""} - ${job.metadata.title}`
  : job.keywords.join(", ");
```

**修改後**:

```typescript
displayTitle: job.metadata?.title || job.keywords.join(", ");
```

---

## 🧪 測試計劃

### 測試 1: HTMLAgent 修復驗證

**步驟**:

1. 生成測試文章（關鍵字：「測試 AI 寫作」）
2. 觀察 Vercel logs
3. 檢查資料庫 `articles` 表

**預期結果**:

- ✅ HTMLAgent 不再拋出錯誤
- ✅ 日誌顯示：`✅ FAQ Schema inserted with X items`
- ✅ 文章成功儲存到資料庫
- ✅ `html_content` 欄位不為 null
- ✅ 預覽區域顯示完整內容

**失敗處理**:

- 如果仍然失敗，檢查完整的錯誤堆疊
- 確認 linkedom 版本是否正確

### 測試 2: R2 上傳診斷

**步驟**:

1. 生成測試文章
2. 觀察 R2 Upload Diagnostics 日誌
3. 確認環境變數狀態

**可能結果**:

**情況 A: 環境變數缺失**

```
r2AccountId: 'MISSING'
```

→ 需要在 Vercel 設定環境變數

**情況 B: 非 ASCII 字符錯誤**

```
Error: R2 credentials contain non-ASCII characters
```

→ 重新生成 R2 API tokens

**情況 C: 上傳成功**

```
✅ R2 upload successful
```

→ 問題已解決

### 測試 3: 模型配置驗證

**步驟**:

1. 執行資料庫查詢
2. 執行 grep 搜尋
3. 生成新文章並觀察日誌

**預期結果**:

```
📋 Agent Models Configuration {
  research_model: 'deepseek-reasoner',
  strategy_model: 'deepseek-chat',
  writing_model: 'deepseek-chat',
  meta_model: 'deepseek-chat',  // ← 應該是這個
  image_model: 'gpt-image-1-mini'
}
```

**如果仍是 gpt-3.5-turbo**:

- 檢查 agent_configs 表
- 更新資料庫配置

### 測試 4: 完整流程驗證

**步驟**:

1. 生成新文章（關鍵字：「完整測試文章」）
2. 觀察完整流程日誌（約 10 分鐘）
3. 檢查文章列表頁面
4. 點擊文章查看預覽
5. 使用 Chrome DevTools 檢查

**預期結果**:

- ✅ 文章成功生成
- ✅ 左側列表只顯示：「完整測試文章」（無關鍵字前綴）
- ✅ 右側預覽顯示完整 HTML
- ✅ 圖片正確顯示（R2 URL 或 OpenAI URL）
- ✅ FAQ Schema 在 HTML 末尾
- ✅ 內部連結和外部引用正確插入
- ✅ Console 無錯誤

---

## 📊 預期成果

### 修復後的系統狀態

**文章生成流程**:

```
ResearchAgent (deepseek-reasoner)
↓
StrategyAgent (deepseek-chat)
↓
WritingAgent (deepseek-chat) + ImageAgent (gpt-image-1-mini) [並行]
↓
MetaAgent (deepseek-chat) ✅ 修復
↓
HTMLAgent ✅ 完全重構，防禦性錯誤處理
↓
CategoryAgent (deepseek-chat)
↓
WordPress Publish (可選)
↓
ArticleStorageService ✅ 正確儲存 html_content
```

**用戶體驗**:

- ✅ 文章 100% 成功生成
- ✅ 預覽功能正常
- ✅ 文章列表顯示清晰
- ✅ 圖片優化並儲存（R2 或 fallback）
- ✅ SEO 優化完整（FAQ Schema, Meta Tags）

**成本優化**:

- 💰 所有文字生成使用 DeepSeek（成本降低 ~80%）
- 💰 圖片使用 gpt-image-1-mini（成本降低 ~50%）

**技術改進**:

- 🛡️ 防禦性錯誤處理（不會因單一錯誤中斷整個流程）
- 📊 增強診斷日誌（更容易追蹤問題）
- 🌐 多語言 FAQ 支援（更靈活）

---

## ⚡ 執行順序

### 第一階段: 立即執行（30 分鐘）

1. **HTMLAgent 完整重構**（15 分鐘）
   - ✅ 修改 `process` 方法
   - ✅ 重構 `insertFAQSchema` 方法
   - ✅ 增強錯誤處理
   - ✅ 執行 `npm run build` 驗證

2. **文章列表顯示修復**（5 分鐘）
   - ✅ 修改 `page.tsx`
   - ✅ 驗證修改

3. **增強診斷日誌**（10 分鐘）
   - ✅ ImageAgent R2 診斷
   - ✅ R2Client 驗證
   - ✅ Orchestrator 模型配置日誌

### 第二階段: 診斷分析（15 分鐘）

4. **檢查資料庫模型配置**（5 分鐘）
   - 🔍 執行 SQL 查詢
   - 🔍 確認 meta_model 值

5. **檢查 R2 環境變數**（5 分鐘）
   - 🔍 登入 Vercel Dashboard
   - 🔍 檢查所有 R2 相關變數

6. **搜尋硬編碼模型**（5 分鐘）
   - 🔍 grep 搜尋 gpt-3.5-turbo
   - 🔍 確認沒有硬編碼

### 第三階段: 根據診斷修復（15 分鐘）

7. **修復 MetaAgent 模型配置**（10 分鐘）
   - 🔧 更新資料庫（如需要）
   - 🔧 移除硬編碼（如有）
   - 🔧 驗證配置邏輯

8. **修復 R2 上傳**（5 分鐘）
   - 🔧 設定環境變數（如缺失）
   - 🔧 修復 credentials 格式（如有問題）

### 第四階段: 完整測試（15 分鐘）

9. **生成測試文章**（10 分鐘）
   - 🧪 提交文章生成請求
   - 🧪 觀察完整流程日誌

10. **驗證所有功能**（3 分鐘）
    - 🧪 檢查文章列表
    - 🧪 確認預覽功能
    - 🧪 驗證圖片顯示

11. **Chrome DevTools 檢查**（2 分鐘）
    - 🧪 開啟 Console
    - 🧪 確認無錯誤
    - 🧪 檢查 Network 請求

---

## 📝 檢查清單

### 修復前檢查

- [ ] 閱讀完整計劃
- [ ] 確認問題理解正確
- [ ] 準備好測試環境

### 執行中檢查

- [ ] HTMLAgent 修改完成
- [ ] 文章列表修改完成
- [ ] 診斷日誌添加完成
- [ ] 資料庫配置檢查完成
- [ ] 環境變數檢查完成
- [ ] 硬編碼搜尋完成

### 測試檢查

- [ ] HTMLAgent 不再報錯
- [ ] 文章成功生成並儲存
- [ ] 預覽功能正常
- [ ] 文章列表顯示正確
- [ ] 模型配置正確
- [ ] R2 上傳診斷清楚
- [ ] 無前端錯誤

### 部署檢查

- [ ] 本地測試通過
- [ ] 執行 `npm run build` 成功
- [ ] 執行 `npm run typecheck` 成功
- [ ] Git commit
- [ ] Git push
- [ ] Vercel 部署成功
- [ ] 生產環境測試通過

---

## 🚨 風險評估

### 低風險

- ✅ 文章列表顯示修改（純 UI 改動）
- ✅ 增強診斷日誌（只增加日誌輸出）

### 中風險

- ⚠️ HTMLAgent 重構（涉及核心邏輯，但有完整的 try-catch 保護）
- ⚠️ 模型配置修改（可能影響成本和性能）

### 緩解措施

- 🛡️ 所有修改都有錯誤處理，不會導致系統崩潰
- 🛡️ 保留原始 HTML 作為 fallback
- 🛡️ 詳細的診斷日誌幫助快速定位問題
- 🛡️ 可以隨時回滾 Git commit

---

## 📚 參考資料

### LinkedOM

- GitHub Issue #106: DOMParser.parseFromString 不自動包裝 HTML
- GitHub Issue #147: documentElement.outerHTML 只返回 head
- 文檔: https://github.com/WebReflection/linkedom

### Cloudflare R2

- S3 API 兼容性文檔
- Authorization header 格式要求
- Community 討論: "Invalid character in header content"

### 代碼分析

- `src/lib/agents/html-agent.ts`: HTMLAgent 實現
- `src/lib/agents/writing-agent.ts`: WritingAgent 輸出格式
- `src/lib/agents/image-agent.ts`: R2 上傳邏輯
- `src/lib/agents/meta-agent.ts`: MetaAgent 配置
- `src/lib/agents/orchestrator.ts`: 整體流程編排
- `src/lib/services/article-storage.ts`: 文章儲存服務

---

**總計預估時間**: 約 75 分鐘

**預期成功率**: 95%+

**完成標準**:

1. 文章成功生成並儲存
2. 預覽功能正常顯示
3. 所有 Agent 使用正確模型
4. R2 上傳問題已診斷（修復或有清晰的解決路徑）
5. 無阻塞性錯誤

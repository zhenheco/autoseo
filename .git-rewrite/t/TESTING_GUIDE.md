# 文章生成系統測試指南

## 系統狀態檢查 ✅

### 環境

- ✅ 開發服務器: 運行中 (http://localhost:3168)
- ✅ 資料庫連接: 正常
- ✅ 測試環境: 已清理（0 個任務，0 篇文章）

### 已完成的修復

1. ✅ Multi-Agent Output Adapter - 格式轉換
2. ✅ 錯誤追蹤系統 - 資料庫持久化
3. ✅ 輸入驗證 - ArticleStorageService
4. ✅ 圖片數量自動計算
5. ✅ 狀態管理改進
6. ✅ 監控 API 和 GitHub Actions

---

## 前端功能測試（需手動執行）

### 1. 開啟 Chrome DevTools

```bash
# 1. 打開瀏覽器
open http://localhost:3168

# 2. 按 F12 或 Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows) 開啟 DevTools
# 3. 切換到 Console 標籤
```

### 2. 檢查 Console 錯誤

**預期結果**：

- ✅ 沒有紅色錯誤訊息
- ✅ 可能有少量警告（黃色）是正常的
- ✅ 應該看到應用初始化訊息

**如果有錯誤**：

- 記錄錯誤訊息和堆疊追蹤
- 檢查 Network 標籤是否有失敗的請求
- 檢查 Sources 標籤找到錯誤所在檔案

### 3. 檢查網路請求

```
DevTools > Network 標籤

1. 刷新頁面 (Cmd+R / Ctrl+R)
2. 觀察所有請求的狀態
```

**預期結果**：

- ✅ 所有請求狀態碼為 200 或 304
- ✅ API 請求 (/api/\*) 正常回應
- ✅ 靜態資源 (CSS, JS) 正常載入

---

## Multi-Agent 文章生成測試

### 測試步驟

#### 1. 準備測試資料

需要確保資料庫中有：

- ✅ 至少一個 company
- ✅ 至少一個 website
- ✅ website 有完整的 workflow_settings 配置
- ✅ 環境變數中有 API keys (OpenAI, DeepSeek 等)

#### 2. 觸發文章生成

有兩種方式：

**方式 A：通過 UI**

```
1. 登入系統
2. 進入 "文章生成" 頁面
3. 選擇關鍵字
4. 點擊 "生成文章"
5. 觀察進度
```

**方式 B：通過 API**

```bash
# 創建測試任務
curl -X POST http://localhost:3168/api/articles/generate \
  -H "Content-Type: application/json" \
  -d '{
    "websiteId": "YOUR_WEBSITE_ID",
    "title": "測試文章標題",
    "keywordId": "YOUR_KEYWORD_ID"
  }'
```

#### 3. 監控執行過程

**使用 Chrome DevTools**：

```
Console 標籤：
- 查看即時日誌
- 檢查是否有錯誤

Network 標籤：
- 監控 API 請求
- 檢查 WebSocket 連接（如果有）
- 查看請求/回應時間
```

**使用資料庫查詢**：

```bash
# 在另一個終端執行
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

setInterval(async () => {
  const { data } = await supabase
    .from('article_jobs')
    .select('id, title, status, metadata')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data) {
    console.clear();
    console.log('📊 最新任務狀態');
    console.log('狀態:', data.status);
    console.log('標題:', data.title);
    if (data.metadata?.current_phase) {
      console.log('階段:', data.metadata.current_phase);
    }
    if (data.metadata?.errors) {
      console.log('錯誤:', data.metadata.errors.length);
    }
  }
}, 2000);
"
```

#### 4. 驗證 Multi-Agent 協作

**預期的執行階段**（按順序）：

1. **Research Phase** (研究階段)
   - ✅ 狀態：`metadata.current_phase = 'research'`
   - ✅ 耗時：約 30-60 秒
   - ✅ 輸出：研究資料和背景資訊

2. **Strategy Phase** (策略階段)
   - ✅ 狀態：`metadata.current_phase = 'strategy'`
   - ✅ 耗時：約 20-40 秒
   - ✅ 輸出：文章大綱和關鍵字策略

3. **Image Generation** (圖片生成)
   - ✅ 狀態：`metadata.current_phase = 'image'`
   - ✅ 耗時：約 10-30 秒 × 圖片數量
   - ✅ 輸出：1 個特色圖片 + N 個內容圖片（N = H2 數量）

4. **Content Assembly** (內容組合)
   - ✅ 狀態：`metadata.current_phase = 'assembly'`
   - ✅ 耗時：約 60-120 秒
   - ✅ 輸出：完整的 Markdown 和 HTML 內容

5. **Output Adaptation** (格式轉換)
   - ✅ 狀態：轉換中
   - ✅ 耗時：< 20ms
   - ✅ 輸出：WritingAgent 格式

6. **Storage** (儲存)
   - ✅ 狀態：`status = 'completed'`
   - ✅ 耗時：< 500ms
   - ✅ 輸出：記錄寫入 `generated_articles` 表

#### 5. 驗證結果

**檢查資料庫**：

```bash
npx tsx -e "
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  // 檢查任務
  const { data: job } = await supabase
    .from('article_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('\n📋 任務狀態:');
  console.log('狀態:', job.status);
  console.log('標題:', job.title);

  if (job.status === 'completed') {
    // 檢查文章
    const { data: article } = await supabase
      .from('generated_articles')
      .select('*')
      .eq('article_job_id', job.id)
      .single();

    if (article) {
      console.log('\n✅ 文章已成功儲存');
      console.log('文章 ID:', article.id);
      console.log('字數:', article.content?.statistics?.totalWords || 0);

      // 檢查格式
      const hasMarkdown = !!article.content?.markdown;
      const hasHTML = !!article.content?.html;
      const hasReadability = !!article.content?.readability;
      const hasKeywordUsage = !!article.content?.keywordUsage;

      console.log('\n📊 格式驗證:');
      console.log('Markdown:', hasMarkdown ? '✅' : '❌');
      console.log('HTML:', hasHTML ? '✅' : '❌');
      console.log('Readability:', hasReadability ? '✅' : '❌');
      console.log('Keyword Usage:', hasKeywordUsage ? '✅' : '❌');

      // 檢查圖片
      if (article.content?.images) {
        const images = article.content.images;
        console.log('\n🖼️  圖片:');
        console.log('特色圖片:', images.featured ? '✅' : '❌');
        console.log('內容圖片:', images.content?.length || 0);
      }
    } else {
      console.log('\n❌ 文章未儲存到 generated_articles');
    }
  } else if (job.status === 'failed') {
    console.log('\n❌ 任務失敗');
    console.log('錯誤:', job.error_message);
    if (job.metadata?.errors) {
      console.log('錯誤記錄:', job.metadata.errors);
    }
  }
}

verify().catch(console.error);
"
```

---

## 錯誤檢查清單

### Console 錯誤 (Chrome DevTools)

**常見錯誤類型**：

1. **TypeError / ReferenceError**
   - 變數未定義
   - 屬性不存在
   - 類型不匹配

2. **Network Errors**
   - API 請求失敗
   - CORS 問題
   - 超時

3. **React Errors**
   - Hooks 規則違反
   - 無效的 JSX
   - 狀態更新問題

**如何調查**：

```
1. 點擊錯誤訊息旁的檔案連結
2. 在 Sources 標籤設置斷點
3. 重現問題
4. 檢查變數值和執行流程
```

### Network 錯誤

**檢查項目**：

1. **狀態碼**
   - 200: 成功
   - 401/403: 認證問題
   - 404: 路徑錯誤
   - 500: 服務器錯誤

2. **請求時間**
   - 應該 < 5 秒（一般 API）
   - 文章生成可能 2-5 分鐘

3. **Payload**
   - 檢查請求資料格式
   - 驗證必要欄位

### React DevTools

```bash
# 安裝 React DevTools (如果還沒有)
# Chrome Web Store: React Developer Tools

在 DevTools > Components 標籤：
- 檢查組件樹
- 查看 props 和 state
- 追蹤 re-renders
```

---

## 效能測試

### 1. Lighthouse 測試

```
DevTools > Lighthouse 標籤

1. 選擇 "Performance" 和 "Best Practices"
2. 點擊 "Analyze page load"
3. 檢查分數和建議
```

**目標分數**：

- Performance: > 80
- Accessibility: > 90
- Best Practices: > 90

### 2. Performance Profiling

```
DevTools > Performance 標籤

1. 點擊 Record (圓點)
2. 執行文章生成操作
3. 停止 Recording
4. 分析 Flame Chart
```

**檢查項目**：

- Long Tasks (> 50ms)
- JavaScript 執行時間
- Layout Shifts
- Paint 時間

---

## 自動化測試建議

### 單元測試

```bash
# 執行所有測試
npm test

# 執行特定測試
npm test output-adapter.test.ts

# 產生覆蓋率報告
npm run test:coverage
```

### E2E 測試 (Playwright)

如果專案有設定 Playwright：

```bash
# 執行 E2E 測試
npx playwright test

# 產生測試報告
npx playwright show-report
```

---

## 問題排查指南

### 問題：文章生成卡住

**檢查步驟**：

1. 查看 Console 是否有錯誤
2. 檢查 Network 標籤的請求狀態
3. 查詢資料庫的 article_jobs：
   ```bash
   npx tsx scripts/check-stuck-jobs.ts
   ```
4. 檢查 metadata.current_phase
5. 查看 metadata.errors

**可能原因**：

- API key 無效或過期
- 網路連接問題
- Agent 執行超時
- 資料庫寫入失敗

### 問題：文章儲存失敗

**檢查步驟**：

1. 確認 job.status === 'completed'
2. 確認 job.result 有資料
3. 檢查 ArticleStorageService 驗證邏輯
4. 查看錯誤日誌

**可能原因**：

- 輸出格式不符合預期
- 缺少必要欄位
- 資料庫連接問題

### 問題：圖片生成失敗

**檢查步驟**：

1. 驗證 OPENAI_API_KEY
2. 檢查圖片生成 API 配額
3. 查看錯誤訊息

**可能原因**：

- API key 無效
- 配額用盡
- 提示詞違反政策

---

## 成功標準

### ✅ 系統正常運作

- [ ] 應用程式可以訪問（http://localhost:3168）
- [ ] Console 無紅色錯誤
- [ ] 所有 API 請求成功（狀態碼 200）
- [ ] 資料庫連接正常

### ✅ Multi-Agent 協作正常

- [ ] 所有階段按順序執行
- [ ] 每個階段都有輸出
- [ ] 錯誤被正確追蹤
- [ ] 狀態正確更新

### ✅ 文章儲存成功

- [ ] job.status === 'completed'
- [ ] generated_articles 有新記錄
- [ ] 文章包含所有必要欄位
- [ ] 圖片數量正確（1 + H2 數量）

### ✅ 格式轉換正確

- [ ] markdown 格式正確
- [ ] HTML 格式正確
- [ ] readability 指標存在
- [ ] keywordUsage 資料完整
- [ ] internalLinks 正確擷取

---

## 報告問題

如果發現問題，請提供：

1. **環境資訊**
   - 作業系統
   - Node.js 版本
   - 瀏覽器版本

2. **錯誤資訊**
   - Console 錯誤訊息
   - 堆疊追蹤
   - 網路請求詳情

3. **重現步驟**
   - 詳細的操作步驟
   - 測試資料

4. **截圖**
   - DevTools Console
   - Network 標籤
   - 錯誤畫面

---

**測試日期**: 2024-11-13
**測試環境**: Development (Local)
**測試人員**: Claude Code AI

# 設計文件：Excel 關鍵字批次匯入

## 架構決策

### 1. 檔案處理策略

**決策**: 在前端解析 Excel 檔案，而非上傳到後端

**理由**:
- 減少伺服器負載和儲存成本
- 提升使用者回饋速度（即時預覽）
- 避免處理檔案上傳的安全問題
- 利用瀏覽器原生能力

**替代方案**:
- ❌ 後端解析：增加伺服器複雜度，需處理檔案儲存
- ❌ 混合模式：過於複雜

### 2. 標題生成流程

**決策**: 批次呼叫 AI API，使用佇列機制

**流程**:
```
1. 使用者上傳 Excel → 前端解析關鍵字
2. 前端發送關鍵字列表到 /api/articles/generate-batch-titles
3. 後端使用現有 TokenBillingService 檢查餘額
4. 使用 Promise.allSettled 並行生成標題（限制並發數）
5. 回傳所有關鍵字的標題列表
6. 前端顯示標題選擇介面
```

**理由**:
- 複用現有的計費邏輯
- 並行處理提升速度
- Promise.allSettled 確保部分失敗不影響整體
- 限制並發避免 API rate limit

### 3. 資料流設計

```typescript
// 前端狀態管理
interface ImportState {
  step: 'upload' | 'preview' | 'titles' | 'confirm';
  keywords: string[];
  titlesMap: Map<string, string[]>;
  selectedTitles: Map<string, string>;
}

// API Request/Response
interface GenerateBatchTitlesRequest {
  keywords: string[];
  titlesPerKeyword?: number; // 預設 5
}

interface GenerateBatchTitlesResponse {
  results: {
    keyword: string;
    titles: string[];
    error?: string;
  }[];
  totalCost: number;
  estimatedArticleCost: number;
}
```

### 4. UI/UX 設計

**步驟式流程**:
1. **上傳步驟**: 拖放或選擇 Excel 檔案
2. **預覽步驟**: 顯示解析的關鍵字列表，允許編輯/刪除
3. **標題生成步驟**: 顯示進度條，逐步生成標題
4. **選擇步驟**: 為每個關鍵字選擇標題
5. **確認步驟**: 顯示總覽和預估成本，批次建立任務

**元件結構**:
```
ImportPage
├─ UploadSection (步驟 1)
├─ KeywordPreview (步驟 2)
│  └─ EditableKeywordList
├─ TitleGeneration (步驟 3)
│  └─ ProgressIndicator
├─ TitleSelection (步驟 4)
│  └─ KeywordTitleTable
└─ ConfirmSection (步驟 5)
   └─ CostEstimator
```

## 技術實作細節

### Excel 解析

```typescript
// 使用 xlsx 套件
import * as XLSX from 'xlsx';

function parseExcel(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      // 取第一欄作為關鍵字
      const keywords = jsonData
        .map(row => row[0])
        .filter(kw => kw && typeof kw === 'string')
        .map(kw => kw.trim())
        .filter(kw => kw.length > 0);

      resolve(keywords);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
```

### 批次標題生成

```typescript
// API 實作
export async function POST(request: NextRequest) {
  const { keywords, titlesPerKeyword = 5 } = await request.json();

  // 1. 驗證使用者和公司
  const { user, companyId } = await authenticateRequest(request);

  // 2. 預估成本並檢查餘額
  const estimatedCost = keywords.length * 200; // 每個關鍵字約 200 tokens
  const balance = await billingService.getCurrentBalance(companyId);
  if (balance.total < estimatedCost) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 402 });
  }

  // 3. 批次生成標題（限制並發）
  const concurrencyLimit = 5;
  const results = await processBatchWithLimit(
    keywords,
    (keyword) => generateTitlesForKeyword(keyword, titlesPerKeyword),
    concurrencyLimit
  );

  // 4. 回傳結果
  return NextResponse.json({ results, totalCost: estimatedCost });
}
```

### 並發控制

```typescript
async function processBatchWithLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.allSettled(
      batch.map(processor)
    );
    results.push(...batchResults.map(r =>
      r.status === 'fulfilled' ? r.value : null
    ));
  }
  return results;
}
```

## 安全考量

1. **檔案驗證**: 檢查檔案類型和大小
2. **輸入清理**: 清理關鍵字中的特殊字元
3. **速率限制**: 限制 API 呼叫頻率
4. **餘額檢查**: 預先檢查 token 餘額

## 效能考量

1. **前端解析**: 使用 Web Worker 避免阻塞 UI
2. **並發控制**: 限制同時進行的 API 呼叫
3. **快取**: 標題生成結果暫存在前端狀態
4. **分頁**: 關鍵字超過 100 個時分頁顯示

## 測試策略

1. **單元測試**: Excel 解析邏輯
2. **整合測試**: API 端點測試
3. **E2E 測試**: 完整流程測試
4. **效能測試**: 大量關鍵字處理測試

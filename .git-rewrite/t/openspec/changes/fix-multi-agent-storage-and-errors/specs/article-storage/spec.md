# Article Storage Specification

文章儲存服務的介面和格式要求規格。

---

## ADDED Requirements

### Requirement: Output Adapter 必須轉換 Multi-Agent 輸出為標準格式

系統 **MUST** 提供 Output Adapter 將 ContentAssembler 輸出轉換為 WritingAgent 標準格式。

**Priority**: High
**Rationale**: 確保多 Agent 架構產生的文章可以正確儲存到資料庫

**Capability**: Multi-Agent 輸出格式轉換

#### Scenario: ContentAssembler 輸出轉換為 WritingAgent 格式

**Given** ContentAssembler 完成內容組合
**And** 輸出包含 `{ markdown, html, statistics }`
**When** OutputAdapter 接收 ContentAssembler 輸出
**Then** 必須產生包含以下欄位的標準格式：

- `markdown`: string - Markdown 內容
- `html`: string - HTML 內容
- `statistics`: 文章統計（字數、段落數等）
- `readability`: 可讀性指標（Flesch Reading Ease 等）
- `keywordUsage`: 關鍵字使用情況（密度、出現次數）
- `internalLinks`: 內部連結列表

**And** 轉換時間 < 20ms
**And** 所有必要欄位都存在且格式正確

#### Scenario: 計算缺失的 readability 指標

**Given** ContentAssembler 輸出不包含 `readability`
**When** OutputAdapter 處理輸出
**Then** 必須計算以下指標：

- `fleschReadingEase`: number (0-100)
- `fleschKincaidGrade`: number
- `gunningFogIndex`: number

**And** 使用與 WritingAgent 相同的演算法
**And** 計算時間 < 10ms

#### Scenario: 分析關鍵字使用情況

**Given** ContentAssembler 輸出不包含 `keywordUsage`
**And** 提供 focus keyword
**When** OutputAdapter 處理輸出
**Then** 必須分析關鍵字：

- `count`: number - 關鍵字出現次數
- `density`: number - 關鍵字密度 (%)
- `positions`: number[] - 關鍵字位置（可選）

**And** 大小寫不敏感匹配
**And** 分析時間 < 5ms

#### Scenario: 擷取內部連結

**Given** ContentAssembler 輸出不包含 `internalLinks`
**When** OutputAdapter 處理 HTML 輸出
**Then** 必須擷取所有 `<a>` 標籤的內部連結
**And** 回傳格式為 `{ url: string, title: string, anchor: string }[]`
**And** 擷取時間 < 5ms

---

### Requirement: ArticleStorageService 必須驗證輸入格式

ArticleStorageService **MUST** 在儲存前驗證所有必要欄位存在且格式正確。

**Priority**: High
**Rationale**: 避免格式不正確的資料寫入資料庫，導致後續錯誤

**Capability**: 輸入格式驗證

#### Scenario: 檢查必要欄位是否存在

**Given** ArticleStorageService 接收 `result` 參數
**When** 呼叫 `saveArticle()`
**Then** 必須驗證以下欄位存在：

- `result.writing` 存在
- `result.meta` 存在
- `result.writing.markdown` 不為空
- `result.writing.html` 不為空
- `result.meta.seo.title` 不為空

**And** 如果任一欄位缺失，拋出描述性錯誤
**And** 錯誤訊息格式：`"Missing required field: {field_name}"`

#### Scenario: 驗證資料類型正確

**Given** ArticleStorageService 接收 `result` 參數
**When** 呼叫 `saveArticle()`
**Then** 必須驗證資料類型：

- `result.writing.statistics.wordCount`: number
- `result.writing.readability.fleschReadingEase`: number (0-100)
- `result.writing.keywordUsage.density`: number (0-100)
- `result.meta.seo.keywords`: string[]

**And** 如果類型錯誤，拋出描述性錯誤
**And** 錯誤訊息格式：`"Invalid type for {field_name}: expected {expected}, got {actual}"`

#### Scenario: 驗證資料範圍合理

**Given** ArticleStorageService 接收 `result` 參數
**When** 呼叫 `saveArticle()`
**Then** 必須驗證資料範圍：

- `wordCount` > 0 and < 100000
- `fleschReadingEase` >= 0 and <= 100
- `density` >= 0 and <= 100

**And** 如果超出範圍，拋出描述性錯誤
**And** 錯誤訊息格式：`"Value out of range for {field_name}: {value} (expected {min}-{max})"`

---

### Requirement: ArticleStorageService 必須記錄儲存錯誤

ArticleStorageService **MUST** 記錄所有儲存錯誤到應用程式日誌，包含錯誤類型和上下文資訊。

**Priority**: Medium
**Rationale**: 便於除錯和監控儲存失敗的原因

**Capability**: 錯誤記錄和追蹤

#### Scenario: 記錄資料庫寫入錯誤

**Given** ArticleStorageService 嘗試寫入資料庫
**When** 資料庫返回錯誤
**Then** 必須記錄以下資訊：

- 錯誤訊息
- 錯誤類型（Unique violation, Foreign key violation 等）
- 嘗試寫入的資料摘要（不包含完整內容）
- 時間戳記

**And** 記錄到應用程式日誌
**And** （可選）記錄到錯誤追蹤服務（Sentry 等）

#### Scenario: 記錄格式驗證錯誤

**Given** ArticleStorageService 驗證輸入格式
**When** 格式驗證失敗
**Then** 必須記錄：

- 缺失或錯誤的欄位名稱
- 期望的格式
- 實際接收到的資料類型
- 呼叫堆疊（可選）

**And** 記錄到應用程式日誌

---

## MODIFIED Requirements

### Requirement: ArticleStorageService.saveArticle() 必須支援 Multi-Agent 輸出

ArticleStorageService.saveArticle() **MUST** 接受經過 OutputAdapter 轉換的標準格式並驗證所有必要欄位。

**Priority**: High
**Rationale**: 擴展儲存服務以支援多 Agent 架構

**Previous Behavior**:

- 只接受 WritingAgent 的輸出格式
- 假設所有必要欄位都存在

**New Behavior**:

- 接受經過 OutputAdapter 轉換的標準格式
- 驗證所有必要欄位存在和正確
- 提供詳細的錯誤訊息

#### Scenario: 成功儲存 Multi-Agent 生成的文章

**Given** OutputAdapter 已轉換 ContentAssembler 輸出
**And** 所有必要欄位存在且格式正確
**When** ArticleStorageService.saveArticle() 被呼叫
**Then** 文章資料必須成功寫入 `generated_articles` 表
**And** 回傳 `{ id, title, slug, created_at }`
**And** 儲存時間 < 500ms

#### Scenario: 格式驗證失敗時拋出錯誤

**Given** OutputAdapter 產生的輸出缺少某個欄位
**When** ArticleStorageService.saveArticle() 被呼叫
**Then** 必須拋出 `ValidationError`
**And** 錯誤訊息明確指出缺失的欄位
**And** **不寫入資料庫**（避免不完整的資料）

---

## Testing Requirements

### Unit Tests

- OutputAdapter.adapt() - 各種輸入格式（正常、缺失欄位、錯誤類型）
- OutputAdapter.calculateReadability() - 各種文章長度和複雜度
- OutputAdapter.analyzeKeywordUsage() - 各種關鍵字和密度
- OutputAdapter.extractInternalLinks() - 各種 HTML 結構
- ArticleStorageService.validateInput() - 各種驗證情境

### Integration Tests

- Multi-Agent 流程 → OutputAdapter → ArticleStorageService
- 驗證資料正確寫入資料庫
- 驗證錯誤正確捕獲和記錄

### Performance Tests

- OutputAdapter 轉換時間 < 20ms（99th percentile）
- ArticleStorageService 儲存時間 < 500ms（99th percentile）

---

## Dependencies

- `marked`: Markdown 解析
- `linkedom`: HTML 解析和操作
- `@supabase/supabase-js`: 資料庫存取
- 現有的 `writing-agent.ts` 輔助函式

---

## Migration Notes

- **向後相容**：不影響現有的 WritingAgent 流程
- **無 Breaking Changes**：新功能是擴展，不是替換
- **部署順序**：先部署 OutputAdapter，再啟用 Multi-Agent 架構

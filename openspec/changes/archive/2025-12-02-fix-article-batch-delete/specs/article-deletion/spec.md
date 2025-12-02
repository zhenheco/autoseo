# Article Deletion Spec

## MODIFIED Requirements

### Requirement: 批次刪除文章功能

系統 MUST 使用 `{ count: 'exact' }` 選項執行 Supabase 刪除操作，以取得實際刪除的記錄數量。`batchDeleteArticles` 函式 MUST 正確刪除所有選中的文章，並回傳準確的刪除數量。

#### Scenario: 成功批次刪除多篇文章

**Given**: 使用者已登入且屬於某公司
**And**: 使用者選擇了 3 篇屬於該公司的文章
**When**: 使用者執行批次刪除
**Then**: `article_jobs` 中對應的 3 筆記錄被刪除
**And**: `generated_articles` 中關聯的記錄透過 CASCADE 被刪除
**And**: 回傳 `{ success: true, deletedCount: 3 }`

#### Scenario: 批次刪除時部分文章不屬於使用者公司

**Given**: 使用者選擇了 3 篇文章，其中 1 篇不屬於使用者公司
**When**: 使用者執行批次刪除
**Then**: 只有屬於使用者公司的 2 筆記錄被刪除
**And**: 回傳 `{ success: true, deletedCount: 2 }`

#### Scenario: 批次刪除時所有文章都不存在或無權限

**Given**: 使用者選擇的文章 ID 都不存在或不屬於使用者公司
**When**: 使用者執行批次刪除
**Then**: 沒有記錄被刪除
**And**: 回傳 `{ success: false, error: "找不到文章或無權刪除" }`

---

### Requirement: 單一刪除文章功能

系統 MUST 使用 `{ count: 'exact' }` 選項執行 Supabase 刪除操作。`deleteArticle` 函式 MUST 正確刪除指定的文章並觸發 CASCADE 刪除關聯記錄。

#### Scenario: 成功刪除單一文章

**Given**: 使用者已登入且屬於某公司
**And**: 指定的文章屬於該公司
**When**: 使用者執行單一刪除
**Then**: `article_jobs` 中對應的記錄被刪除
**And**: `generated_articles` 中關聯的記錄透過 CASCADE 被刪除
**And**: 回傳 `{ success: true }`

#### Scenario: 刪除不存在或無權限的文章

**Given**: 指定的文章不存在或不屬於使用者公司
**When**: 使用者執行單一刪除
**Then**: 沒有記錄被刪除
**And**: 回傳 `{ success: false, error: "找不到文章或無權刪除" }`

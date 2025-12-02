# Proposal: fix-article-batch-delete

## 問題描述

使用者在文章列表中勾選文章並點擊刪除後，文章沒有被刪除。過去也發生過只刪除了 `generated_articles` 內容但沒有刪除 `article_jobs` 列表記錄的情況。

## 問題根因分析

### 1. 批次刪除邏輯問題 (`actions.ts:batchDeleteArticles`)

```typescript
// 目前的邏輯：只刪除 article_jobs
const { error, count } = await supabase
  .from("article_jobs")
  .delete()
  .in("id", articleIds)
  .eq("company_id", membership.company_id);
```

**問題**：

- 資料庫設計使用 `ON DELETE CASCADE`，刪除 `article_jobs` 應該會自動刪除關聯的 `generated_articles`
- 但 `count` 回傳可能為 `null`（Supabase 預設不回傳 count），導致 `count === 0` 判斷錯誤地認為沒有刪除任何記錄

### 2. Count 回傳問題

Supabase 的 `.delete()` 操作預設不回傳 `count`，需要使用 `{ count: 'exact' }` 選項才能取得。

### 3. 前端 router.refresh() 時機問題

在 `ScheduleControlBar.tsx` 中：

```typescript
if (result.success) {
  toast.success(`已刪除 ${result.deletedCount} 篇文章`);
  clearSelection();
  router.refresh();
}
```

`router.refresh()` 只是重新驗證伺服器端資料，但如果快取沒有正確更新，前端可能不會顯示最新狀態。

## 解決方案

### 修復 1：修正 `batchDeleteArticles` 函式

```typescript
export async function batchDeleteArticles(
  articleIds: string[],
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  // ... 權限檢查 ...

  // 使用 { count: 'exact' } 取得實際刪除數量
  const { error, count } = await supabase
    .from("article_jobs")
    .delete({ count: "exact" })
    .in("id", articleIds)
    .eq("company_id", membership.company_id);

  if (error) {
    console.error("Failed to batch delete articles:", error);
    return { success: false, error: error.message };
  }

  // count 為 null 時視為成功（可能是 RLS 問題）
  // count 為 0 時才報錯
  if (count !== null && count === 0) {
    return { success: false, error: "找不到文章或無權刪除" };
  }

  revalidatePath("/dashboard/articles/manage");
  return { success: true, deletedCount: count ?? articleIds.length };
}
```

### 修復 2：修正單一刪除 `deleteArticle` 函式

同樣的問題存在於 `deleteArticle` 函式中。

### 修復 3：驗證 RLS 政策

確認 `article_jobs` 表格的 RLS 政策允許使用者刪除自己公司的記錄。

## 影響範圍

- `src/app/(dashboard)/dashboard/articles/manage/actions.ts`
- 可能需要檢查 Supabase RLS 政策

## 驗證方式

1. 在文章列表勾選多篇文章
2. 點擊刪除按鈕
3. 確認彈出確認對話框
4. 點擊確定刪除
5. 驗證文章從列表消失
6. 驗證資料庫中 `article_jobs` 和 `generated_articles` 記錄都被刪除

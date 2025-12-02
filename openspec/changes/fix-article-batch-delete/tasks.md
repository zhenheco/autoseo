# Tasks: fix-article-batch-delete

## 任務清單

- [x] **T1**: 修正 `batchDeleteArticles` 函式，加入 `{ count: 'exact' }` 選項
- [x] **T2**: 修正 `deleteArticle` 函式，加入 `{ count: 'exact' }` 選項
- [x] **T3**: 改進錯誤處理邏輯，區分「無權限」和「記錄不存在」
- [x] **T4**: 加入詳細日誌記錄，方便除錯
- [x] **T5**: 驗證 RLS 政策是否正確設定（發現並新增 DELETE 政策）
- [x] **T6**: 部署 migration 到 Supabase（已完成）
- [x] **T7**: 建置檢查 (`pnpm run build`)

## 發現的額外問題

**根本原因**：`article_jobs` 表格缺少 DELETE 的 RLS 政策！

已建立 migration：`20251202100000_add_article_jobs_delete_policy.sql`

# Tasks: fix-article-batch-delete

## 任務清單

- [ ] **T1**: 修正 `batchDeleteArticles` 函式，加入 `{ count: 'exact' }` 選項
- [ ] **T2**: 修正 `deleteArticle` 函式，加入 `{ count: 'exact' }` 選項
- [ ] **T3**: 改進錯誤處理邏輯，區分「無權限」和「記錄不存在」
- [ ] **T4**: 加入詳細日誌記錄，方便除錯
- [ ] **T5**: 驗證 RLS 政策是否正確設定
- [ ] **T6**: 本地測試刪除功能
- [ ] **T7**: 建置檢查 (`pnpm run build`)

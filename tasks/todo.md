# 圖片優化與 Log 分析修復（2025-12-04）

## 任務完成 ✅

### 1. 圖片重複問題（已修復）

**現象**：HTML 中有 8 張圖片，但實際只生成 4 張

**根因**：圖片被插入了兩次

1. `SectionAgent` (section-agent.ts) - 在生成 markdown 時插入圖片
2. `orchestrator.ts` 的 `insertImagesToHtml` - 再次將圖片插入到 HTML

**修復**：刪除 `SectionAgent` 的圖片插入邏輯，保留 `insertImagesToHtml`

**理由**：

- `insertImagesToHtml` 有更智能的分配邏輯（H2/H3 位置）
- 單一責任原則：圖片插入只在一個地方處理
- 更簡單 = 更穩定

**修改檔案**：

- `src/lib/agents/section-agent.ts` - 移除圖片插入提示和後處理邏輯
- `src/lib/agents/orchestrator.ts` - 移除不再需要的重複檢查邏輯

### 2. brandVoice 重複傳遞（正常行為）

- 每個 agent 都需要 brandVoice 來維持寫作風格一致
- 日誌中的重複是因為每個 agent 開始時都會記錄輸入參數
- **這不是 token 浪費**，只是日誌輸出

### 3. OutputAdapter Markdown 誤判（非阻塞，暫不修復）

- HTML 被誤判為含有 Markdown 語法
- 不影響最終輸出

---

## Review

### 修改總結

**修改檔案**：
| 檔案 | 變更 |
|------|------|
| `src/lib/agents/section-agent.ts` | 移除圖片插入 prompt 和後處理邏輯 |
| `src/lib/agents/orchestrator.ts` | 移除不再需要的重複檢查 |
| `devlog.md` | 新增修復記錄 |

**Build 測試**：✅ 成功

**預期效果**：

- 圖片數量正確（4 張而不是 8 張）
- 圖片只由 `insertImagesToHtml` 統一插入
- 程式碼更簡潔、更容易維護

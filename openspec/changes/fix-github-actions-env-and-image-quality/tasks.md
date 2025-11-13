# 任務清單

## 階段 1：修復環境變數換行符問題（最高優先）

- [x] 1.1 在 `.github/workflows/process-article-jobs.yml` 新增環境變數清理步驟
  - 在 `Process pending article jobs` 步驟之前添加清理邏輯
  - 使用 shell 命令移除所有換行符
  - 驗證清理後的環境變數格式正確

- [ ] 1.2 測試環境變數驗證步驟
  - 手動觸發 workflow
  - 確認環境變數驗證通過
  - 檢查日誌確認沒有 "包含換行符" 錯誤

- [x] 1.3 更新其他 workflow 檔案（如果有的話）
  - 檢查是否有其他 workflow 也使用相同的環境變數
  - 同步套用相同的修復邏輯

## 階段 2：修正圖片生成 quality 參數

- [x] 2.1 修改 `src/lib/agents/orchestrator.ts`
  - 第 610 行：`quality: 'standard'` 改為 `quality: 'medium'`
  - 檢查是否有其他使用 `'standard'` 的地方

- [x] 2.2 更新 TypeScript 型別定義
  - 檢查 `src/types/agents.ts:250`
  - 將 `quality: 'standard' | 'hd'` 更新為符合 API 的值
  - 可能的值：`'low' | 'medium' | 'high' | 'auto'`
  - 或者建立映射邏輯：`'standard' → 'medium'`, `'hd' → 'high'`

- [x] 2.3 更新 `src/lib/openai/image-client.ts`
  - 檢查 `quality` 參數的處理邏輯
  - 確保與 OpenAI API 文件一致
  - 移除任何對 `'standard'` 的引用

- [ ] 2.4 測試圖片生成功能
  - 執行圖片生成測試腳本
  - 確認可以成功生成圖片
  - 檢查錯誤日誌中不再有 "Invalid value: 'standard'" 錯誤

## 階段 3：增強 StrategyAgent Parser

- [x] 3.1 改進 `tryDirectJSONParse` 方法
  - 增加錯誤處理和日誌
  - 返回更詳細的錯誤資訊

- [x] 3.2 改進 `tryNestedJSONParse` 方法
  - 嘗試多種 JSON 提取模式
  - 處理更多邊界情況

- [x] 3.3 強化 AI prompt
  - 在 `generateOutline` 方法中加強 prompt 指示
  - 明確要求輸出純 JSON，不要包含額外文字
  - 提供更明確的 JSON schema 範例

- [x] 3.4 增加詳細日誌
  - 在每個 parser 中增加成功/失敗日誌
  - 記錄 AI 回應的前 200 字元
  - 幫助診斷未來的問題

- [ ] 3.5 測試 StrategyAgent
  - 執行完整的文章生成測試
  - 檢查日誌中是否還有 Parser 警告
  - 驗證生成的大綱品質

## 階段 4：整體驗證

- [ ] 4.1 執行完整的端到端測試
  - 從前端創建文章任務
  - 觸發 GitHub Actions workflow
  - 驗證文章生成成功（包含圖片）

- [ ] 4.2 檢查所有錯誤日誌
  - 確認沒有環境變數錯誤
  - 確認沒有圖片生成錯誤
  - 確認沒有 StrategyAgent Parser 錯誤

- [x] 4.3 更新文件
  - 記錄修復內容在 CHANGELOG 或 ISSUES_ANALYSIS.md
  - 更新相關技術文件
  - 提交 git commit

## 相依性說明

- 階段 1 和階段 2 可以並行執行
- 階段 3 依賴階段 1 完成（需要環境變數正常運作）
- 階段 4 需要所有前面階段完成

## 預估時間

- 階段 1：30 分鐘
- 階段 2：45 分鐘
- 階段 3：1 小時
- 階段 4：30 分鐘
- **總計**：約 2.5-3 小時

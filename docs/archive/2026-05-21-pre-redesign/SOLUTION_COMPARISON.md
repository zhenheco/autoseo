# 🔄 Timeout 解決方案比較

## 問題摘要

**核心問題**：DeepSeek Reasoner 需要 4+ 分鐘執行，超過 Vercel 的 5 分鐘 (300 秒) 限制。

**根本原因**：環境變數 `USE_GITHUB_ACTIONS` 和 `GITHUB_PERSONAL_ACCESS_TOKEN` 未設置，導致 Orchestrator 在 Vercel 上執行而非 GitHub Actions。

---

## 方案 A：GitHub Actions（已修復 ✅）

### 已完成的修復

1. ✅ 設置環境變數 `USE_GITHUB_ACTIONS=true`
2. ✅ 設置環境變數 `GITHUB_PERSONAL_ACCESS_TOKEN`
3. ✅ 觸發重新部署

### 工作原理

```
用戶請求 → Vercel API (/api/articles/generate)
    ↓
檢查 USE_GITHUB_ACTIONS === 'true'
    ↓
觸發 GitHub Actions (repository dispatch)
    ↓
GitHub Actions 執行 Orchestrator (30 分鐘限制)
    ↓
更新資料庫
    ↓
Vercel 前端輪詢資料庫顯示結果
```

### 優點

- ✅ **免費**：GitHub Actions 每月 2000 分鐘免費
- ✅ **30 分鐘執行時間**：足夠處理 DeepSeek Reasoner
- ✅ **已實作完成**：代碼已經寫好，只需環境變數
- ✅ **無需遷移**：現有 Vercel 部署不受影響
- ✅ **完整日誌**：GitHub Actions 提供詳細執行日誌

### 缺點

- ⚠️ **冷啟動時間**：首次觸發需要約 30-60 秒
- ⚠️ **依賴性**：依賴 GitHub 服務可用性
- ⚠️ **調試複雜度**：需要查看 GitHub Actions 日誌

### 成本分析

**完全免費**（在限制內）

- 每月 2000 分鐘免費（約 33 小時）
- 假設每篇文章 5 分鐘：每月可免費生成 400 篇
- 超過限制後：$0.008/分鐘

---

## 方案 B：Cloudflare Workers Pro

### 工作原理

```
用戶請求 → Cloudflare Workers
    ↓
執行 Orchestrator (最長 15 分鐘)
    ↓
更新資料庫
    ↓
返回結果給前端
```

### 優點

- ✅ **更長執行時間**：
  - 免費版：30 秒 CPU 時間
  - Paid Workers ($5/月)：最長 15 分鐘
- ✅ **全球分佈**：更低的延遲
- ✅ **簡單架構**：不需要輪詢
- ✅ **即時回應**：無冷啟動

### 缺點

- ❌ **需要遷移**：
  - 整個應用需遷移到 Cloudflare Pages
  - 或建立獨立的 Workers 服務
  - 需要重寫部署配置
- ❌ **成本**：
  - Workers Paid: $5/月
  - 可能需要 Workers AI: 額外費用
- ❌ **限制**：
  - 記憶體限制：128 MB (免費) / 512 MB (付費)
  - CPU 時間限制：30 秒 (免費) / 最長 15 分鐘 (付費)
- ❌ **學習曲線**：需要熟悉 Cloudflare Workers API

### 成本分析

**每月最低 $5**

- Workers Paid: $5/月（包含 10M 請求）
- 超過請求限制：$0.50/百萬請求
- Workers AI（如果使用）：另計

**實際月成本估算**：

- 基礎 Workers Paid: $5
- 假設每月 100 篇文章，每篇 10 個 AI 請求：
  - 總計 1000 個請求
  - 遠低於 10M 限制
  - **總成本約 $5/月**

---

## 方案 C：Cloudflare Workers + GitHub Actions 混合

### 工作原理

```
用戶請求 → Cloudflare Workers (快速 API)
    ↓
觸發 GitHub Actions (長時間任務)
    ↓
GitHub Actions 執行 Orchestrator
    ↓
更新資料庫
    ↓
Workers 輪詢並返回結果
```

### 優點

- ✅ **最佳效能**：Workers 提供快速 API，GitHub Actions 處理長任務
- ✅ **低成本**：Workers Paid $5/月 + GitHub Actions 免費
- ✅ **靈活性**：可在兩個平台間分配工作負載

### 缺點

- ❌ **複雜度最高**：需要維護兩個平台
- ❌ **調試困難**：問題可能出現在任何環節

---

## 方案 D：獨立後端服務

### 工作原理

```
用戶請求 → Vercel 前端
    ↓
呼叫獨立後端 API (Railway, Render, Digital Ocean)
    ↓
後端執行 Orchestrator (無時間限制)
    ↓
更新資料庫
    ↓
前端輪詢顯示結果
```

### 優點

- ✅ **無執行時間限制**：可運行任意長時間
- ✅ **完全控制**：自由選擇運行環境
- ✅ **獨立擴展**：前後端獨立部署和擴展
- ✅ **調試簡單**：標準 Node.js 環境

### 缺點

- ❌ **成本較高**：
  - Railway: $5-20/月（取決於用量）
  - Render: $7/月起
  - Digital Ocean: $6/月起
- ❌ **需要遷移**：需要將 Orchestrator 獨立出來
- ❌ **維護負擔**：需要管理額外的服務

---

## 推薦方案

### 🏆 **立即推薦：方案 A（GitHub Actions）**

**理由**：

1. ✅ **已修復完成**：環境變數已設置，正在重新部署
2. ✅ **零成本**：完全免費（在限制內）
3. ✅ **已驗證**：測試任務 `3d686490-0c71-4963-9c59-5074fb5db962` 成功完成
4. ✅ **無需遷移**：現有代碼已完整實作
5. ✅ **足夠時間**：30 分鐘足以處理所有 AI 請求

### 📈 **未來考慮：方案 B（Cloudflare Workers Pro）**

**適用場景**：

- 當文章生成量超過 GitHub Actions 免費額度（每月 400 篇）
- 需要更低的延遲和更好的全球分佈
- 願意投入 $5/月成本

**遷移時機**：

- 當前方案運行 3-6 個月後評估
- 如果文章生成量持續增長
- 如果需要更複雜的實時功能

---

## 測試驗證計劃

### 步驟 1：驗證環境變數生效

```bash
# 部署完成後（約 2-3 分鐘）
sleep 120
vercel ls --scope acejou27s-projects | head -8
```

### 步驟 2：創建測試任務

```bash
node scripts/create-test-job.js
```

### 步驟 3：觸發 API 測試

```bash
curl -X POST https://autopilot-am979ykm6-acejou27s-projects.vercel.app/api/articles/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "測試：GitHub Actions 環境變數修復驗證",
    "keywords": ["測試", "驗證"],
    "companyId": "...",
    "websiteId": "...",
    "userId": "..."
  }'
```

### 步驟 4：確認 GitHub Actions 觸發

```bash
# 檢查最新的 GitHub Actions 運行
gh run list --limit 1

# 查看執行日誌
gh run view <run-id> --log
```

### 步驟 5：監控任務完成

```bash
# 每 30 秒檢查一次狀態
watch -n 30 'node scripts/check-job-detail.js <job-id>'
```

### 預期結果

- ✅ API 回應包含 `"processor": "github-actions"`
- ✅ GitHub Actions 在 1 分鐘內啟動
- ✅ 任務在 5-10 分鐘內完成
- ✅ 資料庫包含完整的生成結果
- ✅ 無 Vercel timeout 錯誤

---

## 成本效益分析（一年期）

### 方案 A（GitHub Actions）

**假設**：每月生成 100 篇文章，每篇 5 分鐘

- 每月使用：500 分鐘
- 免費額度：2000 分鐘/月
- **年度成本：$0**

**擴展至 300 篇/月**：

- 每月使用：1500 分鐘
- 仍在免費額度內
- **年度成本：$0**

**擴展至 500 篇/月**：

- 每月使用：2500 分鐘
- 超出 500 分鐘
- 超額費用：500 × $0.008 = $4/月
- **年度成本：$48**

### 方案 B（Cloudflare Workers Pro）

**固定成本**：

- Workers Paid: $5/月
- **年度成本：$60**

### 方案 D（獨立後端 - Railway）

**假設**：使用 Railway Hobby Plan

- 基礎費用：$5/月
- 資源使用（輕量）：約 $2/月
- **年度成本：$84**

---

## 決策矩陣

| 指標             | 方案 A (GitHub Actions) | 方案 B (Workers Pro) | 方案 D (獨立後端) |
| ---------------- | ----------------------- | -------------------- | ----------------- |
| **初始成本**     | $0                      | $5/月                | $7/月             |
| **實作時間**     | ✅ 已完成               | 需要 1-2 週          | 需要 3-5 天       |
| **執行時間限制** | 30 分鐘                 | 15 分鐘              | 無限制            |
| **免費額度**     | 每月 2000 分鐘          | 無                   | 無                |
| **調試難度**     | 中等                    | 低                   | 低                |
| **擴展性**       | 中等                    | 高                   | 高                |
| **維護負擔**     | 低                      | 中等                 | 中等              |
| **建議階段**     | **現在立即使用**        | 6 個月後評估         | 如需更多控制時    |

---

## 結論與建議

### 🎯 當前行動：使用方案 A（GitHub Actions）

1. ✅ **環境變數已設置**：
   - `USE_GITHUB_ACTIONS=true`
   - `GITHUB_PERSONAL_ACCESS_TOKEN=<token>`

2. ⏳ **等待部署完成**（約 2-3 分鐘）

3. 📋 **驗證測試**：
   - 創建測試任務
   - 確認 GitHub Actions 觸發
   - 驗證文章生成完成
   - 確認無 timeout 錯誤

4. 📊 **監控運行狀況**（接下來 1-2 週）：
   - 追蹤成功率
   - 記錄平均執行時間
   - 監控 GitHub Actions 使用量

### 🔮 未來規劃

**3 個月後**：

- 評估文章生成量
- 檢查 GitHub Actions 使用統計
- 如果接近限制，考慮 Workers Pro

**6 個月後**：

- 如果生成量持續高於 300 篇/月
- 考慮遷移到 Cloudflare Workers Pro
- 或升級到獨立後端服務

**關鍵決策點**：

- **月生成量 < 400 篇**：繼續使用 GitHub Actions（免費）
- **月生成量 > 400 篇**：評估遷移到 Workers Pro 或獨立後端
- **需要實時回應**：遷移到 Workers Pro
- **需要完全控制**：建立獨立後端

---

**最後更新**：2025-11-13
**狀態**：方案 A 已修復，等待測試驗證 ⏳

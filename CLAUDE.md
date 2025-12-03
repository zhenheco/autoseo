<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

---

# ⛔ 禁止事項

- **不要啟用開發伺服器**（`pnpm dev`、`npm run dev` 等）

---

# 📝 文章生成架構（重要！）

**Vercel 有 300 秒超時限制，所以正確的架構是：**

## 架構流程

```
用戶點擊「生成文章」
       ↓
Vercel API (/api/articles/generate)
  └── 只創建 job（status: pending），立即返回
       ↓
GitHub Actions (process-article-jobs.yml)
  └── 每 2 分鐘執行一次
  └── 使用 scripts/process-jobs.ts 處理
  └── 無時間限制（timeout-minutes: 60）
       ↓
文章生成完成，更新資料庫
```

## 關鍵檔案

| 檔案                                         | 用途                                 |
| -------------------------------------------- | ------------------------------------ |
| `.github/workflows/process-article-jobs.yml` | GitHub Actions 定時任務（每 2 分鐘） |
| `scripts/process-jobs.ts`                    | 實際處理文章生成的腳本               |
| `/src/app/api/articles/generate/route.ts`    | 創建 job（**只創建，不處理**）       |
| `/src/lib/agents/orchestrator.ts`            | 文章生成編排器                       |

## ⚠️ 絕對禁止

**絕對不要在 Vercel API 中直接執行 `orchestrator.execute()`！**

這會導致：

1. Vercel 300 秒超時
2. 文章生成中斷
3. 用戶體驗極差

## 重試機制

`scripts/process-jobs.ts` 會自動重試卡住的任務：

- 查詢條件：`started_at.is.null` 或 `started_at.lt.${3分鐘前}`
- 如果任務執行超過 3 分鐘無更新，會被重新處理

---

# 🔑 AI API 配置說明

## Cloudflare AI Gateway（本專案使用）

本專案所有 AI API 呼叫都透過 **Cloudflare AI Gateway** 代理，不直接使用各家 API Key。

### 環境變數配置

```bash
# AI Gateway 設定（必須）
CF_AI_GATEWAY_ENABLED=true
CF_AI_GATEWAY_ACCOUNT_ID=<你的 Cloudflare Account ID>
CF_AI_GATEWAY_ID=<你的 Gateway ID>
CF_AI_GATEWAY_TOKEN=<你的 Gateway Token>

# 各 AI 服務的 API Key（透過 Gateway 代理）
DEEPSEEK_API_KEY=<DeepSeek API Key>
OPENAI_API_KEY=<OpenAI API Key>
PERPLEXITY_API_KEY=<Perplexity API Key>
GEMINI_API_KEY=<Google Gemini API Key>
```

### Gemini Imagen 圖片生成

**重要**：Gemini Imagen 模型名稱可能會更新，如果遇到 404 錯誤：

```
models/imagen-3.0-generate-001 is not found for API version v1beta
```

需要檢查 Google 官方文檔確認最新的模型名稱：

- 官方文檔：https://ai.google.dev/gemini-api/docs/imagen
- 模型列表：https://ai.google.dev/gemini-api/docs/models

**修改位置**：`src/lib/ai/ai-client.ts` 的 `callGeminiImagenAPI` 函式

### Gateway 未啟用排查

如果日誌顯示 `gateway: false`，檢查：

1. `CF_AI_GATEWAY_ENABLED` 是否設為 `"true"`（字串）
2. `CF_AI_GATEWAY_ACCOUNT_ID` 是否正確設定
3. `CF_AI_GATEWAY_ID` 是否正確設定

### Vercel 與 GitHub Actions 環境變數同步

確保以下位置的環境變數一致：

1. **Vercel Dashboard** → Settings → Environment Variables
2. **GitHub Secrets** → Repository Settings → Secrets and variables → Actions

### Header 模式（2024-12 更新）

**重要**：本專案使用**雙 Header 模式**，同時傳送 provider API Key 和 Gateway Token。

**正確的 Headers**：

```typescript
headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${PROVIDER_API_KEY}`, // Provider API Key（總是傳）
  "cf-aig-authorization": `Bearer ${CF_AIG_TOKEN}`, // Gateway Token（Gateway 模式時傳）
};
```

**注意**：

- 雖然 Cloudflare BYOK 文檔建議只傳 `cf-aig-authorization`，但實測發現**需要同時傳送兩個 header** 才能正常運作
- 這可能是 Cloudflare AI Gateway 的特定行為或設定需求
- 如果遇到 Error 2005，請確認兩個 header 都有正確傳送

---

# 🚀 部署前檢查清單（Pre-Deployment Checklist）

**❗ 重要：每次提交前必須執行以下檢查，避免 Vercel 部署失敗**

## 1. 本地建置測試

```bash
pnpm run build
```

### 常見建置錯誤和解決方案

#### ❌ TypeScript 類型錯誤

- **錯誤**: `Property 'xxx' does not exist on type 'YYY'`
- **解決**:
  - 檢查 `src/types/database.types.ts` 確認欄位是否存在
  - 為 interface 加上缺少的欄位定義
  - 使用類型轉換時要小心（如 `Json` 類型需要轉換為具體類型）

#### ❌ Import 錯誤

- **錯誤**: `'@/lib/xxx' has no exported member named 'yyy'`
- **解決**:
  - 檢查實際的 export 名稱
  - 確認檔案路徑正確
  - 常見錯誤：`createServerClient` 應為 `createClient`

#### ❌ React Hooks 規則錯誤

- **錯誤**: `Calling setState synchronously within an effect`
- **解決**:
  - useEffect 中的 setState 要包在 `setTimeout(() => {...}, 0)` 中
  - 避免在 useEffect 中同步調用 setState

#### ❌ 缺少必要檔案

- **錯誤**: `Cannot find module '@/components/xxx'`
- **解決**:
  - 確認新創建的檔案已經 git add
  - 檢查檔案路徑和命名是否正確

## 2. 類型檢查

```bash
pnpm run typecheck
# 或
pnpm exec tsc --noEmit
```

## 3. Lint 檢查（可選）

```bash
pnpm run lint
```

## 4. 提交前最後檢查

- [ ] ✅ `pnpm run build` 成功完成
- [ ] ✅ 沒有 TypeScript 錯誤
- [ ] ✅ 沒有使用 `any` 類型
- [ ] ✅ 所有新檔案都已 `git add`
- [ ] ✅ import 路徑正確
- [ ] ✅ React Hooks 使用正確（不在 useEffect 中同步 setState）
- [ ] ✅ 資料庫欄位存在（檢查 database.types.ts）
- [ ] ✅ 使用 `next/image` 而非 `<img>`

## 5. 提交格式

```bash
git add -A
git commit -m "類型: 簡短描述

詳細說明修改內容

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

## 6. 部署後驗證

```bash
# 等待 90 秒讓 Vercel 建置完成
sleep 90 && vercel ls --scope acejou27s-projects | head -8

# 檢查最新部署狀態應為 "● Ready"
```

---

# 🔧 常見問題快速修復

## 問題 1: 建置失敗但本地正常

**原因**: 本地 `node_modules` 可能有快取
**解決**:

```bash
rm -rf node_modules .next
pnpm install
pnpm run build
```

## 問題 2: 類型定義不同步

**原因**: database.types.ts 與實際資料庫 schema 不一致
**解決**:

```bash
pnpm exec supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
```

## 問題 3: Vercel 環境變數缺失

**檢查**: Vercel Dashboard → Settings → Environment Variables
**必要變數**:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

# 🚨 資料庫操作安全規範

**⚠️ 重要：此章節根據 2025-11-16 文章資料意外刪除事件制定**

## 絕對禁止的操作（除非用戶明確要求且確認）

### 1. **禁止執行任何 DELETE/TRUNCATE/DROP 語句**

```bash
# ❌ 絕對禁止（除非用戶明確要求）
psql "$SUPABASE_DB_URL" -c "DELETE FROM generated_articles;"
psql "$SUPABASE_DB_URL" -c "TRUNCATE TABLE article_jobs;"
psql "$SUPABASE_DB_URL" -c "DROP TABLE token_usage_logs;"

# ✅ 安全：診斷只能使用只讀查詢
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM generated_articles;"
psql "$SUPABASE_DB_URL" -c "SELECT * FROM article_jobs LIMIT 10;"
```

**原則**：

- 診斷和調查**只能使用 SELECT 查詢**
- 任何破壞性操作必須：
  1. 先向用戶展示要執行的 SQL 語句
  2. 獲得用戶明確確認
  3. 記錄在 ISSUELOG.md 中

### 2. **禁止執行 scripts/ 目錄下的 SQL 腳本**

```bash
# ❌ 禁止直接執行腳本
psql "$SUPABASE_DB_URL" < scripts/reset-ace-to-free.sql

# ✅ 正確流程
# 1. 先讀取腳本內容
cat scripts/some-script.sql

# 2. 向用戶展示內容並詢問：
#    "這個腳本包含以下操作：[列出 DELETE/INSERT/UPDATE 語句]
#     是否確定要執行？"

# 3. 只有在用戶明確同意後才執行
```

**原則**：

- `scripts/` 目錄的 SQL 腳本可能包含重置/刪除邏輯
- 執行前必須：
  1. 使用 Read 工具檢查腳本內容
  2. 向用戶展示所有 DML 語句（DELETE/INSERT/UPDATE）
  3. 獲得明確同意

### 3. **診斷操作必須只讀**

**允許的只讀命令**：

```sql
SELECT
SHOW
DESCRIBE
EXPLAIN
COUNT
```

**禁止的寫入命令**：

```sql
INSERT
UPDATE
DELETE
TRUNCATE
DROP
ALTER
CREATE
```

## 操作記錄要求

**所有資料庫操作都必須記錄在 ISSUELOG.md**

記錄格式：

```markdown
## [時間] 資料庫操作

**操作類型**: SELECT/INSERT/UPDATE/DELETE
**影響表格**: table_name
**命令**:
\`\`\`sql
具體的 SQL 語句
\`\`\`
**影響行數**: N 行
**執行者**: Claude Code / User
**結果**: 成功/失敗（錯誤訊息）
```

## 懷疑資料遺失時的正確調查步驟

### ❌ 錯誤做法

不要立即假設是「連接錯誤」或「Cloudflare 問題」：

```
診斷報告說：資料庫為空
錯誤結論：一定是 Cloudflare 500 錯誤導致連接失敗
```

**問題**：連接錯誤不會導致資料消失，只會導致查詢失敗。

### ✅ 正確做法

**步驟 1：確認資料庫本身**

```bash
# 使用 psql 直連資料庫（繞過所有中間層）
source .env.local
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM generated_articles;"

# 如果返回 0，資料確實被刪除了
# 如果返回 N > 0，是查詢邏輯或權限問題
```

**步驟 2：檢查最近的操作歷史**

```bash
# 檢查 Git 歷史（代碼變更）
git log --oneline --since="24 hours ago"
git diff HEAD~5 HEAD -- src/lib/supabase/

# 檢查 ISSUELOG.md（操作記錄）
cat ISSUELOG.md | tail -50
```

**步驟 3：諮詢用戶**

- 確認用戶最後一次看到資料的時間
- 詢問是否執行過任何腳本或資料庫操作
- 確認環境變數（`.env.local`）是否變更

**步驟 4：檢查是否有破壞性操作**

```bash
# 搜尋最近的 SQL 檔案
find . -name "*.sql" -mtime -1

# 檢查是否包含 DELETE/TRUNCATE
grep -r "DELETE FROM\|TRUNCATE" scripts/ supabase/
```

## 備份與恢復

### 每日自動備份（建議實施）

```bash
# scripts/backup-database.sh
#!/bin/bash
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

source .env.local
pg_dump "$SUPABASE_DB_URL" \
  --table=generated_articles \
  --table=article_jobs \
  --table=token_usage_logs \
  --table=company_subscriptions \
  > "$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"

# 只保留最近 7 天的備份
find "$BACKUP_DIR" -name "backup-*.sql" -mtime +7 -delete

echo "✅ 備份完成: $BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
```

### 重要提醒

**Supabase Free Plan 限制**：

- ❌ 沒有 Point-in-Time Recovery (PITR)
- ❌ 沒有自動備份
- ❌ 刪除的資料**無法恢復**

**因此**：預防比事後恢復更重要！

## 安全檢查清單

在執行任何資料庫操作前，檢查：

- [ ] 是否為只讀查詢（SELECT/SHOW/DESCRIBE）？
- [ ] 如果是寫入操作，用戶是否明確要求？
- [ ] 是否已向用戶展示要執行的 SQL 語句？
- [ ] 是否已記錄在 ISSUELOG.md？
- [ ] 是否有最近的備份？

## 參考案例

**2025-11-16 文章資料意外刪除事件**：

- **問題**：所有文章資料被刪除（generated_articles, article_jobs 等表格歸零）
- **原因**：診斷過程中可能意外執行了破壞性操作
- **教訓**：
  1. 診斷報告錯誤地將「資料庫為空」歸因於「Cloudflare 錯誤」
  2. 缺乏操作記錄，無法追溯實際執行的命令
  3. 沒有備份，資料無法恢復
- **改進**：制定本安全規範，避免重蹈覆轍

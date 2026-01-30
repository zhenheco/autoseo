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

# 🌐 多語系開發規範（強制執行）

> ⚠️ **所有 UI 文字修改都必須同步更新三個語系檔案**

## 支援語系（7 種）

| 語系代碼 | 語言 | 檔案位置 |
|---------|------|----------|
| `zh-TW` | 繁體中文（主要基準） | `src/messages/zh-TW.json` |
| `en-US` | English | `src/messages/en-US.json` |
| `ja-JP` | 日本語 | `src/messages/ja-JP.json` |
| `ko-KR` | 한국어 | `src/messages/ko-KR.json` |
| `de-DE` | Deutsch | `src/messages/de-DE.json` |
| `es-ES` | Español | `src/messages/es-ES.json` |
| `fr-FR` | Français | `src/messages/fr-FR.json` |

## 開發流程

1. **新增 UI 文字時**：
   - 先在 `zh-TW.json` 新增 key
   - 同時新增對應翻譯到 `en-US.json` 和 `ja-JP.json`
   - 使用 `useTranslations()` hook 取得翻譯

2. **修改現有文字時**：
   - 同步更新所有語系檔案（至少 zh-TW、en-US、ja-JP）

3. **完成後驗證**：
   ```bash
   node scripts/check-translations.js
   ```
   確保輸出顯示「(完整)」

## 程式碼範例

```tsx
// 在 React 組件中使用
import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations("nav");
  return <h1>{t("home")}</h1>;
}
```

## 翻譯 Key 命名規範

- 使用 **camelCase**：`loginButton`、`welcomeMessage`
- 按功能分類：`nav.home`、`auth.loginFailed`、`articles.generate`
- 帶參數使用 `{placeholder}`：`"welcome": "歡迎，{name}"`

## 🚨 禁止事項

- ❌ 在程式碼中硬編碼中文文字（必須使用 `t()` 函數）
- ❌ 只更新一個語系檔案
- ❌ 跳過翻譯完整性檢查

---

# 🆕 新功能開發規範

## 1. 分支策略

**開發新功能時，必須使用新的 branch：**

```bash
# ✅ 正確流程
git checkout -b feature/新功能名稱
# 開發完成後
git push origin feature/新功能名稱
# 建立 Pull Request 合併到 main

# ❌ 禁止直接在 main 開發新功能
git checkout main
# 直接修改...（錯誤！）
```

**命名規範**：

- 新功能：`feature/功能名稱`
- Bug 修復：`fix/問題描述`
- 優化改進：`improve/改進描述`

## 2. 頁面可見性

**新功能頁面必須放在系統管理員專區：**

| 類型     | 放置位置       | 路徑範例                     |
| -------- | -------------- | ---------------------------- |
| 管理功能 | 系統管理員專區 | `/admin/新功能`              |
| 測試功能 | 系統管理員專區 | `/admin/experimental/新功能` |
| 夥伴功能 | 夥伴管理區     | `/admin/partners/新功能`     |

**原則**：

- 新開發的功能頁面**不要**直接暴露給一般用戶
- 先在管理員專區測試穩定後，再移至正式位置
- 使用權限檢查確保只有管理員可訪問

**範例檢查**：

```typescript
// 在頁面中檢查管理員權限
const { user } = await getUser();
if (user?.role !== "admin") {
  redirect("/dashboard");
}
```

---

# 🔗 Supabase UNIQUE 約束與 JOIN 返回格式（重要！）

> **⚠️ 2025-12-07 重大教訓**：添加 UNIQUE 約束會改變 Supabase JOIN 返回格式！

## 問題說明

當 Supabase 檢測到關聯表有 **UNIQUE 約束**（一對一關係）時，會自動將 JOIN 結果從**陣列格式**改為**對象格式**：

```typescript
// 無 UNIQUE 約束時 → 返回陣列
{ generated_articles: [{ id: "...", title: "..." }] }

// 有 UNIQUE 約束時 → 返回對象
{ generated_articles: { id: "...", title: "..." } }
```

## 本專案受影響的關聯

| 表格                 | 約束                    | 返回格式 |
| -------------------- | ----------------------- | -------- |
| `generated_articles` | `article_job_id` UNIQUE | 對象     |

## 添加 UNIQUE 約束前的檢查清單

1. **搜索受影響的代碼**：

   ```bash
   grep -r "關聯名稱\?\.\[0\]" src/
   ```

2. **更新 TypeScript interface**：

   ```typescript
   // 從陣列
   generated_articles: Array<{...}> | null;
   // 改為對象
   generated_articles: {...} | null;
   ```

3. **更新存取方式**：

   ```typescript
   // 從陣列存取
   article.generated_articles?.[0]?.title;
   // 改為直接存取
   article.generated_articles?.title;
   ```

4. **處理類型斷言**：
   ```typescript
   // 需要 as unknown as 轉換
   const ga = data.generated_articles as unknown as { id: string } | null;
   ```

## 參考案例

詳見 `devlog.md` 的 `2025-12-07 23:30` 記錄。

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

---

# 🌐 Platform Blog (1wayseo.com) 說明

## 什麼是 Platform Blog

1wayseo.com 是本專案的**自營官方部落格**，與一般用戶的 WordPress 網站不同：

| 特性             | WordPress 網站        | Platform Blog (1wayseo.com) |
| ---------------- | --------------------- | --------------------------- |
| 類型             | 用戶自有網站          | 平台自營部落格              |
| 發布方式         | 透過 WordPress API    | 直接更新資料庫              |
| wp_enabled       | 必須為 true           | 不需要（false）             |
| is_platform_blog | false 或 null         | **true**                    |
| 文章顯示位置     | 用戶的 WordPress 網站 | /blog/[slug] 路由           |

## 關鍵資料庫欄位

- `website_configs.is_platform_blog = true` → 標記為平台自營部落格
- `generated_articles.published_to_website_id` → 指向 Platform Blog 的 ID
- `generated_articles.status = "published"` → 才會在 /blog 頁面顯示

## 文章顯示邏輯

文章在 1wayseo.com/blog 顯示需要同時滿足三個條件：

1. `status = "published"`
2. `published_to_website_id = <platform-blog-id>`
3. `slug IS NOT NULL`

## 發布到 Platform Blog

使用 API：

```typescript
POST /api/articles/[id]/publish
{
  "target": "platform",
  "website_id": "<platform-blog-id>"
}
```

## Platform Blog 資訊

- **Website ID**: `d3d18bd5-ebb5-4a7f-8cba-97bed4a19168`
- **Website Name**: 1waySEO 官方 Blog
- **URL**: https://1wayseo.com/blog
- **公司 ID**: `1c9c2d1d-3b26-4ab1-971f-98a980fdbce9`（Ace的公司）

---

# 📅 文章排程時間邏輯

## 固定黃金時段

每日發布文章數 ≤ 3 篇時，使用固定黃金時段：

| 時段 | 台灣時間 | UTC 時間  |
| ---- | -------- | --------- |
| 早上 | 09:00    | UTC 01:00 |
| 下午 | 14:00    | UTC 06:00 |
| 晚上 | 20:00    | UTC 12:00 |

- 每天 1 篇 → 09:00
- 每天 2 篇 → 09:00, 14:00
- 每天 3 篇 → 09:00, 14:00, 20:00

## 平均分散模式

每日發布文章數 > 3 篇時，在 08:00-22:00 間平均分散。

## 隨機偏移

所有排程時間都有 ±15 分鐘的隨機偏移，讓發布時間更自然。

## 相關程式碼

排程計算函數位於：`src/app/(dashboard)/dashboard/articles/manage/actions.ts` 的 `calculateScheduleTimes()`

---

# 🌍 多語系文章排程發布

## 運作原理

原文和翻譯版本是**獨立排程**的。翻譯必須在原文發布後才能執行，因此：

1. **原文排程發布**（例如 Day 1 09:00）
2. **原文發布後觸發翻譯**（Day 1 09:00 後開始翻譯）
3. **翻譯完成後自動排程**到**下一個黃金時段**發布

### 範例流程

```
Day 1 09:00 → zh-TW 原文發布
Day 1 10:30 → 翻譯完成（en-US, ja-JP）
Day 1 14:00 → en-US, ja-JP 自動發布（下一個黃金時段）
```

### 黃金時段計算規則

翻譯完成時，自動計算最近的下一個黃金時段：

| 翻譯完成時間 | 排程發布時間 |
| ------------ | ------------ |
| 08:00        | 當天 09:00   |
| 10:30        | 當天 14:00   |
| 15:00        | 當天 20:00   |
| 21:00        | 隔天 09:00   |

## 資料庫欄位（article_translations）

| 欄位                   | 類型                     | 說明                               |
| ---------------------- | ------------------------ | ---------------------------------- |
| `scheduled_publish_at` | TIMESTAMP WITH TIME ZONE | 排程發布時間（翻譯完成時自動設定） |
| `auto_publish`         | BOOLEAN                  | 是否自動發布（cron job 處理）      |
| `publish_website_id`   | UUID                     | 發布目標網站 ID                    |

## 翻譯排程流程

```typescript
// 在 process-translation-jobs.ts 中
// 翻譯完成時自動計算下一個黃金時段

import { getNextGoldenSlotISO } from "@/lib/scheduling/golden-slots";

const scheduledPublishAt = getNextGoldenSlotISO(); // 計算下一個黃金時段

await supabase.from("article_translations").upsert({
  // ... 翻譯內容 ...
  status: "draft",
  scheduled_publish_at: scheduledPublishAt, // 自動排程
  auto_publish: true,
  publish_website_id: job.website_id,
});
```

## Cron Job 處理

`/api/cron/process-scheduled-articles` 每小時執行，處理：

1. 原文發布（到 WordPress 或 Platform Blog）
2. 翻譯版本發布（到 Platform Blog）

## 取消排程

取消原文排程時，可選擇同時取消該文章所有翻譯版本的排程。

## 相關程式碼

- 黃金時段計算：`src/lib/scheduling/golden-slots.ts`
- 翻譯排程：`scripts/process-translation-jobs.ts`
- 取消排程：`actions.ts` → `cancelArticleSchedule()`
- Cron 處理：`/api/cron/process-scheduled-articles/route.ts`
- Migration：`supabase/migrations/20251215000000_translation_scheduling.sql`

---

# 🐛 已知問題與解法

### Supabase RLS - social_accounts 表缺少寫入政策

**問題**：同步社群帳號時出現 `new row violates row-level security policy for table "social_accounts"`
**原因**：原始 migration 只定義了 SELECT 政策，缺少 INSERT/DELETE/UPDATE 政策
**解法**：創建 `20260104000000_social_accounts_rls_fix.sql` 補齊缺少的 RLS 政策
**教訓**：新增資料表時，務必確認所有 CRUD 操作都有對應的 RLS 政策
**日期**：2026-01-04

---

### Vercel Cron - 排程文章全部卡住無法發布

**問題**：排程文章時間過了卻沒有發布，全部卡到同一天（1/26-1/30 共 4 天文章未發布）

**根本原因**：
`vercel.json` 中的 cron 配置錯誤：
```json
// ❌ 錯誤配置（每天 UTC 00:00 執行一次）
"schedule": "0 0 * * *"

// ✅ 正確配置（每小時執行一次）
"schedule": "0 * * * *"
```

API 名稱是 `hourly-tasks`，但實際配置成每天執行一次，導致排程文章要等到隔天 UTC 00:00 才會被處理。

**解法**：
1. 緊急處理：手動呼叫 cron API 發布積壓文章
   ```bash
   curl -X GET 'https://1wayseo.com/api/cron/process-scheduled-articles' \
     -H 'Authorization: Bearer ${CRON_SECRET}'
   ```
2. 永久修復：將 `vercel.json` 的 schedule 改為 `"0 * * * *"`

**相關檔案**：
- Cron 配置：`vercel.json`
- 排程處理 API：`src/app/api/cron/process-scheduled-articles/route.ts`
- 每小時任務：`src/app/api/cron/hourly-tasks/route.ts`

**教訓**：
1. Cron 配置與 API 命名要一致（hourly 就應該是每小時）
2. 排程功能上線後要監控是否正常執行
3. 發現問題先手動處理積壓，再修復根本原因

**日期**：2026-01-30

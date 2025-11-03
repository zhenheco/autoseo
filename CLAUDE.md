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

# 🚀 部署前檢查清單（Pre-Deployment Checklist）

**❗ 重要：每次提交前必須執行以下檢查，避免 Vercel 部署失敗**

## 1. 本地建置測試
```bash
npm run build
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
npm run typecheck
# 或
npx tsc --noEmit
```

## 3. Lint 檢查（可選）
```bash
npm run lint
```

## 4. 提交前最後檢查

- [ ] ✅ `npm run build` 成功完成
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
npm install
npm run build
```

## 問題 2: 類型定義不同步
**原因**: database.types.ts 與實際資料庫 schema 不一致
**解決**:
```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
```

## 問題 3: Vercel 環境變數缺失
**檢查**: Vercel Dashboard → Settings → Environment Variables
**必要變數**:
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
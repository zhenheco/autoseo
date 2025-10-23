# Supabase 資料庫 Schema

## 📋 概述

此目錄包含 Auto Pilot SEO 平台的完整資料庫架構定義。

## 🗄️ 資料表結構

### 核心表 (Core Tables)
1. **companies** - 公司/組織表
2. **company_members** - 成員關係表（多對多）
3. **role_permissions** - 角色權限定義
4. **website_configs** - WordPress 網站配置
5. **article_jobs** - 文章生成任務
6. **api_usage_logs** - API 使用記錄

### 訂閱相關 (Subscription)
7. **subscription_plans** - 訂閱方案（含預設方案）
8. **subscriptions** - 公司訂閱狀態
9. **orders** - 訂單記錄（藍新金流）

### 進階功能 (Advanced Features)
10. **white_label_configs** - 品牌白標配置
11. **affiliates** - Affiliate 用戶
12. **affiliate_referrals** - 推薦記錄
13. **affiliate_commissions** - 佣金記錄

### 系統功能
14. **activity_logs** - 活動日誌

## 🔐 安全機制

### Row Level Security (RLS)
- ✅ 所有表都啟用 RLS
- ✅ 多租戶資料隔離
- ✅ 角色權限控制

### 加密功能
- ✅ WordPress Token 加密存儲（pgsodium）
- ✅ API Keys 加密存儲
- ✅ 提供 `encrypt_data()` 和 `decrypt_data()` 函數

### 權限函數
- `has_permission(user_id, company_id, permission)` - 檢查使用者權限

## 📦 Migration 檔案

1. **20250101000000_init_schema.sql**
   - 核心表結構
   - 訂閱相關表
   - 基本索引和觸發器

2. **20250101000001_advanced_features.sql**
   - White Label 功能
   - Affiliate 系統

3. **20250101000002_rls_and_functions.sql**
   - 加密/解密函數
   - Row Level Security 政策
   - 權限檢查函數

## 🚀 執行 Migration

### 方法 1: 透過 Supabase Dashboard

1. 登入 [Supabase Dashboard](https://app.supabase.com)
2. 選擇專案
3. 前往 **SQL Editor**
4. 依序執行以下檔案：
   - `20250101000000_init_schema.sql`
   - `20250101000001_advanced_features.sql`
   - `20250101000002_rls_and_functions.sql`

### 方法 2: 使用 Supabase CLI

```bash
# 安裝 Supabase CLI
npm install -g supabase

# 初始化專案
supabase init

# 連結到遠端專案
supabase link --project-ref your-project-ref

# 推送 migrations
supabase db push
```

### 方法 3: 使用 MCP 工具（推薦）

如果您已設定 Supabase MCP 工具，可以直接執行 SQL 指令。

## 🔑 預設資料

### 訂閱方案 (Subscription Plans)

| 方案 | 價格 (TWD) | 文章額度 | 網站數 | 團隊成員 |
|------|-----------|---------|--------|---------|
| Free | 0 | 5 | 1 | 1 |
| Basic | 1,680 | 50 | 3 | 5 |
| Pro | 5,040 | 200 | 10 | 20 |
| Enterprise | 議價 | 無限 | 無限 | 無限 |

### 角色權限 (Role Permissions)

- **Owner**: 完整權限（管理公司、計費、所有成員、所有功能）
- **Admin**: 管理權限（網站、文章、團隊，除了計費）
- **Editor**: 編輯權限（指定網站、團隊文章）
- **Writer**: 寫作權限（生成文章、查看自己的文章）
- **Viewer**: 檢視權限（僅查看文章）

## 📝 型別定義

建議使用 Supabase CLI 生成 TypeScript 型別：

```bash
supabase gen types typescript --local > src/types/database.types.ts
```

## ⚠️ 注意事項

1. **首次執行**: 確保 `pgsodium` 擴展已啟用
2. **順序**: 必須按照 migration 檔案編號順序執行
3. **測試**: 建議先在開發環境測試完整流程
4. **備份**: 正式環境執行前請先備份資料庫

## 🔍 驗證 Migration

執行後驗證：

```sql
-- 檢查所有表是否建立
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 檢查 RLS 是否啟用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 檢查預設方案是否插入
SELECT * FROM subscription_plans ORDER BY sort_order;

-- 檢查權限是否設定
SELECT role, COUNT(*) as permission_count
FROM role_permissions
GROUP BY role;
```

## 📚 相關文檔

- [Supabase 官方文檔](https://supabase.com/docs)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [pgsodium 加密](https://github.com/michelp/pgsodium)

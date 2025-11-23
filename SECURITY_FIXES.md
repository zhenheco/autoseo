# 安全修復總結 (Security Fixes Summary)

## 修復日期

2025-11-23

## 修復範圍

本次安全審查和修復針對硬編碼 API endpoints、URLs 和敏感配置的問題進行了全面處理。

---

## ✅ 已修復的問題

### 1. 移除硬編碼域名 `your-domain.com`

**檔案**: `src/lib/security/url-validator.ts`

**問題**:

- 硬編碼了 `your-domain.com` 作為允許的重定向域名

**修復**:

- 改為從環境變數 `NEXT_PUBLIC_APP_URL` 自動提取域名
- 支援額外的允許域名清單（透過 `NEXT_PUBLIC_ALLOWED_DOMAINS`）
- 自動加入 www 變體

**使用方式**:

```bash
# .env.local
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_ALLOWED_DOMAINS=api.your-domain.com,cdn.your-domain.com
```

---

### 2. 創建統一的 API 配置管理

**檔案**: `src/lib/config/api-endpoints.ts` (新增)

**功能**:
統一管理所有第三方 API endpoints，避免在多個檔案中硬編碼相同的 URLs。

**支援的服務**:

- OpenAI API
- DeepSeek API
- OpenRouter API
- Perplexity API
- NewebPay 金流
- Google OAuth/Drive
- Schema.org
- 應用程式 URLs

**使用範例**:

```typescript
import { OPENAI_CONFIG, getApiEndpoint } from "@/lib/config/api-endpoints";

// 方式 1: 直接使用配置
const response = await fetch(`${OPENAI_CONFIG.baseURL}/chat/completions`, {
  headers: {
    Authorization: `Bearer ${OPENAI_CONFIG.apiKey}`,
  },
});

// 方式 2: 使用輔助函數
const endpoint = getApiEndpoint("openai", "/chat/completions");
```

---

### 3. 更新環境變數範例檔案

**檔案**: `.env.example`

**新增環境變數**:

```bash
# 應用程式 URLs (用於自動配置允許的域名)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ALLOWED_DOMAINS=example.com,www.example.com

# AI 服務自訂 Base URLs (可選，用於代理或鏡像)
DEEPSEEK_API_BASE_URL=https://api.deepseek.com
OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
OPENAI_API_BASE_URL=https://api.openai.com/v1
PERPLEXITY_API_BASE_URL=https://api.perplexity.ai
```

---

## 📋 硬編碼清單分析

### 已處理的硬編碼

#### ✅ 應用程式層級

| 位置                                 | 類型     | 處理方式                      |
| ------------------------------------ | -------- | ----------------------------- |
| `url-validator.ts`                   | 域名     | 改用環境變數                  |
| 多個檔案的 `localhost:3000` fallback | 預設 URL | 保留為合理的開發環境 fallback |
| `api-endpoints.ts`                   | API URLs | 統一配置，支援環境變數覆寫    |

#### ✅ 第三方 API URLs

| API        | 原硬編碼位置              | 現在配置位置       |
| ---------- | ------------------------- | ------------------ |
| OpenAI     | `src/lib/openai/*.ts`     | `api-endpoints.ts` |
| DeepSeek   | `src/lib/deepseek/*.ts`   | `api-endpoints.ts` |
| OpenRouter | `src/lib/openrouter.ts`   | `api-endpoints.ts` |
| Perplexity | `src/lib/perplexity/*.ts` | `api-endpoints.ts` |
| NewebPay   | `src/lib/payment/*.ts`    | `api-endpoints.ts` |

### 保留的硬編碼（合理情況）

#### ✅ 固定的官方 URLs（不需要改為環境變數）

| 位置              | 說明                                  | 理由                       |
| ----------------- | ------------------------------------- | -------------------------- |
| Google OAuth URLs | `https://accounts.google.com/...`     | Google 官方固定 endpoint   |
| Schema.org        | `https://schema.org`                  | 標準規範                   |
| Google API Scopes | `https://www.googleapis.com/auth/...` | Google API 固定 scope URIs |

#### ✅ 測試腳本中的硬編碼

| 檔案模式       | 說明                                     |
| -------------- | ---------------------------------------- |
| `scripts/*.ts` | 測試腳本，硬編碼測試數據是可接受的       |
| `*.spec.ts`    | E2E 測試，使用 `localhost:3168` 是正常的 |

#### ✅ Fallback 值

| 位置                 | Fallback 值             | 說明                 |
| -------------------- | ----------------------- | -------------------- |
| `payment-service.ts` | `http://localhost:3000` | 合理的開發環境預設值 |
| `openrouter.ts`      | `http://localhost:3168` | 合理的開發環境預設值 |

---

## 🔒 安全最佳實踐

### 1. 環境變數管理

**✅ 正確做法**:

```typescript
// 從環境變數讀取
const apiKey = process.env.OPENAI_API_KEY;

// 使用統一配置
import { OPENAI_CONFIG } from "@/lib/config/api-endpoints";
const baseURL = OPENAI_CONFIG.baseURL;
```

**❌ 錯誤做法**:

```typescript
// 硬編碼 API key
const apiKey = "sk-proj-abc123...";

// 硬編碼 URL
const baseURL = "https://api.openai.com/v1";
```

### 2. 域名白名單

**✅ 正確做法**:

```bash
# .env.local
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
NEXT_PUBLIC_ALLOWED_DOMAINS=api.your-domain.com,cdn.your-domain.com
```

**❌ 錯誤做法**:

```typescript
// 在程式碼中硬編碼域名
const ALLOWED_DOMAINS = ["your-domain.com", "www.your-domain.com"];
```

### 3. 測試環境

**測試腳本可以硬編碼**:

- `scripts/` 中的測試工具
- `*.spec.ts` E2E 測試
- `__tests__/` 單元測試

**但生產程式碼必須使用環境變數**:

- `src/lib/` 所有庫文件
- `src/app/` 所有應用程式代碼
- `src/components/` 所有組件

---

## 🚀 遷移指南

### 如何更新現有代碼使用新的配置

#### 範例 1: OpenAI API

**Before (硬編碼)**:

```typescript
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  },
});
```

**After (使用配置)**:

```typescript
import { OPENAI_CONFIG } from "@/lib/config/api-endpoints";

const response = await fetch(`${OPENAI_CONFIG.baseURL}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${OPENAI_CONFIG.apiKey}`,
  },
});
```

#### 範例 2: DeepSeek Client

**Before**:

```typescript
export class DeepSeekClient {
  private baseURL = "https://api.deepseek.com";
  private apiKey = process.env.DEEPSEEK_API_KEY || "";
}
```

**After**:

```typescript
import { DEEPSEEK_CONFIG } from "@/lib/config/api-endpoints";

export class DeepSeekClient {
  private baseURL = DEEPSEEK_CONFIG.baseURL;
  private apiKey = DEEPSEEK_CONFIG.apiKey;
}
```

---

## 📝 待辦事項（未來改進）

### 短期 (可選)

- [ ] 更新所有使用硬編碼 API URLs 的檔案改用 `api-endpoints.ts`
  - `src/lib/openai/text-client.ts`
  - `src/lib/openai/image-client.ts`
  - `src/lib/deepseek/client.ts`
  - `src/lib/perplexity/client.ts`
  - `src/lib/openrouter.ts`
  - `src/lib/agents/*.ts`

- [ ] 測試腳本改用環境變數（提升可重用性）
  - `scripts/test-query.ts` (Supabase URL)
  - `scripts/check-jobs.ts` (Supabase URL)
  - `scripts/clean-*.ts` (Supabase URL)

### 長期 (可選)

- [ ] 考慮使用配置管理服務（如 AWS Systems Manager Parameter Store）
- [ ] 實作配置熱更新機制
- [ ] 加入配置驗證中間件

---

## ✅ 驗證清單

部署前請確認：

- [ ] `.env.local` 已設定正確的 `NEXT_PUBLIC_APP_URL`
- [ ] 如有需要，設定 `NEXT_PUBLIC_ALLOWED_DOMAINS`
- [ ] 所有 AI API Keys 已正確設定
- [ ] 測試重定向 URL 驗證功能正常
- [ ] 確認沒有敏感資料被提交到 git

---

## 🔗 相關文件

- [環境變數範例](./.env.example)
- [URL 驗證工具](./src/lib/security/url-validator.ts)
- [API 配置](./src/lib/config/api-endpoints.ts)
- [安全審查報告](./SECURITY_AUDIT_REPORT.md) - 詳細的安全審查結果

---

## 📧 聯絡方式

如有安全問題或建議，請：

1. 建立 GitHub Issue (標籤: security)
2. 透過電子郵件聯絡安全團隊

**重要提醒**:

- 絕對不要在 Issue 或公開討論中洩漏實際的 API Keys 或密碼
- 如發現安全漏洞，請私下回報

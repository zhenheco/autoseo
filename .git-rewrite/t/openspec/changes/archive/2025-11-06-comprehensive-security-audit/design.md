# 設計文件：全面安全審計與修復

## 架構概述

### 安全層級架構

```
┌─────────────────────────────────────────────────────────────┐
│                    應用程式安全層                             │
├─────────────────────────────────────────────────────────────┤
│ 1. 秘密管理 (Secrets Management)                             │
│    - 環境變數驗證                                            │
│    - 秘密輪替機制                                            │
│    - 開發/生產環境隔離                                       │
├─────────────────────────────────────────────────────────────┤
│ 2. 認證與授權 (Authentication & Authorization)               │
│    - API 金鑰驗證                                            │
│    - JWT 驗證                                                │
│    - RBAC 權限控制                                           │
├─────────────────────────────────────────────────────────────┤
│ 3. 輸入驗證與清理 (Input Validation & Sanitization)         │
│    - XSS 防護                                                │
│    - SQL Injection 防護                                      │
│    - CSRF 保護                                               │
├─────────────────────────────────────────────────────────────┤
│ 4. 輸出編碼 (Output Encoding)                               │
│    - HTML 轉義                                               │
│    - JavaScript 轉義                                         │
│    - URL 編碼                                                │
├─────────────────────────────────────────────────────────────┤
│ 5. 安全標頭 (Security Headers)                              │
│    - CSP, HSTS, X-Frame-Options                             │
│    - CORS 設定                                               │
├─────────────────────────────────────────────────────────────┤
│ 6. 日誌與監控 (Logging & Monitoring)                        │
│    - 安全事件記錄                                            │
│    - 敏感資訊過濾                                            │
│    - 異常檢測                                                │
└─────────────────────────────────────────────────────────────┘
```

## 詳細設計

### 1. 秘密管理系統

#### 環境變數驗證工具

```typescript
// src/lib/security/env-validator.ts
interface EnvConfig {
  name: string;
  required: boolean;
  pattern?: RegExp;
  masked?: boolean;
}

const envConfigs: EnvConfig[] = [
  {
    name: "OPENAI_API_KEY",
    required: true,
    pattern: /^sk-proj-/,
    masked: true,
  },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, masked: true },
  // ... 其他環境變數
];

function validateEnv(): void {
  // 驗證所有必要的環境變數
  // 確保格式正確
  // 在開發模式下警告缺少的變數
}
```

#### 秘密輪替工具

```bash
#!/bin/bash
# scripts/rotate-secrets.sh

# 自動化秘密輪替流程:
# 1. 生成新的秘密
# 2. 更新環境變數
# 3. 撤銷舊的秘密
# 4. 驗證新秘密可用
```

### 2. XSS 防護

#### HTML 轉義工具

```typescript
// src/lib/security/html-sanitizer.ts
import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
    ],
    ALLOWED_ATTR: ["class", "id"],
  });
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

#### URL 驗證與編碼

```typescript
// src/lib/security/url-validator.ts
export function validateRedirectUrl(url: string): boolean {
  const allowedDomains = [
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
  ];

  try {
    const parsed = new URL(url);
    return allowedDomains.some((domain) => url.startsWith(domain));
  } catch {
    return false;
  }
}

export function safeRedirect(url: string): string {
  return validateRedirectUrl(url) ? url : "/";
}
```

### 3. API 認證強化

#### Webhook 簽章驗證

```typescript
// src/lib/security/webhook-validator.ts
import crypto from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

export function verifyNewebPayCallback(
  tradeInfo: string,
  tradeSha: string,
): boolean {
  // 驗證藍新金流回調簽章
  // 檢查時間戳,防止重放攻擊
  // 驗證來源 IP (如果可能)
}
```

### 4. 日誌安全

#### 敏感資訊過濾器

```typescript
// src/lib/security/log-sanitizer.ts
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{32,}/g, // API 金鑰
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, // Bearer tokens
  /password["\s:=]+[^\s"]+/gi, // 密碼
  /api[_-]?key["\s:=]+[^\s"]+/gi, // API 金鑰
];

export function sanitizeLog(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

export function createSecureLogger() {
  return {
    log: (message: string, ...args: any[]) => {
      console.log(sanitizeLog(message), ...args.map(sanitizeArg));
    },
    error: (message: string, ...args: any[]) => {
      console.error(sanitizeLog(message), ...args.map(sanitizeArg));
    },
    // ... 其他日誌方法
  };
}
```

### 5. 安全標頭設定

#### Next.js 中介軟體

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 安全標頭
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  );

  return response;
}
```

### 6. 自動化安全檢查

#### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "執行安全檢查..."

# 檢查是否包含潛在的敏感資訊
if git diff --cached | grep -E 'sk-[a-zA-Z0-9]{32,}|api[_-]?key.*=.*[a-zA-Z0-9]{20,}'; then
  echo "❌ 錯誤: 偵測到潛在的 API 金鑰或敏感資訊"
  echo "請確認並移除敏感資訊後再提交"
  exit 1
fi

# 檢查 .env.local 是否被加入
if git diff --cached --name-only | grep -E '^\.env\.local$'; then
  echo "❌ 錯誤: 不應該提交 .env.local 檔案"
  exit 1
fi

echo "✅ 安全檢查通過"
```

#### GitHub Actions 工作流程

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  pull_request:
  push:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2

      - name: Run npm audit
        run: npm audit --audit-level=moderate

      - name: Check for hardcoded secrets
        run: |
          if grep -r -E 'sk-[a-zA-Z0-9]{32,}|api[_-]?key.*=.*[a-zA-Z0-9]{20,}' src/ scripts/; then
            echo "Found potential hardcoded secrets"
            exit 1
          fi
```

## 實作優先順序

### 緊急 (立即執行)

1. 撤銷所有已洩漏的 API 金鑰
2. 從 .env.local 移除實際金鑰
3. 檢查 git 歷史並清理洩漏的金鑰

### 高優先級 (1-2 天)

4. 修復支付回調的 XSS 漏洞
5. 清理所有洩漏敏感資訊的 console.log
6. 實作日誌安全過濾器

### 中優先級 (3-5 天)

7. 實作完整的 HTML 清理機制
8. 加強 API 認證
9. 設定安全標頭
10. 建立環境變數驗證工具

### 持續改進

11. 設定 pre-commit hooks
12. 整合 GitHub Actions 安全掃描
13. 建立安全檢查清單文件
14. 實作秘密輪替機制

## 成功指標

- ✅ 零 API 金鑰洩漏
- ✅ 所有 API endpoints 都有認證
- ✅ 通過 OWASP ZAP 掃描
- ✅ npm audit 無高風險漏洞
- ✅ Gitleaks 掃描通過
- ✅ 所有日誌都經過敏感資訊過濾

# secrets-management Specification

## Purpose

TBD - created by archiving change comprehensive-security-audit. Update Purpose after archive.

## Requirements

### Requirement: 環境變數驗證

系統 MUST 在啟動時驗證所有必要的環境變數。

#### Scenario: 啟動時驗證必要環境變數

**Given** 系統啟動時
**When** 載入環境變數
**Then** 驗證所有必要的環境變數存在
**And** 驗證環境變數格式正確 (例如: OpenAI key 以 "sk-" 開頭)
**And** 在開發模式下,警告缺少的可選環境變數

#### Scenario: 偵測到無效的環境變數格式

**Given** OpenAI API Key 不以 "sk-proj-" 或 "sk-" 開頭
**When** 系統啟動
**Then** 拋出錯誤並拒絕啟動
**And** 提供清晰的錯誤訊息指出哪個環境變數無效

### Requirement: 環境變數檔案隔離

開發和生產環境 MUST 使用不同的環境變數檔案。

#### Scenario: 開發環境使用 .env.local

**Given** 在開發環境 (NODE_ENV=development)
**When** 啟動應用程式
**Then** 載入 .env.local 檔案
**And** .env.local 必須在 .gitignore 中
**And** 提供 .env.example 作為範本

#### Scenario: 生產環境使用環境變數

**Given** 在生產環境 (Vercel/Cloudflare)
**When** 部署應用程式
**Then** 從平台的環境變數系統載入
**And** 不依賴任何 .env 檔案

### Requirement: 秘密輪替機制

系統 SHALL 提供工具和流程定期輪替 API 金鑰。

#### Scenario: 手動輪替 API 金鑰

**Given** 需要輪替 OpenAI API Key
**When** 執行 `npm run rotate-secret openai`
**Then** 腳本提示管理員生成新金鑰
**And** 提供更新環境變數的指引
**And** 提醒撤銷舊金鑰

#### Scenario: 驗證新秘密可用

**Given** 已更新環境變數為新金鑰
**When** 執行 `npm run test-secrets`
**Then** 測試所有 API 金鑰的連接性
**And** 報告哪些金鑰有效,哪些無效

### Requirement: 禁止硬編碼秘密

程式碼中 MUST NOT 包含任何硬編碼的秘密。

#### Scenario: Pre-commit 檢查偵測硬編碼秘密

**Given** 提交包含 "sk-proj-abc123..." 的程式碼
**When** 執行 git commit
**Then** Pre-commit hook 偵測到潛在的 API 金鑰
**And** 阻止提交
**And** 顯示警告訊息

#### Scenario: CI 檢查偵測硬編碼秘密

**Given** PR 包含硬編碼的秘密
**When** GitHub Actions 執行
**Then** Gitleaks 掃描偵測到秘密
**And** PR 檢查失敗
**And** 在 PR 中留言警告

### Requirement: .env.local 永不提交

.env.local 檔案 MUST NOT 被提交到 git repository。

#### Scenario: .gitignore 正確設定

**Given** 專案根目錄的 .gitignore
**When** 檢查 git 設定
**Then** .gitignore 包含 `.env*`
**And** .gitignore 排除 `.env.example`

#### Scenario: 偵測到 .env.local 被加入

**Given** 嘗試 git add .env.local
**When** 執行 git commit
**Then** Pre-commit hook 偵測到 .env.local
**And** 阻止提交
**And** 提醒開發者 .env.local 不應提交

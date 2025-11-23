# Add Google Drive OAuth Integration

## Overview

實作 Google Drive OAuth 2.0 認證流程，取代現有的 Access Token 和 Service Account 認證方式，讓使用者能夠安全地授權本系統存取其 Google Drive，並將 AI 生成的圖片自動上傳至使用者的 Google Drive 資料夾。

## Background

目前系統已經有基礎的 Google Drive 上傳功能（`src/lib/storage/google-drive-client.ts`），但使用的是：

- **Access Token**：短期有效，需要頻繁更新
- **Service Account**：配置複雜

現在要改為**管理員（你）的 Google Drive OAuth 認證**，統一將所有圖片上傳至你的 Google Drive，而非每個客戶的 Drive。

## Goals

1. **實作管理員專用的 OAuth 2.0 認證流程**
   - 管理員（專案擁有者）一次性授權
   - 獲取 refresh_token 並儲存在環境變數或資料庫
   - 所有客戶生成的圖片統一上傳至管理員的 Google Drive

2. **改進 GoogleDriveClient**
   - 支援 OAuth 2.0 token 認證（管理員帳號）
   - 自動 token 刷新機制
   - 錯誤處理和重試邏輯

3. **整合至文章生成流程**
   - 在 image-agent 中自動使用管理員的 Google Drive
   - 所有生成的圖片上傳至統一的資料夾
   - 提供圖片的 Google Drive 直連 URL

## Non-Goals

- **不需要每個客戶授權**：只有管理員需要授權
- 不支援多個 Google Drive 帳號（只使用管理員帳號）
- 不實作資料夾選擇器（使用預設的「Auto Pilot SEO Images」資料夾）
- 不實作批量上傳或同步功能（只上傳新生成的圖片）

## Success Criteria

- [ ] 管理員可以成功授權 Google Drive
- [ ] Refresh token 安全儲存（環境變數或資料庫）
- [ ] 所有生成的圖片自動上傳至管理員的 Google Drive
- [ ] Token 自動刷新機制運作正常
- [ ] 錯誤處理完善，提供清晰的錯誤訊息
- [ ] 所有功能通過 TypeScript 類型檢查和建置測試

## Dependencies

- Google OAuth 2.0 Client ID 和 Client Secret（需要在 Google Cloud Console 設定）
- **不需要修改資料庫 schema**（直接使用環境變數存 refresh_token）
- `googleapis` package（已安裝）

## Security Considerations

1. **Token 保護**：refresh_token 儲存在環境變數，永不提交至 Git
2. **HTTPS Only**：OAuth callback 必須使用 HTTPS（本地開發可使用 localhost）
3. **Scope 限制**：只請求 `drive.file` scope（僅存取系統創建的檔案）
4. **環境變數保護**：所有敏感資訊存放在環境變數

## Timeline

預計開發時間：2-3 個工作天（簡化版本）

- Day 1: OAuth 授權腳本實作（管理員授權）
- Day 2: GoogleDriveClient 改進和 token 刷新
- Day 3: 整合至 image-agent、測試、錯誤處理

## Related Changes

- 更新 `.env.example` 新增 Google OAuth 環境變數
- **不需要資料庫 migration**（使用環境變數儲存 token）
- **不需要前端設定頁面**（管理員透過命令列授權）

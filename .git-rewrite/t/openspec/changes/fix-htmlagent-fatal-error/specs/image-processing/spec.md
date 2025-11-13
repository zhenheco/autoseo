# Image Processing - Spec Delta

## ADDED Requirements

### Requirement: R2 上傳診斷能力
系統 SHALL 提供詳細的 R2 上傳診斷日誌，協助快速定位上傳失敗的根本原因。

#### Scenario: 記錄 R2 配置狀態
- **GIVEN** ImageAgent 準備上傳圖片到 R2
- **WHEN** 調用 `uploadToR2` 方法
- **THEN** 系統 SHALL 記錄診斷日誌（INFO 級別），包含：
  - `filename`: 檔案名稱
  - `contentType`: MIME 類型
  - `base64Length`: Base64 資料長度
  - `hasR2Config`: R2 配置物件是否存在（boolean）
  - `r2AccountId`: 'SET' 或 'MISSING'
  - `r2AccessKeyId`: 'SET' 或 'MISSING'
  - `r2SecretAccessKey`: 'SET' 或 'MISSING'
  - `r2BucketName`: 'SET' 或 'MISSING'
- **AND** 不記錄實際的 credentials 值（安全考量）

#### Scenario: R2 上傳成功的確認日誌
- **GIVEN** 圖片成功上傳到 R2
- **WHEN** 上傳完成
- **THEN** 系統 SHALL 記錄成功日誌（INFO 級別），包含：
  - `filename`: 檔案名稱
  - `url`: 最終的 R2 公開 URL

#### Scenario: R2 上傳失敗的詳細錯誤
- **GIVEN** R2 上傳過程中發生錯誤
- **WHEN** 錯誤被捕獲
- **THEN** 系統 SHALL 記錄警告日誌（WARN 級別），包含：
  - `error`: 錯誤訊息文字
  - `errorStack`: 完整錯誤堆疊（如有）
  - `filename`: 嘗試上傳的檔案名稱
  - `contentType`: MIME 類型
- **AND** 重新拋出錯誤，觸發 fallback 機制（使用原始 OpenAI URL）

### Requirement: R2 Credentials 驗證
系統 SHALL 在上傳前驗證 R2 credentials 的格式和完整性。

#### Scenario: 檢查 credentials 是否存在
- **GIVEN** R2Client 準備執行上傳
- **WHEN** 調用 `uploadImage` 方法
- **THEN** 系統 SHALL 檢查 `accessKeyId` 和 `secretAccessKey` 是否存在
- **AND** 如果任一項為空或 undefined，拋出錯誤 "R2 credentials not configured"

#### Scenario: 檢查非 ASCII 字符
- **GIVEN** R2 credentials 已存在
- **WHEN** 驗證 credentials 格式
- **THEN** 系統 SHALL 檢查 `accessKeyId` 和 `secretAccessKey` 是否包含非 ASCII 字符（正則表達式 `/[^\x00-\x7F]/`）
- **AND** 如果檢測到非 ASCII 字符，拋出錯誤 "R2 credentials contain non-ASCII characters"
- **AND** 記錄該錯誤以供診斷

#### Scenario: Credentials 驗證通過
- **GIVEN** Credentials 格式正確（存在且僅包含 ASCII 字符）
- **WHEN** 驗證完成
- **THEN** 系統 SHALL 繼續執行 R2 上傳流程
- **AND** 不記錄額外的驗證成功日誌（避免日誌過多）

### Requirement: 圖片上傳 Fallback 機制
系統 SHALL 確保即使 R2 上傳失敗，文章生成流程仍能繼續，使用原始圖片 URL。

#### Scenario: R2 上傳失敗時使用 OpenAI URL
- **GIVEN** R2 上傳失敗（任何原因）
- **WHEN** ImageAgent 處理圖片
- **THEN** 系統 SHALL 記錄警告 "Failed to upload to R2, using original URL"
- **AND** 返回原始的 OpenAI 臨時 URL
- **AND** 允許文章生成流程繼續

#### Scenario: 臨時 URL 的生命周期警告
- **GIVEN** 使用 OpenAI 臨時 URL（R2 上傳失敗）
- **WHEN** 圖片 URL 被儲存到文章
- **THEN** 系統應在文檔或日誌中提醒：該 URL 將在約 1 小時後過期
- **AND** 建議修復 R2 配置以獲得永久儲存

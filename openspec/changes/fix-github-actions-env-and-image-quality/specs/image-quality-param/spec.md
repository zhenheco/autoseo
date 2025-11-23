# 圖片生成 Quality 參數

## MODIFIED Requirements

### Requirement: 圖片生成 quality 參數必須符合 OpenAI API 規範

**ID**: `image-quality-api-compliance`
**Priority**: High
**Component**: Image Generation Service

圖片生成時使用的 `quality` 參數 **MUST** 符合 OpenAI API 支援的值：`'low'`, `'medium'`, `'high'`, `'auto'`。不應使用 `'standard'` 或其他不支援的值。

#### Scenario: 使用 medium quality 生成圖片

**Given** 系統需要生成一張標準品質的圖片
**When** 呼叫圖片生成 API
**Then** quality 參數應該設定為 `'medium'`
**And** API 請求應該成功
**And** 不應出現 "Invalid value: 'standard'" 錯誤

#### Scenario: 使用 high quality 生成高品質圖片

**Given** 系統需要生成一張高品質的圖片
**When** 呼叫圖片生成 API
**Then** quality 參數應該設定為 `'high'`
**And** API 請求應該成功
**And** 生成的圖片品質應該較高

## ADDED Requirements

### Requirement: 提供用戶友好的 quality 參數映射

**ID**: `image-quality-mapping`
**Priority**: Medium
**Component**: Image Generation Service

系統 **SHALL** 提供一個映射層，將用戶友好的參數值（如 `'standard'`, `'hd'`）轉換為 API 支援的值，保持向後相容性。

#### Scenario: standard 映射到 medium

**Given** 用戶或系統指定 quality 為 `'standard'`
**When** 準備 API 請求參數
**Then** quality 應該被映射為 `'medium'`
**And** API 請求應該使用 `'medium'` 值
**And** 圖片應該成功生成

#### Scenario: hd 映射到 high

**Given** 用戶或系統指定 quality 為 `'hd'`
**When** 準備 API 請求參數
**Then** quality 應該被映射為 `'high'`
**And** API 請求應該使用 `'high'` 值
**And** 圖片應該成功生成

### Requirement: 更新 TypeScript 型別定義

**ID**: `image-quality-types`
**Priority**: Medium
**Component**: Type Definitions

TypeScript 型別定義 **SHALL** 反映支援的 quality 值，並提供適當的型別檢查。

#### Scenario: 型別系統防止使用無效值

**Given** 開發者嘗試設定 quality 參數
**When** 使用 TypeScript 編輯器
**Then** 型別系統應該提示有效的 quality 值
**And** 使用無效值應該產生編譯錯誤或警告
**And** 自動完成應該建議正確的值

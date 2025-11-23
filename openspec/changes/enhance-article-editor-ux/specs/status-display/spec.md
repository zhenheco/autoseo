# Spec: Status Display Optimization

## Overview

優化文章列表的狀態顯示，使用圖示替代文字，減少垂直空間佔用，並符合 WCAG 2.1 AA 無障礙標準。

## MODIFIED Requirements

### Requirement: Compact status indicator

**ID**: `status-display-001`

文章狀態 SHALL 使用圖示顯示，僅佔一行高度，以提升列表的視覺密度。

#### Scenario: Completed article shows check icon

**Given** 文章列表包含已完成的文章
**When** 使用者查看列表
**Then** 已完成的文章應顯示綠色打勾圖示（Check icon）
**And** 圖示高度應為 16px (h-4)
**And** 圖示顏色應為 `text-green-600`
**And** 圖示應與文章標題在同一行
**And** 不應顯示「已完成」文字（但應提供 tooltip）

#### Scenario: Pending article shows clock icon

**Given** 文章列表包含處理中的文章
**When** 使用者查看列表
**Then** 處理中的文章應顯示黃色時鐘圖示（Clock icon）
**And** 圖示高度應為 16px (h-4)
**And** 圖示顏色應為 `text-yellow-600` 或 `text-amber-600`
**And** 圖示應提供 tooltip 顯示「處理中」

#### Scenario: Failed article shows error icon

**Given** 文章列表包含失敗的文章
**When** 使用者查看列表
**Then** 失敗的文章應顯示紅色 X 圖示（XCircle icon）
**And** 圖示高度應為 16px (h-4)
**And** 圖示顏色應為 `text-red-600`
**And** 圖示應提供 tooltip 顯示失敗原因

---

### Requirement: Accessible tooltip with keyboard support

**ID**: `status-display-002`

系統 SHALL 在使用者滑鼠移至或鍵盤聚焦狀態圖示時顯示 tooltip，提供狀態的完整文字描述。

#### Scenario: User hovers over status icon

**Given** 文章列表顯示狀態圖示
**When** 使用者滑鼠移至圖示上
**Then** 應顯示 tooltip
**And** tooltip 應包含 `role="tooltip"` 屬性
**And** tooltip 應包含狀態的完整文字描述
**And** 對於失敗狀態，tooltip 應顯示失敗原因

#### Scenario: User focuses status icon with keyboard

**Given** 使用者使用鍵盤導航
**When** 使用者按 Tab 鍵聚焦狀態圖示
**Then** 圖示容器應有 `tabindex="0"` 屬性
**And** tooltip 應自動顯示
**And** tooltip 內容應與滑鼠 hover 時一致

#### Scenario: Tooltip disappears on blur

**Given** tooltip 正在顯示
**When** 使用者移開滑鼠或按 Tab 鍵移至下一個元素
**Then** tooltip 應消失
**And** 不應殘留視覺元素

---

### Requirement: WCAG 2.1 AA compliance

**ID**: `status-display-003`

狀態圖示 MUST 符合 WCAG 2.1 AA 無障礙標準，包含適當的 ARIA 屬性和顏色對比度。

#### Scenario: Screen reader announces status

**Given** 使用者使用螢幕閱讀器
**When** 焦點移至狀態圖示
**Then** 螢幕閱讀器應朗讀狀態描述
**And** 圖示應包含 `role="img"` 屬性
**And** 圖示應包含 `aria-label` 屬性
**And** `aria-label` 文字應為「已完成」、「處理中」或「失敗：{原因}」

#### Scenario: Color contrast meets AA standards

**Given** 狀態圖示已渲染
**When** 測量圖示顏色與背景的對比度
**Then** 對比度應至少為 4.5:1
**And** 綠色圖示（`text-green-600`）應與白色背景對比度 ≥ 4.5:1
**And** 黃色圖示（`text-yellow-600`）應與白色背景對比度 ≥ 4.5:1
**And** 紅色圖示（`text-red-600`）應與白色背景對比度 ≥ 4.5:1

#### Scenario: Tooltip association with icon

**Given** 狀態圖示包含 tooltip
**When** tooltip 顯示
**Then** tooltip 應使用 `aria-labelledby` 或 `aria-describedby` 關聯圖示
**And** 這確保螢幕閱讀器正確朗讀關聯內容

---

### Requirement: Consistent status colors across themes

**ID**: `status-display-004`

狀態圖示顏色 SHALL 在亮色和暗色主題下都保持良好的可讀性。

#### Scenario: Status icons in light mode

**Given** 使用者使用亮色主題
**When** 文章列表渲染
**Then** 完成狀態應使用 `text-green-600`
**And** 處理中狀態應使用 `text-yellow-600`
**And** 失敗狀態應使用 `text-red-600`

#### Scenario: Status icons in dark mode

**Given** 使用者使用暗色主題
**When** 文章列表渲染
**Then** 完成狀態應使用 `dark:text-green-400`
**And** 處理中狀態應使用 `dark:text-yellow-400`
**And** 失敗狀態應使用 `dark:text-red-400`
**And** 所有顏色應與暗色背景保持 4.5:1 對比度

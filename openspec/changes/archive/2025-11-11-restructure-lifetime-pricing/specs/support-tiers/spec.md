# Support Tiers Specification

## ADDED Requirements

### Requirement: 客服支援層級分類

系統 SHALL 根據訂閱方案提供四級客服支援，並在定價頁面和 Dashboard 中清晰展示。

#### Scenario: 定義客服支援層級

- **WHEN** 系統初始化客服層級配置
- **THEN** 應定義以下四個層級：
  - **community**: 社群支援
    - 響應時間：無保證
    - 渠道：論壇、文檔
    - 可用性：24/7（自助服務）
  - **standard**: 標準支援
    - 響應時間：48 小時
    - 渠道：Email
    - 可用性：工作日 9:00-18:00
  - **priority**: 優先支援
    - 響應時間：24 小時
    - 渠道：Email、即時聊天
    - 可用性：7×24（聊天僅工作日）
  - **dedicated**: 專屬客戶經理（TAM）
    - 響應時間：4 小時
    - 渠道：電話、Email、即時聊天
    - 可用性：7×24
    - 額外服務：定期業務檢討、專屬聯繫窗口、優先功能請求

#### Scenario: 方案對應客服層級

- **WHEN** 查詢訂閱方案的客服層級
- **THEN** 應使用以下對應關係：
  - FREE → community
  - STARTER → standard
  - PROFESSIONAL → priority
  - BUSINESS → dedicated
  - AGENCY → dedicated

#### Scenario: 客服層級儲存於資料庫

- **WHEN** 建立或更新訂閱方案
- **THEN** `subscription_plans.features` JSONB 應包含 `support_level` 欄位
- **AND** 該欄位值應為：`"community" | "standard" | "priority" | "dedicated"`

### Requirement: 定價頁面顯示客服層級

系統 SHALL 在定價頁面的方案卡片中顯示客服層級資訊。

#### Scenario: 方案卡片顯示客服徽章

- **WHEN** 用戶查看定價頁面的方案卡片
- **THEN** 每個方案應顯示客服層級徽章，包含：
  - 圖示（如 💬 社群、📧 標準、⚡ 優先、👤 專屬）
  - 層級名稱（如「標準支援」）
  - 響應時間（如「48 小時內回覆」）

#### Scenario: 客服層級詳細說明

- **WHEN** 用戶點擊客服層級徽章或查看方案詳情
- **THEN** 應顯示完整客服層級說明，包含：
  - 支援渠道（Email、聊天、電話等）
  - 可用時間（7×24 或工作日）
  - 額外服務（僅 dedicated 層級）

#### Scenario: Dedicated 層級突出 TAM 服務

- **WHEN** 用戶查看 BUSINESS 或 AGENCY 方案
- **THEN** 應特別突出「專屬客戶經理」賣點
- **AND** 列出 TAM 服務內容：
  - 定期業務檢討（每季）
  - 架構穩定性諮詢
  - 主動問題預防
  - 優先功能請求處理

### Requirement: 客服渠道存取控制

系統 SHALL 根據用戶的訂閱層級限制可用的客服渠道。

#### Scenario: 驗證客服渠道存取權限

- **WHEN** 用戶嘗試使用特定客服渠道
- **THEN** 系統應驗證：
  - Email 支援：僅 standard、priority、dedicated 可用（FREE 不可用）
  - 即時聊天：僅 priority、dedicated 可用
  - 電話支援：僅 dedicated 可用

#### Scenario: 不符合層級時顯示升級提示

- **WHEN** FREE 或 STARTER 用戶嘗試使用即時聊天
- **THEN** 系統應顯示：
  - 「此功能需要 PROFESSIONAL 或更高方案」
  - 「立即升級」按鈕，導向定價頁面

#### Scenario: 後端 API 驗證層級

- **WHEN** 用戶提交客服請求（如透過 `/api/support/create-ticket`）
- **THEN** 後端應驗證：
  - 請求的渠道（channel）是否符合用戶的 `support_level`
  - 不符合則返回 `{ success: false, error: '您的方案不支援此渠道，請升級' }`

### Requirement: 客服響應時間 SLA 追蹤

系統 SHALL 追蹤客服請求的響應時間，並監控是否符合 SLA 承諾。

#### Scenario: 記錄客服請求時間戳

- **WHEN** 用戶提交客服請求
- **THEN** 系統應記錄：
  - `created_at`（請求建立時間）
  - `first_response_at`（首次回覆時間）
  - `resolved_at`（問題解決時間）

#### Scenario: 計算響應時間

- **WHEN** 客服人員首次回覆請求
- **THEN** 系統應計算 `response_time = first_response_at - created_at`
- **AND** 與 SLA 目標比較（community: 無, standard: 48h, priority: 24h, dedicated: 4h）

#### Scenario: SLA 違約警告

- **WHEN** 響應時間超過 SLA 目標的 80%（如 standard: 38.4 小時）
- **THEN** 系統應：
  - 向客服團隊發送通知
  - 在客服儀表板標記為「即將違約」
  - 對於 dedicated 層級，通知 TAM

#### Scenario: 客服滿意度調查

- **WHEN** 客服請求被標記為「已解決」
- **THEN** 系統應發送滿意度調查郵件
- **AND** 記錄評分（1-5 星）和反饋
- **AND** 用於計算各層級的平均滿意度

### Requirement: 配置檔案與前端組件

系統 SHALL 提供統一的客服層級配置檔案和可重用的前端組件。

#### Scenario: 建立客服層級配置檔案

- **WHEN** 前端需要客服層級資訊
- **THEN** 應從 `src/config/support-tiers.ts` 讀取
- **AND** 該檔案應導出 `SUPPORT_TIERS` 常數物件

#### Scenario: SupportTierBadge 組件使用

- **WHEN** 需要顯示客服層級徽章
- **THEN** 應使用 `<SupportTierBadge tier={supportTier} />` 組件
- **AND** 該組件應接受 `tier` prop（型別為 SupportTier）
- **AND** 自動顯示圖示、名稱、響應時間

#### Scenario: SupportChannelGuard 組件保護

- **WHEN** 需要限制特定客服渠道的存取
- **THEN** 應使用 `<SupportChannelGuard channel="chat" requiredLevel={2}>` 包裹內容
- **AND** 不符合層級時顯示升級提示

## ADDED Data Models

### Support Tier 型別定義

```typescript
// src/types/support.ts
export type SupportLevel = "community" | "standard" | "priority" | "dedicated";

export type SupportChannel = "forum" | "docs" | "email" | "chat" | "phone";

export interface SupportTier {
  level: SupportLevel;
  label: string;
  description: string;
  response_time: string;
  channels: SupportChannel[];
  availability: string;
  color: string;
  icon: string;
  extras?: string[]; // 額外服務（僅 dedicated）
}

export interface SupportTicket {
  id: string;
  company_id: string;
  user_id: string;
  channel: SupportChannel;
  support_level: SupportLevel;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: Date;
  first_response_at?: Date;
  resolved_at?: Date;
  response_time_hours?: number;
  sla_target_hours: number;
  satisfaction_rating?: number; // 1-5
  satisfaction_feedback?: string;
}
```

### 資料庫 Schema 擴充

```sql
-- 新增客服請求表
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'chat', 'phone', 'forum')),
  support_level TEXT NOT NULL CHECK (support_level IN ('community', 'standard', 'priority', 'dedicated')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMP DEFAULT NOW(),
  first_response_at TIMESTAMP,
  resolved_at TIMESTAMP,
  response_time_hours DECIMAL(10,2),
  sla_target_hours INTEGER NOT NULL,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  satisfaction_feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_support_tickets_company ON support_tickets(company_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX idx_support_tickets_sla ON support_tickets(support_level, status, created_at)
  WHERE status IN ('open', 'in_progress');
```

## ADDED API Endpoints

### GET /api/support/tiers

**用途**：查詢所有客服層級定義

**回應**：

```json
{
  "tiers": [
    {
      "level": "community",
      "label": "社群支援",
      "response_time": "無保證",
      "channels": ["forum", "docs"],
      ...
    },
    ...
  ]
}
```

### POST /api/support/create-ticket

**用途**：建立客服請求

**請求**：

```json
{
  "channel": "email",
  "subject": "無法上傳圖片",
  "description": "詳細問題描述..."
}
```

**驗證**：

- 檢查用戶的 `support_level` 是否支援指定 `channel`
- 計算 `sla_target_hours` 根據層級

**回應**：

```json
{
  "success": true,
  "ticket_id": "uuid",
  "sla_target_hours": 24,
  "estimated_response": "2025-11-12T14:30:00Z"
}
```

### GET /api/support/my-tickets

**用途**：查詢當前用戶的所有客服請求

**查詢參數**：

- `status`: open | in_progress | resolved | closed（可選）
- `page`: 頁碼
- `limit`: 每頁數量

**回應**：

```json
{
  "tickets": [...],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 10,
    "totalPages": 2
  }
}
```

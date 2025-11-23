# Cloudflare R2 儲存遷移

## ADDED Requirements

### Requirement: R2 Bucket 建立和配置

**Priority**: 🟡 High
**Component**: Storage
**Dependencies**: None

系統必須建立 R2 bucket 用於儲存圖片和檔案。

#### Scenario: R2 Bucket 創建成功

**Given**: 已有 Cloudflare 帳號和 API token
**When**: 執行 `wrangler r2 bucket create` 命令
**Then**:

- Bucket 成功建立
- 綁定到 Pages 專案
- 可透過環境變數存取

**Acceptance Criteria**:

- [ ] Bucket 名稱：`auto-pilot-seo-uploads`
- [ ] CORS 配置允許前端上傳
- [ ] 綁定名稱：`UPLOADS`（Pages Functions 中使用）
- [ ] 公開存取 URL 設定

**Implementation Notes**:

```bash
# 建立 R2 bucket
wrangler r2 bucket create auto-pilot-seo-uploads

# 設定 CORS
wrangler r2 bucket cors put auto-pilot-seo-uploads --rules '[
  {
    "AllowedOrigins": ["https://seo.zhenhe-dm.com", "http://localhost:3168"],
    "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]'
```

**wrangler.toml 配置**:

```toml
[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "auto-pilot-seo-uploads"
preview_bucket_name = "auto-pilot-seo-uploads-preview"
```

---

### Requirement: 圖片上傳 API（R2）

**Priority**: 🔴 Critical
**Component**: API
**Dependencies**: R2 Bucket 建立和配置

系統必須提供圖片上傳 API，將檔案儲存到 R2。

#### Scenario: 圖片上傳成功

**Given**: 使用者選擇圖片檔案
**When**: POST 請求到 `/api/upload/image`
**Then**:

- 圖片儲存到 R2
- 返回可存取的 URL
- 資料庫記錄上傳資訊

**Acceptance Criteria**:

- [ ] 支援檔案格式：JPEG, PNG, WebP, GIF
- [ ] 檔案大小限制：10MB
- [ ] 自動生成唯一檔名（UUID）
- [ ] 返回公開 URL
- [ ] 錯誤處理（檔案過大、格式錯誤等）

**Implementation Notes**:

```typescript
// src/app/api/upload/image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "無檔案" }, { status: 400 });
    }

    // 驗證檔案類型
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "不支援的檔案類型" }, { status: 400 });
    }

    // 驗證檔案大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "檔案過大" }, { status: 400 });
    }

    // 生成唯一檔名
    const ext = file.name.split(".").pop();
    const filename = `${crypto.randomUUID()}.${ext}`;
    const key = `images/${new Date().getFullYear()}/${filename}`;

    // 上傳到 R2
    await env.UPLOADS.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // 生成公開 URL
    const url = `https://uploads.seo.zhenhe-dm.com/${key}`;

    return NextResponse.json({ url, key });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "上傳失敗" }, { status: 500 });
  }
}
```

---

### Requirement: 圖片讀取和快取

**Priority**: 🟡 High
**Component**: CDN
**Dependencies**: R2 Bucket 建立和配置

系統必須提供圖片讀取端點，並透過 Cloudflare CDN 快取。

#### Scenario: 圖片讀取和快取

**Given**: 圖片已上傳到 R2
**When**: GET 請求到 `/uploads/images/*`
**Then**:

- 從 R2 讀取圖片
- 設定適當的 Cache-Control headers
- Cloudflare CDN 自動快取

**Acceptance Criteria**:

- [ ] 正確的 Content-Type header
- [ ] Cache-Control: public, max-age=31536000（1年）
- [ ] 支援 ETag
- [ ] 404 處理

**Implementation Notes**:

```typescript
// src/app/uploads/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  try {
    const { env } = getRequestContext();
    const key = params.path.join("/");

    const object = await env.UPLOADS.get(key);

    if (!object) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: object.httpEtag,
      },
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
```

---

## MODIFIED Requirements

### Requirement: 從 Google Drive 遷移到 R2

**Priority**: 🟡 High
**Component**: Migration
**Previous**: 圖片儲存在 Google Drive
**Changes**: 改用 Cloudflare R2

系統必須從 Google Drive 遷移到 R2。

#### Scenario: 遷移策略

**Given**: 現有圖片儲存在 Google Drive
**When**: 執行遷移腳本
**Then**:

- 新上傳使用 R2
- 舊圖片保留在 Google Drive（暫時）
- 可選：批次遷移舊圖片

**Acceptance Criteria**:

- [ ] 新上傳功能使用 R2
- [ ] 舊圖片 URL 仍可存取（透過 Google Drive）
- [ ] 資料庫記錄儲存位置（`storage_type: 'r2' | 'google_drive'`）
- [ ] 遷移腳本可批次轉移舊圖片

**Migration Strategy**:

1. **階段 1（立即）**：新上傳使用 R2
2. **階段 2（可選）**：批次遷移熱門圖片
3. **階段 3（長期）**：完全關閉 Google Drive

**Implementation Notes**:

```typescript
// 更新 GoogleDriveClient → R2Client
// src/lib/storage/r2-client.ts
export class R2Client {
  constructor(private bucket: R2Bucket) {}

  async uploadImage(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<{ url: string; key: string }> {
    const key = `images/${new Date().getFullYear()}/${filename}`;

    await this.bucket.put(key, buffer, {
      httpMetadata: { contentType: mimeType },
    });

    return {
      url: `https://uploads.seo.zhenhe-dm.com/${key}`,
      key,
    };
  }

  async uploadFromUrl(imageUrl: string, filename: string) {
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") || "image/jpeg";

    return this.uploadImage(buffer, filename, mimeType);
  }

  async deleteImage(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
```

---

### Requirement: 資料庫 schema 更新

**Priority**: 🟡 High
**Component**: Database
**Previous**: 儲存 Google Drive file ID
**Changes**: 儲存 R2 key 和 URL

資料庫必須支援 R2 儲存資訊。

#### Scenario: Schema 遷移

**Given**: 現有 `articles` 表有 `wordpress_post_id`
**When**: 新增欄位支援 R2
**Then**:

- 新增 `image_storage_type` 欄位
- 新增 `image_r2_key` 欄位
- 保留相容性

**Acceptance Criteria**:

- [ ] Migration 腳本無錯誤
- [ ] 舊資料不受影響
- [ ] 新資料可儲存 R2 資訊

**Migration SQL**:

```sql
-- 新增儲存類型和 R2 key 欄位
ALTER TABLE articles
ADD COLUMN image_storage_type VARCHAR(20) DEFAULT 'google_drive',
ADD COLUMN image_r2_keys JSONB DEFAULT '[]';

-- 為新欄位加上索引
CREATE INDEX idx_articles_storage_type ON articles(image_storage_type);
```

---

## Testing Requirements

### Requirement: R2 上傳和讀取測試

**Priority**: 🔴 Critical
**Component**: Testing

必須測試 R2 上傳和讀取功能。

#### Scenario: 整合測試

**Given**: R2 bucket 和 API 已配置
**When**: 執行測試腳本
**Then**:

- 上傳測試圖片成功
- 讀取圖片成功
- 刪除圖片成功

**Test Script**:

```bash
#!/bin/bash

API_BASE="http://localhost:8788"

# 測試上傳
echo "測試圖片上傳..."
RESPONSE=$(curl -X POST "$API_BASE/api/upload/image" \
  -F "file=@test-image.jpg")

URL=$(echo $RESPONSE | jq -r '.url')
KEY=$(echo $RESPONSE | jq -r '.key')

if [ -z "$URL" ]; then
  echo "❌ 上傳失敗"
  exit 1
fi

echo "✅ 上傳成功: $URL"

# 測試讀取
echo "測試圖片讀取..."
HTTP_STATUS=$(curl -I "$URL" 2>/dev/null | head -n 1 | cut -d' ' -f2)

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ 讀取失敗 (HTTP $HTTP_STATUS)"
  exit 1
fi

echo "✅ 讀取成功"

# 測試刪除
echo "測試圖片刪除..."
curl -X DELETE "$API_BASE/api/upload/image/$KEY"

echo "✅ 所有測試通過"
```

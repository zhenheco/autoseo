# ✅ Supabase Realtime 完整流程說明

## 🎯 你的需求

> Vercel 前端只做兩件事：
>
> 1. **發出寫文請求**（提交標題）
> 2. **顯示狀態**：
>    - pending → 轉圈圈 🔄
>    - completed → 打勾 ✅

## 🔄 完整流程

```
┌─────────────────┐
│  Vercel 前端    │
│  提交標題       │
└────────┬────────┘
         │
         │ POST /api/articles
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  article_jobs   │
│  status=pending │
└────────┬────────┘
         │
         │ 每 1 分鐘檢查
         │
         ▼
┌─────────────────┐
│  GitHub Actions │
│  並行處理 10 篇 │
│  生成文章       │
└────────┬────────┘
         │
         │ 完成後更新
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  article_jobs   │
│  status=completed│ ← Realtime 觸發！
│  completed_at   │
└────────┬────────┘
         │
         │ Realtime 推送
         │
         ▼
┌─────────────────┐
│  Vercel 前端    │
│  🔄 → ✅        │
│  轉圈變打勾     │
└─────────────────┘
```

## 📋 實作步驟

### 1️⃣ 在文章生成頁面使用 Realtime

```tsx
// app/articles/page.tsx
"use client";

import { ArticleJobStatus } from "@/components/ArticleJobStatus";
import { useSession } from "@/lib/auth";

export default function ArticlesPage() {
  const { user } = useSession();
  const companyId = user?.company_id;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">文章生成管理</h1>

      {/* 提交新文章 */}
      <ArticleSubmitForm companyId={companyId} />

      {/* 即時狀態顯示 */}
      <ArticleJobStatus companyId={companyId} />
    </div>
  );
}
```

### 2️⃣ 提交新文章表單

```tsx
// components/ArticleSubmitForm.tsx
"use client";

import { useState } from "react";

export function ArticleSubmitForm({ companyId }: { companyId: string }) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          companyId,
        }),
      });

      if (response.ok) {
        // 成功！Realtime 會自動更新狀態
        setTitle("");
        alert("文章生成任務已提交！");
      } else {
        throw new Error("提交失敗");
      }
    } catch (error) {
      console.error(error);
      alert("提交失敗，請重試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="輸入文章標題..."
          className="flex-1 rounded-lg border px-4 py-2"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "提交中..." : "生成文章"}
        </button>
      </div>
    </form>
  );
}
```

## 🎨 狀態顯示

| 狀態         | 圖示 | 顏色 | 說明                      |
| ------------ | ---- | ---- | ------------------------- |
| `pending`    | 🕐   | 藍色 | 等待 GitHub Actions 處理  |
| `processing` | 🔄   | 藍色 | 正在生成文章（5-10 分鐘） |
| `completed`  | ✅   | 綠色 | 文章生成完成              |
| `failed`     | ❌   | 紅色 | 生成失敗                  |

## 📊 Supabase Realtime 免費額度

- ✅ **200 並發連接**
- ✅ **無限訊息數量**
- ✅ **完全免費**

對你的使用場景完全足夠！

## 🔧 已完成項目

- ✅ orchestrator 設定 `completed_at` 時間戳
- ✅ `useArticleJobRealtime` hook（監聽狀態變更）
- ✅ `ArticleJobStatus` 組件（顯示狀態）
- ✅ GitHub Actions 每分鐘執行
- ✅ 並行處理 10 篇文章

## 🚀 下一步

1. 在你的文章管理頁面使用 `ArticleJobStatus` 組件
2. 測試即時更新：提交文章 → 看到轉圈圈 → 1 分鐘後開始處理 → 5-10 分鐘後變打勾
3. 可選：加上 toast 通知（完成時彈出提示）

完成！🎉

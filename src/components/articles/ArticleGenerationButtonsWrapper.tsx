"use client";

import { useRouter } from "next/navigation";
import { ArticleGenerationButtons } from "./ArticleGenerationButtons";
import { useState } from "react";
import { toast } from "sonner";

interface GenerationItem {
  keyword: string;
  title: string;
  targetLanguage: string;
  wordCount: string;
}

interface ArticleGenerationButtonsWrapperProps {
  buttonText?: string;
}

export function ArticleGenerationButtonsWrapper({
  buttonText,
}: ArticleGenerationButtonsWrapperProps = {}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleBatchGenerate = async (
    items: GenerationItem[],
  ): Promise<boolean> => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/articles/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            keyword: item.keyword,
            title: item.title,
          })),
          options: {
            targetLanguage: items[0]?.targetLanguage || "zh-TW",
            wordCount: items[0]?.wordCount || "1500",
          },
        }),
      });

      // 先用 text() 讀取，再嘗試解析為 JSON（避免 504 HTML 頁面導致 JSON 解析錯誤）
      const text = await response.text();
      let data: { error?: string; message?: string };

      try {
        data = JSON.parse(text);
      } catch {
        // text 不是 JSON（如 504 HTML 頁面）
        if (response.status === 504) {
          throw new Error("請求超時，請稍後重試");
        }
        throw new Error(`伺服器錯誤 (${response.status})`);
      }

      if (response.status === 402) {
        toast.error("Token 餘額不足", {
          description: data.message || "無法生成文章",
          action: {
            label: "立即升級",
            onClick: () => router.push("/dashboard/billing/upgrade"),
          },
          duration: 10000,
        });
        setIsGenerating(false);
        return false;
      }

      if (!response.ok) {
        throw new Error(data.error || "批次生成失敗");
      }

      toast.success(`已提交 ${items.length} 篇文章生成任務`, {
        description: "文章正在生成中，請稍後查看列表",
      });

      window.dispatchEvent(new Event("articlesUpdated"));
      router.refresh();
      return true;
    } catch (error) {
      console.error("Batch generate error:", error);
      toast.error("批次生成失敗", {
        description: (error as Error).message,
      });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ArticleGenerationButtons
      onBatchGenerate={handleBatchGenerate}
      buttonText={buttonText}
    />
  );
}

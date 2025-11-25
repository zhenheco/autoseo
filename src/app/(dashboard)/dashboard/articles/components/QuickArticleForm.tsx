"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRouter } from "next/navigation";

interface QuotaStatus {
  plan: string;
  quota: number;
  used: number;
  remaining: number;
  canUseCompetitors: boolean;
  month: string;
}

interface QuickArticleFormProps {
  quotaStatus: QuotaStatus | null;
}

export function QuickArticleForm({ quotaStatus }: QuickArticleFormProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [batchKeywords, setBatchKeywords] = useState("");
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasRemainingQuota = quotaStatus
    ? quotaStatus.remaining > 0 || quotaStatus.quota === -1
    : true;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "single") {
        const response = await fetch("/api/articles/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: keyword.trim(),
            title: keyword.trim(),
            mode: "single",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || "生成失敗");
        }

        router.refresh();
      } else {
        const keywords = batchKeywords
          .split("\n")
          .map((k) => k.trim())
          .filter((k) => k.length > 0);

        if (keywords.length === 0) {
          throw new Error("請輸入至少一個關鍵字");
        }

        const response = await fetch("/api/articles/generate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || "批量生成失敗");
        }

        router.refresh();
      }
    } catch (error) {
      console.error("提交失敗:", error);
      const errorMessage =
        error instanceof Error ? error.message : "生成失敗，請稍後再試";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3 rounded-lg border p-4 bg-muted/50">
        <Label className="text-base font-medium">生成模式</Label>
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as "single" | "batch")}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single" id="single" />
            <Label htmlFor="single" className="font-normal cursor-pointer">
              單篇文章
              <span className="text-xs text-muted-foreground ml-2">
                （輸入一個關鍵字，生成一篇文章）
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="batch" id="batch" />
            <Label htmlFor="batch" className="font-normal cursor-pointer">
              批量生成
              <span className="text-xs text-muted-foreground ml-2">
                （輸入多個關鍵字，每個生成一篇文章）
              </span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {mode === "single" ? (
        <div className="space-y-2">
          <Label htmlFor="keyword">關鍵字 *</Label>
          <Input
            id="keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="例如：AI 行銷工具"
            required
            disabled={!hasRemainingQuota}
          />
          <p className="text-sm text-muted-foreground">
            輸入您想生成文章的主題關鍵字，AI 會自動生成完整的 SEO 文章
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="batchKeywords">關鍵字列表 *</Label>
          <Textarea
            id="batchKeywords"
            value={batchKeywords}
            onChange={(e) => setBatchKeywords(e.target.value)}
            placeholder={
              "AI 行銷工具\n數位轉型策略\n電商物流優化\nSEO 關鍵字研究"
            }
            rows={6}
            required
            disabled={!hasRemainingQuota}
          />
          <p className="text-sm text-muted-foreground">
            每行輸入一個關鍵字，系統會為每個關鍵字生成一篇文章
          </p>
          {batchKeywords.trim() && (
            <p className="text-sm text-primary">
              將生成 {batchKeywords.split("\n").filter((k) => k.trim()).length}{" "}
              篇文章
            </p>
          )}
        </div>
      )}

      {!hasRemainingQuota && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          您的配額已用完，請升級方案以繼續使用
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || !hasRemainingQuota}
      >
        {isSubmitting
          ? "生成中..."
          : mode === "single"
            ? "開始生成文章"
            : `開始批量生成 (${batchKeywords.split("\n").filter((k) => k.trim()).length || 0} 篇)`}
      </Button>
    </form>
  );
}

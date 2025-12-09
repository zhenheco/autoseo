"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithRetry } from "@/lib/utils/fetch-with-retry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface QuickArticleFormProps {
  websiteId: string | null;
  industry: string;
  region: string;
  language: string;
}

export function QuickArticleForm({
  websiteId,
  industry,
  region,
  language,
}: QuickArticleFormProps) {
  const router = useRouter();
  const [batchKeywords, setBatchKeywords] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [generatedKeyword, setGeneratedKeyword] = useState("");
  const [retryInfo, setRetryInfo] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  const TOKENS_PER_ARTICLE = 3000;

  useEffect(() => {
    const fetchTokenBalance = async () => {
      try {
        const response = await fetch("/api/token-balance");
        if (response.ok) {
          const data = await response.json();
          setTokenBalance(data.balance?.available ?? data.balance?.total ?? 0);
        }
      } catch (error) {
        console.error("獲取餘額失敗:", error);
      } finally {
        setIsLoadingBalance(false);
      }
    };
    fetchTokenBalance();
  }, []);

  const hasRemainingQuota =
    isLoadingBalance || tokenBalance >= TOKENS_PER_ARTICLE;

  const isFormDisabled = !hasRemainingQuota;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setRetryInfo(null);

    try {
      const keywords = batchKeywords
        .split("\n")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      if (keywords.length === 0) {
        throw new Error("請輸入至少一個關鍵字");
      }

      // 使用自動重試的 fetch
      const response = await fetchWithRetry(
        "/api/articles/generate-batch",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords,
            industry,
            region,
            targetLanguage: language,
            website_id: websiteId,
          }),
        },
        {
          maxRetries: 2,
          delayMs: 1500,
          onRetry: (attempt, max) => {
            setRetryInfo(`正在重試 (${attempt}/${max})...`);
          },
        },
      );

      // 先用 text() 讀取，再嘗試解析為 JSON
      const text = await response.text();
      let data: {
        success?: boolean;
        error?: string;
        message?: string;
        newJobs?: number;
        skippedJobs?: number;
      };

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`伺服器錯誤 (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || "批量生成失敗");
      }

      if (!data.success) {
        throw new Error(data.error || "未能建立任何任務");
      }

      window.dispatchEvent(new Event("tokenReserved"));

      const newJobs = data.newJobs || 0;
      const skippedJobs = data.skippedJobs || 0;
      let message = "";
      if (newJobs > 0) {
        message = `${newJobs} 篇新文章`;
        if (skippedJobs > 0) {
          message += `（${skippedJobs} 篇已在處理中）`;
        }
      } else if (skippedJobs > 0) {
        message = `${skippedJobs} 篇文章已在處理中`;
      }

      setGeneratedKeyword(message || `${keywords.length} 篇文章`);
      setShowSuccessDialog(true);
      setBatchKeywords("");
    } catch (error) {
      console.error("提交失敗:", error);
      const errorMessage =
        error instanceof Error ? error.message : "生成失敗，請稍後再試";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
      setRetryInfo(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          disabled={isFormDisabled}
        />
        <p className="text-sm text-muted-foreground">
          每行輸入一個關鍵字，系統會為每個關鍵字生成一篇文章（輸入單一關鍵字也可以）
        </p>
        {batchKeywords.trim() && (
          <p className="text-sm text-primary">
            將生成 {batchKeywords.split("\n").filter((k) => k.trim()).length}{" "}
            篇文章
          </p>
        )}
      </div>

      {!hasRemainingQuota && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          您的配額已用完，請升級方案以繼續使用
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || isFormDisabled}
      >
        {isSubmitting
          ? retryInfo || "正在提交任務..."
          : `開始生成 (${batchKeywords.split("\n").filter((k) => k.trim()).length || 0} 篇)`}
      </Button>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              生成任務已建立
            </DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-medium text-foreground">
                {generatedKeyword}
              </span>{" "}
              正在生成中
              <br />
              <span className="text-muted-foreground">
                您可以關閉此視窗，在網站詳情頁查看進度
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
            >
              繼續生成其他文章
            </Button>
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                router.push("/dashboard/articles/manage");
              }}
            >
              查看文章
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

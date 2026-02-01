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
import { AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("articles.quick");
  const [batchKeywords, setBatchKeywords] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [generatedKeyword, setGeneratedKeyword] = useState("");
  const [retryInfo, setRetryInfo] = useState<string | null>(null);
  const [articleBalance, setArticleBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDialogData, setErrorDialogData] = useState<{
    maxArticles: number;
    requiredArticles: number;
    availableArticles: number;
  } | null>(null);

  useEffect(() => {
    // 使用篇數制 API
    const fetchArticleQuota = async () => {
      try {
        const response = await fetch("/api/article-quota");
        if (response.ok) {
          const data = await response.json();
          setArticleBalance(data.balance?.available ?? 0);
        }
      } catch (error) {
        console.error("Failed to fetch article quota:", error);
      } finally {
        setIsLoadingBalance(false);
      }
    };
    fetchArticleQuota();
  }, []);

  // 計算關鍵字數量（篇數制：1 篇 = 1 篇額度）
  const keywordCount = batchKeywords.split("\n").filter((k) => k.trim()).length;
  const requiredArticles = keywordCount; // 篇數制：需要的篇數 = 關鍵字數量
  const maxArticles = articleBalance; // 篇數制：最多可生成篇數 = 剩餘額度

  // 根據關鍵字數量檢查配額
  const hasRemainingQuota =
    isLoadingBalance ||
    keywordCount === 0 ||
    articleBalance >= requiredArticles;

  const isFormDisabled = articleBalance < 1 && !isLoadingBalance;

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
        throw new Error(t("enterAtLeastOneKeyword"));
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
            setRetryInfo(t("retrying", { attempt, max }));
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
        maxArticles?: number;
        requiredCredits?: number;
        availableCredits?: number;
      };

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(t("serverError", { status: response.status }));
      }

      // 處理 402 餘額不足錯誤，顯示彈跳視窗
      if (response.status === 402 && data.maxArticles !== undefined) {
        setErrorDialogData({
          maxArticles: data.maxArticles,
          requiredArticles: data.requiredCredits || 0, // API 暫時還是返回 requiredCredits
          availableArticles: data.availableCredits || 0, // API 暫時還是返回 availableCredits
        });
        setShowErrorDialog(true);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || t("batchGenerateFailed"));
      }

      if (!data.success) {
        throw new Error(data.error || t("noTaskCreated"));
      }

      window.dispatchEvent(new Event("tokenReserved"));

      const newJobs = data.newJobs || 0;
      const skippedJobs = data.skippedJobs || 0;
      let message = "";
      if (newJobs > 0) {
        message = t("newArticles", { count: newJobs });
        if (skippedJobs > 0) {
          message += t("processingArticles", { count: skippedJobs });
        }
      } else if (skippedJobs > 0) {
        message = t("articlesProcessing", { count: skippedJobs });
      }

      setGeneratedKeyword(message || t("articlesCount", { count: keywords.length }));
      setShowSuccessDialog(true);
      setBatchKeywords("");
    } catch (error) {
      console.error("Submit failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : t("generateFailed");
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
      setRetryInfo(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="batchKeywords">{t("keywordList")}</Label>
        <Textarea
          id="batchKeywords"
          value={batchKeywords}
          onChange={(e) => setBatchKeywords(e.target.value)}
          placeholder={t("keywordPlaceholder")}
          rows={6}
          required
          disabled={isFormDisabled}
        />
        <p className="text-sm text-muted-foreground">
          {t("keywordHint")}
        </p>
        {batchKeywords.trim() && (
          <p className="text-sm text-primary">{t("willGenerate", { count: keywordCount })}</p>
        )}
        {!isLoadingBalance && keywordCount > 0 && !hasRemainingQuota && (
          <p className="text-sm text-red-500">
            {t("insufficientCredits", { max: maxArticles, balance: articleBalance })}
          </p>
        )}
      </div>

      {isFormDisabled && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {t("quotaExhausted")}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || isFormDisabled || !hasRemainingQuota}
      >
        {isSubmitting
          ? retryInfo || t("submittingTask")
          : t("startGenerate", { count: keywordCount || 0 })}
      </Button>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              {t("taskCreated")}
            </DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-medium text-foreground">
                {generatedKeyword}
              </span>{" "}
              {t("generating")}
              <br />
              <span className="text-muted-foreground">
                {t("closeAndViewProgress")}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
            >
              {t("continueGenerateOther")}
            </Button>
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                router.push("/dashboard/articles/manage");
              }}
            >
              {t("viewArticles")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 額度不足錯誤彈跳視窗 */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              {t("insufficientCreditsTitle")}
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2">
              {errorDialogData && (
                <>
                  <p className="text-foreground font-medium">
                    {t("currentQuotaLimit", { max: errorDialogData.maxArticles })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("needCredits", {
                      required: errorDialogData.requiredArticles,
                      available: errorDialogData.availableArticles,
                    })}
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowErrorDialog(false)}>
              {t("understand")}
            </Button>
            <Button asChild>
              <Link href="/dashboard/billing/upgrade">{t("upgradePlan")}</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}

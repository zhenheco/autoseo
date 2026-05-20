"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { trackArticleGeneration } from "@/lib/analytics/events";
import { useTranslations } from "next-intl";

interface ArticleFormProps {
  websiteId: string | null;
  industry: string;
  region: string;
  language: string;
  writingStyle?: string;
}

export function ArticleForm({
  websiteId,
  industry,
  region,
  language,
  writingStyle,
}: ArticleFormProps) {
  const router = useRouter();
  const t = useTranslations("articles.form");
  const tCommon = useTranslations("common");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryInfo, setRetryInfo] = useState<string | null>(null);

  const [titleMode, setTitleMode] = useState<"auto" | "preview">("auto");
  const [isLoadingTitles, setIsLoadingTitles] = useState(false);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);

  const [articleBalance, setArticleBalance] = useState<number>(0);
  const [articleCount, setArticleCount] = useState<number>(1);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  // 篇數制：最多可生成篇數 = 剩餘額度
  const maxArticles = articleBalance;
  const isInsufficientCredits = articleCount > maxArticles;

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

  const handlePreviewTitles = async () => {
    // 主題是必填的核心欄位
    if (!industry?.trim()) {
      alert(t("topicRequired"));
      return;
    }

    // region 和 language 如果沒填，使用預設值（不阻擋用戶）
    const effectiveRegion = region?.trim() || "taiwan";
    const effectiveLanguage = language?.trim() || "zh-TW";

    setIsLoadingTitles(true);
    try {
      const response = await fetch("/api/articles/preview-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          region: effectiveRegion,
          language: effectiveLanguage,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t("titleGenerateFailed"));
      }

      // 修正：從 data 屬性取得 titles（符合 successResponse 統一格式）
      const titles = result.data?.titles;
      if (!titles?.length) {
        throw new Error(t("cannotGenerateTitle"));
      }

      setTitleOptions(titles);
      setSelectedTitles([titles[0]]);
      setShowTitleDialog(true);
    } catch (error) {
      console.error("Title preview failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : t("titleGenerateFailed");
      alert(errorMessage);
    } finally {
      setIsLoadingTitles(false);
    }
  };

  const handleTitleToggle = (title: string) => {
    setSelectedTitles((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const handleConfirmTitle = async () => {
    if (selectedTitles.length === 0) return;
    setShowTitleDialog(false);
    setIsSubmitting(true);
    setRetryInfo(null);

    try {
      for (const title of selectedTitles) {
        await submitArticleWithoutRedirect(title);
      }
      window.dispatchEvent(new Event("tokenReserved"));
      setGeneratedTitles([...selectedTitles]);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Batch generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : t("generateFailed");
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
      setRetryInfo(null);
    }
  };

  const submitArticleWithoutRedirect = async (title?: string) => {
    // 使用自動重試的 fetch
    const response = await fetchWithRetry(
      "/api/articles/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          region,
          language,
          ...(title && { title }),
          website_id: websiteId,
          ...(writingStyle && { writing_style: writingStyle }),
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
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(t("serverError", { status: response.status }));
    }

    if (!response.ok) {
      throw new Error(data.message || data.error || t("articleGenerateFailed"));
    }

    // GA4 追蹤：文章生成任務已建立
    trackArticleGeneration(
      data.jobId || data.data?.jobId || "unknown",
      [industry, region, language].filter(Boolean),
    );

    return data;
  };

  const submitArticle = async (title?: string) => {
    setIsSubmitting(true);
    setRetryInfo(null);
    try {
      await submitArticleWithoutRedirect(title);
      window.dispatchEvent(new Event("tokenReserved"));
      setGeneratedTitles(title ? [title] : []);
      setShowSuccessDialog(true);
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

  const submitMultipleArticles = async (count: number) => {
    setIsSubmitting(true);
    setRetryInfo(null);
    try {
      const generatedList: string[] = [];
      for (let i = 0; i < count; i++) {
        await submitArticleWithoutRedirect();
        generatedList.push(t("article", { index: i + 1 }));
      }
      window.dispatchEvent(new Event("tokenReserved"));
      setGeneratedTitles(generatedList);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Batch generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : t("generateFailed");
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
      setRetryInfo(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 主題是必填欄位
    if (!industry || industry.trim() === "") {
      alert(t("topicRequiredSimple"));
      return;
    }

    // 地區是必填欄位
    if (!region || region.trim() === "") {
      alert(t("regionRequired"));
      return;
    }

    if (titleMode === "preview") {
      await handlePreviewTitles();
    } else {
      if (isInsufficientCredits) {
        alert(t("insufficientCreditsAlert", { max: maxArticles }));
        return;
      }
      if (articleCount > 1) {
        await submitMultipleArticles(articleCount);
      } else {
        await submitArticle();
      }
    }
  };

  function getSubmitButtonLabel(): string {
    if (isSubmitting) return retryInfo || t("submittingTask");
    if (isLoadingTitles) return t("generatingTitles");
    if (titleMode === "preview") return t("generateTitleOptions");
    if (articleCount > 1)
      return t("startGenerateArticles", { count: articleCount });
    return t("startGenerateArticle");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3 rounded-lg border p-4 bg-muted/50">
        <Label className="text-base font-medium">
          {t("titleGenerationMode")}
        </Label>
        <RadioGroup
          value={titleMode}
          onValueChange={(value) => setTitleMode(value as "auto" | "preview")}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="auto" id="auto" />
            <Label htmlFor="auto" className="font-normal cursor-pointer">
              {t("aiAutoSelectTitle")}
              <span className="text-xs text-muted-foreground ml-2">
                {t("aiAutoSelectTitleHint")}
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="preview" id="preview" />
            <Label htmlFor="preview" className="font-normal cursor-pointer">
              {t("previewTitleOptions")}
              <span className="text-xs text-muted-foreground ml-2">
                {t("previewTitleOptionsHint")}
              </span>
            </Label>
          </div>
        </RadioGroup>

        {titleMode === "auto" && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <Label htmlFor="articleCount">{t("articleCount")}</Label>
            <div className="flex items-center gap-3">
              <Input
                id="articleCount"
                type="number"
                min={1}
                max={maxArticles > 0 ? maxArticles : 1}
                value={articleCount}
                onChange={(e) =>
                  setArticleCount(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-24"
                disabled={isLoadingBalance}
              />
              <span className="text-sm text-muted-foreground">
                {isLoadingBalance
                  ? t("loadingBalance")
                  : t("maxArticlesHint", {
                      max: maxArticles,
                      balance: articleBalance,
                    })}
              </span>
            </div>
            {isInsufficientCredits && !isLoadingBalance && (
              <p className="text-sm text-red-500">
                {t("insufficientCredits", { max: maxArticles })}
              </p>
            )}
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={
          isSubmitting ||
          isLoadingTitles ||
          (titleMode === "auto" && isInsufficientCredits)
        }
      >
        {getSubmitButtonLabel()}
      </Button>

      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t("selectArticleTitle")}</DialogTitle>
            <DialogDescription>{t("titleDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {titleOptions.map((title, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTitles.includes(title)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => handleTitleToggle(title)}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedTitles.includes(title)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">{title}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowTitleDialog(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleConfirmTitle}
              disabled={selectedTitles.length === 0 || isSubmitting}
            >
              {isSubmitting
                ? t("generating")
                : selectedTitles.length > 1
                  ? t("generateMultipleArticles", {
                      count: selectedTitles.length,
                    })
                  : t("useThisTitleGenerate")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              {t("taskCreated")}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {generatedTitles.length > 1 ? (
                <>
                  {t("articlesCreatedCount", { count: generatedTitles.length })}
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {generatedTitles[0]}
                  </span>{" "}
                  {t("articleGenerating")}
                </>
              )}
              <br />
              <span className="text-muted-foreground">
                {t("closeAndViewProgress")}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccessDialog(false);
                setSelectedTitles([]);
              }}
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
    </form>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const INDUSTRIES = [
  { value: "tech", label: "科技" },
  { value: "finance", label: "金融" },
  { value: "healthcare", label: "醫療" },
  { value: "education", label: "教育" },
  { value: "realestate", label: "房地產" },
  { value: "travel", label: "旅遊" },
  { value: "food", label: "餐飲" },
  { value: "ecommerce", label: "電商" },
  { value: "legal", label: "法律" },
  { value: "manufacturing", label: "製造業" },
  { value: "other", label: "其他" },
];

const REGIONS = [
  { value: "taiwan", label: "台灣" },
  { value: "japan", label: "日本" },
  { value: "usa", label: "美國" },
  { value: "singapore", label: "新加坡" },
  { value: "hongkong", label: "香港" },
  { value: "china", label: "中國" },
  { value: "korea", label: "韓國" },
  { value: "global", label: "全球" },
  { value: "other", label: "其他" },
];

interface QuotaStatus {
  plan: string;
  quota: number;
  used: number;
  remaining: number;
  canUseCompetitors: boolean;
  month: string;
}

interface ArticleFormProps {
  quotaStatus: QuotaStatus | null;
  websiteId: string | null;
}

export function ArticleForm({ quotaStatus, websiteId }: ArticleFormProps) {
  const router = useRouter();
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [language, setLanguage] = useState("zh-TW");
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [titleMode, setTitleMode] = useState<"auto" | "preview">("auto");
  const [isLoadingTitles, setIsLoadingTitles] = useState(false);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);

  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [articleCount, setArticleCount] = useState<number>(1);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);

  const TOKENS_PER_ARTICLE = 3000;
  const maxArticles = Math.floor(tokenBalance / TOKENS_PER_ARTICLE);
  const isInsufficientCredits = articleCount > maxArticles;

  useEffect(() => {
    const stored = localStorage.getItem("preferred-language");
    if (stored) {
      setLanguage(stored);
    }

    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setLanguage(customEvent.detail);
    };

    window.addEventListener("languageChanged", handleLanguageChange);
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange);
    };
  }, []);

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

  const canAddCompetitors = quotaStatus?.canUseCompetitors ?? false;
  const hasRemainingQuota = quotaStatus
    ? quotaStatus.remaining > 0 || quotaStatus.quota === -1
    : true;

  const handleAddCompetitor = () => {
    if (competitors.length < 5) {
      setCompetitors([...competitors, ""]);
    }
  };

  const handleRemoveCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const handleCompetitorChange = (index: number, value: string) => {
    const newCompetitors = [...competitors];
    newCompetitors[index] = value;
    setCompetitors(newCompetitors);
  };

  const handlePreviewTitles = async () => {
    setIsLoadingTitles(true);
    try {
      const response = await fetch("/api/articles/preview-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: industry === "other" ? customIndustry : industry,
          region: region === "other" ? customRegion : region,
          language,
          competitors: competitors.filter((c) => c.trim() !== ""),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "標題生成失敗");
      }

      setTitleOptions(data.titles || []);
      setSelectedTitles(data.titles?.[0] ? [data.titles[0]] : []);
      setShowTitleDialog(true);
    } catch (error) {
      console.error("標題預覽失敗:", error);
      const errorMessage =
        error instanceof Error ? error.message : "標題生成失敗";
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

    try {
      for (const title of selectedTitles) {
        await submitArticleWithoutRedirect(title);
      }
      setGeneratedTitles([...selectedTitles]);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("批量生成失敗:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitArticleWithoutRedirect = async (title?: string) => {
    const response = await fetch("/api/articles/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        industry: industry === "other" ? customIndustry : industry,
        region: region === "other" ? customRegion : region,
        language,
        competitors: competitors.filter((c) => c.trim() !== ""),
        ...(title && { title }),
        website_id: websiteId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "文章生成失敗");
    }

    return response.json();
  };

  const submitArticle = async (title?: string) => {
    setIsSubmitting(true);
    try {
      await submitArticleWithoutRedirect(title);
      setGeneratedTitles(title ? [title] : []);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("提交失敗:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitMultipleArticles = async (count: number) => {
    setIsSubmitting(true);
    try {
      const generatedList: string[] = [];
      for (let i = 0; i < count; i++) {
        await submitArticleWithoutRedirect();
        generatedList.push(`文章 ${i + 1}`);
      }
      setGeneratedTitles(generatedList);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("批量生成失敗:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const actualIndustry = industry === "other" ? customIndustry : industry;
    const actualRegion = region === "other" ? customRegion : region;

    if (!actualIndustry || actualIndustry.trim() === "") {
      alert("請選擇或輸入產業");
      return;
    }

    if (!actualRegion || actualRegion.trim() === "") {
      alert("請選擇或輸入地區");
      return;
    }

    if (titleMode === "preview") {
      await handlePreviewTitles();
    } else {
      if (isInsufficientCredits) {
        alert(`Credits 不足！您目前只能生成 ${maxArticles} 篇文章`);
        return;
      }
      if (articleCount > 1) {
        await submitMultipleArticles(articleCount);
      } else {
        await submitArticle();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="industry">產業 *</Label>
        <Select value={industry} onValueChange={setIndustry} required>
          <SelectTrigger id="industry">
            <SelectValue placeholder="請選擇產業" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((ind) => (
              <SelectItem key={ind.value} value={ind.value}>
                {ind.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {industry === "other" && (
          <Input
            id="customIndustry"
            value={customIndustry}
            onChange={(e) => setCustomIndustry(e.target.value)}
            placeholder="請輸入您的產業"
            required
            className="mt-2"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="region">地區 *</Label>
        <Select value={region} onValueChange={setRegion} required>
          <SelectTrigger id="region">
            <SelectValue placeholder="請選擇目標地區" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((reg) => (
              <SelectItem key={reg.value} value={reg.value}>
                {reg.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {region === "other" && (
          <Input
            id="customRegion"
            value={customRegion}
            onChange={(e) => setCustomRegion(e.target.value)}
            placeholder="請輸入您的目標地區"
            required
            className="mt-2"
          />
        )}
      </div>

      {canAddCompetitors && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>
              競爭對手網站（選填，最多 5 個）
              {quotaStatus && quotaStatus.plan !== "free" && (
                <span className="text-xs text-muted-foreground ml-2">
                  ⚡ 付費功能
                </span>
              )}
            </Label>
            {!hasRemainingQuota && (
              <span className="text-xs text-red-600">配額已用完</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            輸入競爭對手的網站 URL，系統將使用 AI 深度分析他們的內容策略
          </p>
          {competitors.map((competitor, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="url"
                value={competitor}
                onChange={(e) => handleCompetitorChange(index, e.target.value)}
                placeholder="https://example.com"
                className="flex-1"
                disabled={!hasRemainingQuota}
              />
              {competitors.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRemoveCompetitor(index)}
                  disabled={!hasRemainingQuota}
                >
                  移除
                </Button>
              )}
            </div>
          ))}
          {competitors.length < 5 && hasRemainingQuota && (
            <Button
              type="button"
              variant="outline"
              onClick={handleAddCompetitor}
              className="w-full mt-2"
            >
              + 新增競爭對手
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3 rounded-lg border p-4 bg-muted/50">
        <Label className="text-base font-medium">標題生成模式</Label>
        <RadioGroup
          value={titleMode}
          onValueChange={(value) => setTitleMode(value as "auto" | "preview")}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="auto" id="auto" />
            <Label htmlFor="auto" className="font-normal cursor-pointer">
              AI 自動選擇最佳標題
              <span className="text-xs text-muted-foreground ml-2">
                （系統會自動評分並選擇最適合的標題）
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="preview" id="preview" />
            <Label htmlFor="preview" className="font-normal cursor-pointer">
              先預覽標題選項
              <span className="text-xs text-muted-foreground ml-2">
                （AI 生成多個標題供您選擇）
              </span>
            </Label>
          </div>
        </RadioGroup>

        {titleMode === "auto" && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <Label htmlFor="articleCount">生成文章數量</Label>
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
                  ? "載入中..."
                  : `最多可生成 ${maxArticles} 篇（餘額 ${tokenBalance.toLocaleString()} credits）`}
              </span>
            </div>
            {isInsufficientCredits && !isLoadingBalance && (
              <p className="text-sm text-red-500">
                ⚠️ Credits 不足！您目前只能生成 {maxArticles} 篇文章
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
        {isSubmitting
          ? "生成中..."
          : isLoadingTitles
            ? "正在生成標題..."
            : titleMode === "preview"
              ? "生成標題選項"
              : articleCount > 1
                ? `開始生成 ${articleCount} 篇文章`
                : "開始生成文章"}
      </Button>

      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>選擇文章標題</DialogTitle>
            <DialogDescription>
              AI 根據您的產業和地區生成了以下標題，可多選生成多篇文章
            </DialogDescription>
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
              取消
            </Button>
            <Button
              onClick={handleConfirmTitle}
              disabled={selectedTitles.length === 0 || isSubmitting}
            >
              {isSubmitting
                ? "生成中..."
                : selectedTitles.length > 1
                  ? `生成 ${selectedTitles.length} 篇文章`
                  : "使用此標題生成文章"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              生成任務已建立
            </DialogTitle>
            <DialogDescription className="pt-2">
              {generatedTitles.length > 1 ? (
                <>
                  已建立{" "}
                  <span className="font-medium text-foreground">
                    {generatedTitles.length}
                  </span>{" "}
                  篇文章生成任務
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {generatedTitles[0]}
                  </span>{" "}
                  正在生成中
                </>
              )}
              <br />
              <span className="text-muted-foreground">
                您可以關閉此視窗，在網站詳情頁查看進度
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

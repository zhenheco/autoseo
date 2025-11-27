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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createArticle } from "../actions";
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
  const [selectedTitle, setSelectedTitle] = useState("");
  const [showTitleDialog, setShowTitleDialog] = useState(false);

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
      setSelectedTitle(data.titles?.[0] || "");
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

  const handleConfirmTitle = async () => {
    if (!selectedTitle) return;
    setShowTitleDialog(false);
    await submitArticle(selectedTitle);
  };

  const submitArticle = async (title?: string) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append(
        "industry",
        industry === "other" ? customIndustry : industry,
      );
      formData.append("region", region === "other" ? customRegion : region);
      formData.append("language", language);
      if (title) {
        formData.append("title", title);
      }
      if (websiteId) {
        formData.append("website_id", websiteId);
      }

      const validCompetitors = competitors.filter((c) => c.trim() !== "");
      formData.append("competitors", JSON.stringify(validCompetitors));

      await createArticle(formData);
      router.push(
        websiteId ? `/dashboard/websites/${websiteId}` : "/dashboard/websites",
      );
    } catch (error) {
      console.error("提交失敗:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (titleMode === "preview") {
      await handlePreviewTitles();
    } else {
      await submitArticle();
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
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting || isLoadingTitles}
      >
        {isSubmitting
          ? "生成中..."
          : isLoadingTitles
            ? "正在生成標題..."
            : titleMode === "preview"
              ? "生成標題選項"
              : "開始生成文章"}
      </Button>

      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>選擇文章標題</DialogTitle>
            <DialogDescription>
              AI 根據您的產業和地區生成了以下標題，請選擇最適合的一個
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {titleOptions.map((title, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTitle === title
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedTitle(title)}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedTitle === title}
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
              disabled={!selectedTitle || isSubmitting}
            >
              {isSubmitting ? "生成中..." : "使用此標題生成文章"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

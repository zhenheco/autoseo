"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface Language {
  code: string;
  name: string;
  flag: string;
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
  { code: "zh-CN", name: "简体中文", flag: "🇨🇳" },
  { code: "en-US", name: "English", flag: "🇺🇸" },
  { code: "ja-JP", name: "日本語", flag: "🇯🇵" },
  { code: "ko-KR", name: "한국어", flag: "🇰🇷" },
  { code: "vi-VN", name: "Tiếng Việt", flag: "🇻🇳" },
  { code: "ms-MY", name: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "th-TH", name: "ไทย", flag: "🇹🇭" },
  { code: "id-ID", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "tl-PH", name: "Filipino", flag: "🇵🇭" },
  { code: "fr-FR", name: "Français", flag: "🇫🇷" },
  { code: "de-DE", name: "Deutsch", flag: "🇩🇪" },
  { code: "es-ES", name: "Español", flag: "🇪🇸" },
  { code: "pt-PT", name: "Português", flag: "🇵🇹" },
  { code: "it-IT", name: "Italiano", flag: "🇮🇹" },
  { code: "ru-RU", name: "Русский", flag: "🇷🇺" },
  { code: "ar-SA", name: "العربية", flag: "🇸🇦" },
  { code: "hi-IN", name: "हिन्दी", flag: "🇮🇳" },
];

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
  websiteId: string | null;
}

export function QuickArticleForm({
  quotaStatus,
  websiteId,
}: QuickArticleFormProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [batchKeywords, setBatchKeywords] = useState("");
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [language, setLanguage] = useState("zh-TW");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [generatedKeyword, setGeneratedKeyword] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("preferred-language");
    if (stored) {
      setLanguage(stored);
    }
  }, []);

  const hasRemainingQuota = quotaStatus
    ? quotaStatus.remaining > 0 || quotaStatus.quota === -1
    : true;

  const isFormDisabled = !hasRemainingQuota;

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
            industry: industry === "other" ? customIndustry : industry,
            region: region === "other" ? customRegion : region,
            language,
            website_id: websiteId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || "生成失敗");
        }

        setGeneratedKeyword(keyword.trim());
        setShowSuccessDialog(true);
        setKeyword("");
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
            industry: industry === "other" ? customIndustry : industry,
            region: region === "other" ? customRegion : region,
            targetLanguage: language,
            website_id: websiteId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || data.message || "批量生成失敗");
        }

        // 檢查是否真的有建立任務
        if (!data.success) {
          throw new Error(data.error || "未能建立任何任務");
        }

        // 組合顯示訊息
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
        <Label htmlFor="region">目標地區 *</Label>
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

      <div className="space-y-2">
        <Label htmlFor="language">撰寫語言 *</Label>
        <Select value={language} onValueChange={setLanguage} required>
          <SelectTrigger id="language">
            <SelectValue placeholder="請選擇撰寫語言" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <div className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3 rounded-lg border p-4 bg-muted/50">
        <Label className="text-base font-medium">生成模式</Label>
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as "single" | "batch")}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single" id="quick-single" />
            <Label
              htmlFor="quick-single"
              className="font-normal cursor-pointer"
            >
              單篇文章
              <span className="text-xs text-muted-foreground ml-2">
                （輸入一個關鍵字，生成一篇文章）
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="batch" id="quick-batch" />
            <Label htmlFor="quick-batch" className="font-normal cursor-pointer">
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
            disabled={isFormDisabled}
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
            disabled={isFormDisabled}
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
        disabled={isSubmitting || isFormDisabled}
      >
        {isSubmitting
          ? "生成中..."
          : mode === "single"
            ? "開始生成文章"
            : `開始批量生成 (${batchKeywords.split("\n").filter((k) => k.trim()).length || 0} 篇)`}
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

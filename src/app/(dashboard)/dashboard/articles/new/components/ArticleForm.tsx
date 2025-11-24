"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  { value: "other", label: "其他" },
];

const LANGUAGES = [
  { value: "zh-TW", label: "繁體中文" },
  { value: "en-US", label: "English" },
  { value: "ja-JP", label: "日本語" },
  { value: "ko-KR", label: "한국어" },
  { value: "zh-CN", label: "简体中文" },
];

export function ArticleForm() {
  const router = useRouter();
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [language, setLanguage] = useState("zh-TW");
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append(
        "industry",
        industry === "other" ? customIndustry : industry,
      );
      formData.append("region", region);
      formData.append("language", language);

      const validCompetitors = competitors.filter((c) => c.trim() !== "");
      formData.append("competitors", JSON.stringify(validCompetitors));

      await createArticle(formData);
      router.push("/dashboard/articles");
    } catch (error) {
      console.error("提交失敗:", error);
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">語言 *</Label>
        <Select value={language} onValueChange={setLanguage} required>
          <SelectTrigger id="language">
            <SelectValue placeholder="請選擇文章語言" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>競爭對手網站（選填，最多 5 個）</Label>
        <p className="text-sm text-muted-foreground">
          輸入競爭對手的網站 URL，系統將分析他們的內容策略
        </p>
        {competitors.map((competitor, index) => (
          <div key={index} className="flex gap-2">
            <Input
              type="url"
              value={competitor}
              onChange={(e) => handleCompetitorChange(index, e.target.value)}
              placeholder="https://example.com"
              className="flex-1"
            />
            {competitors.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleRemoveCompetitor(index)}
              >
                移除
              </Button>
            )}
          </div>
        ))}
        {competitors.length < 5 && (
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "生成中..." : "開始生成文章"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { updateWebsiteSettings } from "../../actions";

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

const LANGUAGES = [
  { code: "zh-TW", name: "繁體中文" },
  { code: "zh-CN", name: "简体中文" },
  { code: "en-US", name: "English" },
  { code: "ja-JP", name: "日本語" },
  { code: "ko-KR", name: "한국어" },
  { code: "vi-VN", name: "Tiếng Việt" },
  { code: "ms-MY", name: "Bahasa Melayu" },
  { code: "th-TH", name: "ไทย" },
  { code: "id-ID", name: "Bahasa Indonesia" },
  { code: "tl-PH", name: "Filipino" },
  { code: "fr-FR", name: "Français" },
  { code: "de-DE", name: "Deutsch" },
  { code: "es-ES", name: "Español" },
  { code: "pt-PT", name: "Português" },
  { code: "it-IT", name: "Italiano" },
  { code: "ru-RU", name: "Русский" },
  { code: "ar-SA", name: "العربية" },
  { code: "hi-IN", name: "हिन्दी" },
];

interface WebsiteSettingsFormProps {
  websiteId: string;
  industry: string | null;
  region: string | null;
  language: string | null;
}

export function WebsiteSettingsForm({
  websiteId,
  industry: initialIndustry,
  region: initialRegion,
  language: initialLanguage,
}: WebsiteSettingsFormProps) {
  const [industry, setIndustry] = useState(initialIndustry || "");
  const [customIndustry, setCustomIndustry] = useState("");
  const [region, setRegion] = useState(initialRegion || "");
  const [customRegion, setCustomRegion] = useState("");
  const [language, setLanguage] = useState(initialLanguage || "zh-TW");

  // Check if initial values are custom (not in predefined list)
  const isCustomIndustry =
    initialIndustry &&
    !INDUSTRIES.some((i) => i.value === initialIndustry) &&
    initialIndustry !== "";
  const isCustomRegion =
    initialRegion &&
    !REGIONS.some((r) => r.value === initialRegion) &&
    initialRegion !== "";

  // Initialize custom values if needed
  useState(() => {
    if (isCustomIndustry) {
      setIndustry("other");
      setCustomIndustry(initialIndustry || "");
    }
    if (isCustomRegion) {
      setRegion("other");
      setCustomRegion(initialRegion || "");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>文章生成設定</CardTitle>
        <CardDescription>
          設定此網站的產業、目標地區和語言，寫文章時會自動套用這些設定
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateWebsiteSettings} className="space-y-6">
          <input type="hidden" name="websiteId" value={websiteId} />
          <input
            type="hidden"
            name="industry"
            value={industry === "other" ? customIndustry : industry}
          />
          <input
            type="hidden"
            name="region"
            value={region === "other" ? customRegion : region}
          />
          <input type="hidden" name="language" value={language} />

          <div className="space-y-2">
            <Label htmlFor="industry">產業</Label>
            <Select value={industry} onValueChange={setIndustry}>
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
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
                placeholder="請輸入您的產業"
                className="mt-2"
              />
            )}
            <p className="text-xs text-muted-foreground">
              AI 會根據產業特性調整文章內容和用語
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">目標地區</Label>
            <Select value={region} onValueChange={setRegion}>
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
                value={customRegion}
                onChange={(e) => setCustomRegion(e.target.value)}
                placeholder="請輸入您的目標地區"
                className="mt-2"
              />
            )}
            <p className="text-xs text-muted-foreground">
              AI 會針對目標地區的讀者習慣調整內容
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">撰寫語言</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue placeholder="請選擇撰寫語言" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">文章將以此語言撰寫</p>
          </div>

          <Button type="submit">儲存設定</Button>
        </form>
      </CardContent>
    </Card>
  );
}

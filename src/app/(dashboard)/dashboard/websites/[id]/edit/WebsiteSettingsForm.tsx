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
import { useTranslations } from "next-intl";

// 地區值常數（不翻譯）
const REGION_VALUES = [
  "taiwan",
  "japan",
  "usa",
  "singapore",
  "hongkong",
  "china",
  "korea",
  "global",
  "other",
] as const;

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
  const t = useTranslations("websites");
  const [industry, setIndustry] = useState(initialIndustry || "");
  const [region, setRegion] = useState(initialRegion || "");
  const [customRegion, setCustomRegion] = useState("");
  const [language, setLanguage] = useState(initialLanguage || "zh-TW");

  // Check if initial region is custom (not in predefined list)
  const isCustomRegion =
    initialRegion &&
    !REGION_VALUES.includes(initialRegion as typeof REGION_VALUES[number]) &&
    initialRegion !== "";

  // Initialize custom region value if needed
  useState(() => {
    if (isCustomRegion) {
      setRegion("other");
      setCustomRegion(initialRegion || "");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settingsTitle")}</CardTitle>
        <CardDescription>
          {t("settingsDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateWebsiteSettings} className="space-y-6">
          <input type="hidden" name="websiteId" value={websiteId} />
          <input type="hidden" name="industry" value={industry} />
          <input
            type="hidden"
            name="region"
            value={region === "other" ? customRegion : region}
          />
          <input type="hidden" name="language" value={language} />

          <div className="space-y-2">
            <Label htmlFor="industry">{t("topicLabel")}</Label>
            <Input
              id="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder={t("topicPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("topicHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">{t("regionLabel")}</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger id="region">
                <SelectValue placeholder={t("regionPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {REGION_VALUES.map((regValue) => (
                  <SelectItem key={regValue} value={regValue}>
                    {t(`regions.${regValue}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {region === "other" && (
              <Input
                value={customRegion}
                onChange={(e) => setCustomRegion(e.target.value)}
                placeholder={t("customRegionPlaceholder")}
                className="mt-2"
              />
            )}
            <p className="text-xs text-muted-foreground">
              {t("regionHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">{t("languageLabel")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="language">
                <SelectValue placeholder={t("languagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("languageHint")}</p>
          </div>

          <Button type="submit">{t("saveSettings")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

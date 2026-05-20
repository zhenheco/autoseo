"use client";

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
import { updateExternalWebsiteBrandVoice } from "../../actions";
import type { BrandVoiceFormProps } from "@/types/external-website.types";
import { useTranslations } from "next-intl";

export function ExternalWebsiteBrandVoiceForm({
  websiteId,
  brandVoice,
}: BrandVoiceFormProps): React.ReactElement {
  const t = useTranslations("externalWebsites");

  const TONE_OPTIONS = [
    { value: "專業正式", label: t("tones.professionalFormal") },
    { value: "專業親切", label: t("tones.professionalFriendly") },
    { value: "輕鬆友善", label: t("tones.casualFriendly") },
    { value: "教育性", label: t("tones.educational") },
    { value: "說服性", label: t("tones.persuasive") },
    { value: "權威專家", label: t("tones.authoritative") },
  ];

  const WRITING_STYLE_OPTIONS = [
    { value: "專業正式", label: t("writingStyles.professionalFormal") },
    { value: "輕鬆友善", label: t("writingStyles.casualFriendly") },
    { value: "教育性", label: t("writingStyles.educational") },
    { value: "說服性", label: t("writingStyles.persuasive") },
    { value: "zhihuViral", label: t("writingStyles.zhihuViral") },
    { value: "businessMedia", label: t("writingStyles.businessMedia") },
    { value: "deepAnalysis", label: t("writingStyles.deepAnalysis") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("brandVoiceSettings")}</CardTitle>
        <CardDescription>{t("brandVoiceDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateExternalWebsiteBrandVoice} className="space-y-4">
          <input type="hidden" name="websiteId" value={websiteId} />

          <div className="space-y-2">
            <Label htmlFor="brand-name">{t("brandName")}</Label>
            <Input
              id="brand-name"
              name="brandName"
              defaultValue={brandVoice?.brand_name || ""}
              placeholder={t("brandNamePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("brandNameHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone-of-voice">{t("toneOfVoice")}</Label>
            <Select
              name="toneOfVoice"
              defaultValue={brandVoice?.tone_of_voice || "專業親切"}
            >
              <SelectTrigger id="tone-of-voice">
                <SelectValue placeholder={t("selectTone")} />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-audience">{t("targetAudience")}</Label>
            <Input
              id="target-audience"
              name="targetAudience"
              defaultValue={brandVoice?.target_audience || ""}
              placeholder={t("targetAudiencePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("targetAudienceHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="writing-style">{t("writingStyle")}</Label>
            <Select
              name="writingStyle"
              defaultValue={brandVoice?.writing_style || "專業正式"}
            >
              <SelectTrigger id="writing-style">
                <SelectValue placeholder={t("selectWritingStyle")} />
              </SelectTrigger>
              <SelectContent>
                {WRITING_STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit">{t("saveBrandSettings")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

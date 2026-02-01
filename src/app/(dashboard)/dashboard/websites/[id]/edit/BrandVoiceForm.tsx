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
import { updateWebsiteBrandVoice } from "../../actions";
import { useTranslations } from "next-intl";

interface BrandVoice {
  brand_name?: string;
  tone_of_voice?: string;
  target_audience?: string;
  writing_style?: string;
}

interface BrandVoiceFormProps {
  websiteId: string;
  brandVoice: BrandVoice | null;
}

export function BrandVoiceForm({ websiteId, brandVoice }: BrandVoiceFormProps) {
  const t = useTranslations("websites.brandVoice");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateWebsiteBrandVoice} className="space-y-4">
          <input type="hidden" name="websiteId" value={websiteId} />
          <div className="space-y-2">
            <Label htmlFor="brand-name">{t("brandNameLabel")}</Label>
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
            <Label htmlFor="tone-of-voice">{t("toneOfVoiceLabel")}</Label>
            <Select
              name="toneOfVoice"
              defaultValue={brandVoice?.tone_of_voice || "professionalFriendly"}
            >
              <SelectTrigger id="tone-of-voice">
                <SelectValue placeholder={t("toneOfVoicePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professionalFormal">
                  {t("tones.professionalFormal")}
                </SelectItem>
                <SelectItem value="professionalFriendly">
                  {t("tones.professionalFriendly")}
                </SelectItem>
                <SelectItem value="casualFriendly">
                  {t("tones.casualFriendly")}
                </SelectItem>
                <SelectItem value="educational">
                  {t("tones.educational")}
                </SelectItem>
                <SelectItem value="persuasive">
                  {t("tones.persuasive")}
                </SelectItem>
                <SelectItem value="expertAuthority">
                  {t("tones.expertAuthority")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="target-audience">{t("targetAudienceLabel")}</Label>
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
            <Label htmlFor="writing-style">{t("writingStyleLabel")}</Label>
            <Select
              name="writingStyle"
              defaultValue={brandVoice?.writing_style || "professionalFormal"}
            >
              <SelectTrigger id="writing-style">
                <SelectValue placeholder={t("writingStylePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professionalFormal">
                  {t("styles.professionalFormal")}
                </SelectItem>
                <SelectItem value="casualFriendly">
                  {t("styles.casualFriendly")}
                </SelectItem>
                <SelectItem value="educational">
                  {t("styles.educational")}
                </SelectItem>
                <SelectItem value="persuasive">
                  {t("styles.persuasive")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">{t("saveBrandSettings")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

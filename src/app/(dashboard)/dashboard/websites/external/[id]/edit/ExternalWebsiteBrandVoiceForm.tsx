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

const TONE_OPTIONS = [
  { value: "專業正式", label: "專業正式" },
  { value: "專業親切", label: "專業親切" },
  { value: "輕鬆友善", label: "輕鬆友善" },
  { value: "教育性", label: "教育性" },
  { value: "說服性", label: "說服性" },
  { value: "權威專家", label: "權威專家" },
];

const WRITING_STYLE_OPTIONS = [
  { value: "專業正式", label: "專業正式" },
  { value: "輕鬆友善", label: "輕鬆友善" },
  { value: "教育性", label: "教育性" },
  { value: "說服性", label: "說服性" },
];

export function ExternalWebsiteBrandVoiceForm({
  websiteId,
  brandVoice,
}: BrandVoiceFormProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>品牌聲音設定</CardTitle>
        <CardDescription>設定文章撰寫時使用的品牌風格和語氣</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateExternalWebsiteBrandVoice} className="space-y-4">
          <input type="hidden" name="websiteId" value={websiteId} />

          <div className="space-y-2">
            <Label htmlFor="brand-name">品牌名稱</Label>
            <Input
              id="brand-name"
              name="brandName"
              defaultValue={brandVoice?.brand_name || ""}
              placeholder="請輸入您的品牌名稱"
            />
            <p className="text-xs text-muted-foreground">
              文章中會適當提及此品牌名稱
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone-of-voice">語氣</Label>
            <Select
              name="toneOfVoice"
              defaultValue={brandVoice?.tone_of_voice || "專業親切"}
            >
              <SelectTrigger id="tone-of-voice">
                <SelectValue placeholder="請選擇語氣" />
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
            <Label htmlFor="target-audience">目標受眾</Label>
            <Input
              id="target-audience"
              name="targetAudience"
              defaultValue={brandVoice?.target_audience || ""}
              placeholder="例如：B2B 專業人士、一般消費者、技術人員"
            />
            <p className="text-xs text-muted-foreground">
              描述您的目標讀者群，文章風格會根據受眾調整
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="writing-style">寫作風格</Label>
            <Select
              name="writingStyle"
              defaultValue={brandVoice?.writing_style || "專業正式"}
            >
              <SelectTrigger id="writing-style">
                <SelectValue placeholder="請選擇寫作風格" />
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

          <Button type="submit">儲存品牌設定</Button>
        </form>
      </CardContent>
    </Card>
  );
}

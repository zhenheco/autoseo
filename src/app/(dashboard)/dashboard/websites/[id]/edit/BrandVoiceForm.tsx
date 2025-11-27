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
  return (
    <Card>
      <CardHeader>
        <CardTitle>品牌聲音設定</CardTitle>
        <CardDescription>設定文章撰寫時使用的品牌風格和語氣</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateWebsiteBrandVoice} className="space-y-4">
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
                <SelectItem value="專業正式">專業正式</SelectItem>
                <SelectItem value="專業親切">專業親切</SelectItem>
                <SelectItem value="輕鬆友善">輕鬆友善</SelectItem>
                <SelectItem value="教育性">教育性</SelectItem>
                <SelectItem value="說服性">說服性</SelectItem>
                <SelectItem value="權威專家">權威專家</SelectItem>
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
                <SelectItem value="專業正式">專業正式</SelectItem>
                <SelectItem value="輕鬆友善">輕鬆友善</SelectItem>
                <SelectItem value="教育性">教育性</SelectItem>
                <SelectItem value="說服性">說服性</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">儲存品牌設定</Button>
        </form>
      </CardContent>
    </Card>
  );
}

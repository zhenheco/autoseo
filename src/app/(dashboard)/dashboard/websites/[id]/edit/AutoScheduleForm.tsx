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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateWebsiteAutoSchedule } from "../../actions";
import { Calendar, Clock } from "lucide-react";

interface AutoScheduleFormProps {
  websiteId: string;
  dailyArticleLimit: number | null;
  autoScheduleEnabled: boolean | null;
}

const DAILY_LIMITS = [
  { value: "1", label: "1 篇" },
  { value: "2", label: "2 篇" },
  { value: "3", label: "3 篇" },
];

export function AutoScheduleForm({
  websiteId,
  dailyArticleLimit: initialLimit,
  autoScheduleEnabled: initialEnabled,
}: AutoScheduleFormProps) {
  const [dailyLimit, setDailyLimit] = useState(String(initialLimit || 3));
  const [autoEnabled, setAutoEnabled] = useState(initialEnabled ?? false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          自動排程設定
        </CardTitle>
        <CardDescription>
          設定文章生成完成後的自動排程行為。啟用後，文章會自動排入黃金時段發布。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateWebsiteAutoSchedule} className="space-y-6">
          <input type="hidden" name="websiteId" value={websiteId} />
          <input type="hidden" name="dailyArticleLimit" value={dailyLimit} />
          <input
            type="hidden"
            name="autoScheduleEnabled"
            value={autoEnabled ? "true" : "false"}
          />

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">自動排程</Label>
              <p className="text-sm text-muted-foreground">
                文章生成完成後自動排入發布佇列
              </p>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily-limit">每日發布文章數上限</Label>
            <Select
              value={dailyLimit}
              onValueChange={setDailyLimit}
              disabled={!autoEnabled}
            >
              <SelectTrigger id="daily-limit">
                <SelectValue placeholder="選擇每日篇數" />
              </SelectTrigger>
              <SelectContent>
                {DAILY_LIMITS.map((limit) => (
                  <SelectItem key={limit.value} value={limit.value}>
                    {limit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              黃金時段：09:00、14:00、20:00（台灣時間）
            </p>
          </div>

          <Button type="submit">儲存設定</Button>
        </form>
      </CardContent>
    </Card>
  );
}

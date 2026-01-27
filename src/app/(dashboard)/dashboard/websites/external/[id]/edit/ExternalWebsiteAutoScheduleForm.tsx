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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateExternalWebsiteAutoSchedule } from "../../actions";
import { Calendar, Clock, CalendarDays } from "lucide-react";
import type { AutoScheduleFormProps } from "@/types/external-website.types";

const DAILY_LIMITS = [
  { value: "1", label: "1 篇" },
  { value: "2", label: "2 篇" },
  { value: "3", label: "3 篇" },
  { value: "4", label: "4 篇" },
  { value: "5", label: "5 篇" },
];

const INTERVAL_DAYS = [
  { value: "2", label: "每 2 天" },
  { value: "3", label: "每 3 天" },
  { value: "4", label: "每 4 天" },
  { value: "5", label: "每 5 天" },
  { value: "6", label: "每 6 天" },
  { value: "7", label: "每 7 天（每週）" },
];

const TIME_SLOTS_INFO: Record<number, string> = {
  1: "09:00",
  2: "09:00、14:00",
  3: "09:00、14:00、20:00",
  4: "09:00、11:00、14:00、20:00",
  5: "09:00、11:00、14:00、17:00、20:00",
};

type ScheduleType = "daily" | "interval";

export function ExternalWebsiteAutoScheduleForm({
  websiteId,
  dailyArticleLimit: initialLimit,
  autoScheduleEnabled: initialEnabled,
  scheduleType: initialType,
  scheduleIntervalDays: initialInterval,
}: AutoScheduleFormProps): React.ReactElement {
  const [dailyLimit, setDailyLimit] = useState(String(initialLimit || 3));
  const [autoEnabled, setAutoEnabled] = useState(initialEnabled ?? false);
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    initialType || "daily",
  );
  const [intervalDays, setIntervalDays] = useState(
    String(initialInterval || 3),
  );

  const currentTimeSlots =
    scheduleType === "daily"
      ? TIME_SLOTS_INFO[Number(dailyLimit)] || TIME_SLOTS_INFO[3]
      : "09:00（固定第一個黃金時段）";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          自動排程設定
        </CardTitle>
        <CardDescription>
          設定文章生成完成後的自動排程行為。啟用後，文章會自動排入發布佇列。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={updateExternalWebsiteAutoSchedule} className="space-y-6">
          <input type="hidden" name="websiteId" value={websiteId} />
          <input type="hidden" name="dailyArticleLimit" value={dailyLimit} />
          <input
            type="hidden"
            name="autoScheduleEnabled"
            value={String(autoEnabled)}
          />
          <input type="hidden" name="scheduleType" value={scheduleType} />
          <input type="hidden" name="scheduleIntervalDays" value={intervalDays} />

          {/* 自動排程開關 */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">自動排程</Label>
              <p className="text-sm text-muted-foreground">
                文章生成完成後自動排入發布佇列
              </p>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
          </div>

          {/* 排程模式選擇 */}
          <div className="space-y-3">
            <Label>排程模式</Label>
            <RadioGroup
              value={scheduleType}
              onValueChange={(v) => setScheduleType(v as ScheduleType)}
              disabled={!autoEnabled}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="daily" id="daily" />
                <Label
                  htmlFor="daily"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Clock className="h-4 w-4" />
                  每日發布
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="interval" id="interval" />
                <Label
                  htmlFor="interval"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <CalendarDays className="h-4 w-4" />
                  間隔發布
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 每日發布模式：選擇每日篇數 */}
          {scheduleType === "daily" && (
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
            </div>
          )}

          {/* 間隔發布模式：選擇間隔天數 */}
          {scheduleType === "interval" && (
            <div className="space-y-2">
              <Label htmlFor="interval-days">發布間隔</Label>
              <Select
                value={intervalDays}
                onValueChange={setIntervalDays}
                disabled={!autoEnabled}
              >
                <SelectTrigger id="interval-days">
                  <SelectValue placeholder="選擇間隔天數" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_DAYS.map((interval) => (
                    <SelectItem key={interval.value} value={interval.value}>
                      {interval.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                每隔指定天數發布 1 篇文章
              </p>
            </div>
          )}

          {/* 時段提示 */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>發布時段（台灣時間）：{currentTimeSlots}</span>
            </p>
          </div>

          <Button type="submit" disabled={!autoEnabled}>
            儲存設定
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

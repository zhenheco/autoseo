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
import { updateWebsiteAutoSchedule } from "../../actions";
import { Calendar, Clock, CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";

interface AutoScheduleFormProps {
  websiteId: string;
  dailyArticleLimit: number | null;
  autoScheduleEnabled: boolean | null;
  scheduleType: "daily" | "interval" | null;
  scheduleIntervalDays: number | null;
}

// 時段提示（時間是固定的，不需要翻譯）
const TIME_SLOTS_INFO: Record<number, string> = {
  1: "09:00",
  2: "09:00, 14:00",
  3: "09:00, 14:00, 20:00",
  4: "09:00, 11:00, 14:00, 20:00",
  5: "09:00, 11:00, 14:00, 17:00, 20:00",
};

export function AutoScheduleForm({
  websiteId,
  dailyArticleLimit: initialLimit,
  autoScheduleEnabled: initialEnabled,
  scheduleType: initialType,
  scheduleIntervalDays: initialInterval,
}: AutoScheduleFormProps) {
  const t = useTranslations("websites.autoSchedule");
  const [dailyLimit, setDailyLimit] = useState(String(initialLimit || 3));
  const [autoEnabled, setAutoEnabled] = useState(initialEnabled ?? false);
  const [scheduleType, setScheduleType] = useState<"daily" | "interval">(
    initialType || "daily",
  );
  const [intervalDays, setIntervalDays] = useState(
    String(initialInterval || 3),
  );

  // 動態計算時段提示
  const currentTimeSlots =
    scheduleType === "daily"
      ? TIME_SLOTS_INFO[Number(dailyLimit)] || TIME_SLOTS_INFO[3]
      : t("fixedFirstSlot");

  // 每日篇數選項（1-5 篇）
  const DAILY_LIMITS = [
    { value: "1", label: t("dailyLimits.1") },
    { value: "2", label: t("dailyLimits.2") },
    { value: "3", label: t("dailyLimits.3") },
    { value: "4", label: t("dailyLimits.4") },
    { value: "5", label: t("dailyLimits.5") },
  ];

  // 間隔天數選項（2-7 天）
  const INTERVAL_DAYS = [
    { value: "2", label: t("intervalDays.2") },
    { value: "3", label: t("intervalDays.3") },
    { value: "4", label: t("intervalDays.4") },
    { value: "5", label: t("intervalDays.5") },
    { value: "6", label: t("intervalDays.6") },
    { value: "7", label: t("intervalDays.7") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
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
          <input type="hidden" name="scheduleType" value={scheduleType} />
          <input
            type="hidden"
            name="scheduleIntervalDays"
            value={intervalDays}
          />

          {/* 自動排程開關 */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">{t("autoScheduleLabel")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("autoScheduleHint")}
              </p>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
          </div>

          {/* 排程模式選擇 */}
          <div className="space-y-3">
            <Label>{t("scheduleModeLabel")}</Label>
            <RadioGroup
              value={scheduleType}
              onValueChange={(v) => setScheduleType(v as "daily" | "interval")}
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
                  {t("dailyPublish")}
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="interval" id="interval" />
                <Label
                  htmlFor="interval"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <CalendarDays className="h-4 w-4" />
                  {t("intervalPublish")}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 每日發布模式：選擇每日篇數 */}
          {scheduleType === "daily" && (
            <div className="space-y-2">
              <Label htmlFor="daily-limit">{t("dailyLimitLabel")}</Label>
              <Select
                value={dailyLimit}
                onValueChange={setDailyLimit}
                disabled={!autoEnabled}
              >
                <SelectTrigger id="daily-limit">
                  <SelectValue placeholder={t("dailyLimitPlaceholder")} />
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
              <Label htmlFor="interval-days">{t("intervalLabel")}</Label>
              <Select
                value={intervalDays}
                onValueChange={setIntervalDays}
                disabled={!autoEnabled}
              >
                <SelectTrigger id="interval-days">
                  <SelectValue placeholder={t("intervalPlaceholder")} />
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
                {t("intervalHint")}
              </p>
            </div>
          )}

          {/* 時段提示 */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{t("publishTimeLabel", { slots: currentTimeSlots })}</span>
            </p>
          </div>

          <Button type="submit" disabled={!autoEnabled}>
            {t("saveSettings")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

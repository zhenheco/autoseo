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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("externalWebsites");
  const tWebsites = useTranslations("websites");

  const DAILY_LIMITS = [
    { value: "1", label: t("dailyLimits.one") },
    { value: "2", label: t("dailyLimits.two") },
    { value: "3", label: t("dailyLimits.three") },
    { value: "4", label: t("dailyLimits.four") },
    { value: "5", label: t("dailyLimits.five") },
  ];

  const INTERVAL_DAYS = [
    { value: "2", label: t("intervalDays.two") },
    { value: "3", label: t("intervalDays.three") },
    { value: "4", label: t("intervalDays.four") },
    { value: "5", label: t("intervalDays.five") },
    { value: "6", label: t("intervalDays.six") },
    { value: "7", label: t("intervalDays.seven") },
  ];

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
      : t("fixedFirstGoldenSlot");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {t("autoScheduleSettings")}
        </CardTitle>
        <CardDescription>
          {t("autoScheduleDescription")}
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
              <Label className="text-base">{tWebsites("autoSchedule")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("autoScheduleHint")}
              </p>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
          </div>

          {/* 排程模式選擇 */}
          <div className="space-y-3">
            <Label>{t("scheduleMode")}</Label>
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
              <Label htmlFor="daily-limit">{t("dailyPublishLimit")}</Label>
              <Select
                value={dailyLimit}
                onValueChange={setDailyLimit}
                disabled={!autoEnabled}
              >
                <SelectTrigger id="daily-limit">
                  <SelectValue placeholder={t("selectDailyLimit")} />
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
              <Label htmlFor="interval-days">{t("publishInterval")}</Label>
              <Select
                value={intervalDays}
                onValueChange={setIntervalDays}
                disabled={!autoEnabled}
              >
                <SelectTrigger id="interval-days">
                  <SelectValue placeholder={t("selectIntervalDays")} />
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
              <span>{t("publishTimeSlots", { slots: currentTimeSlots })}</span>
            </p>
          </div>

          <Button type="submit" disabled={!autoEnabled}>
            {tWebsites("saveSettings")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

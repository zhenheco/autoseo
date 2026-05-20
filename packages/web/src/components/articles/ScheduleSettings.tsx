"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  ScheduleConfig,
  PublishPlan,
} from "@/app/(dashboard)/dashboard/articles/import/page";

interface ScheduleSettingsProps {
  config: ScheduleConfig;
  plans: PublishPlan[];
  onConfigChange: (config: ScheduleConfig) => void;
}

export function ScheduleSettings({
  config,
  plans,
  onConfigChange,
}: ScheduleSettingsProps) {
  const t = useTranslations("articles.scheduleSettings");
  const handleModeChange = (mode: "specific" | "interval") => {
    onConfigChange({ ...config, mode });
  };

  const handleIntervalChange = (hours: number) => {
    onConfigChange({ ...config, intervalHours: hours });
  };

  const calculateSchedulePreview = () => {
    if (config.mode !== "interval" || !config.intervalHours) return [];

    const now = new Date();
    return plans.slice(0, 5).map((plan, index) => {
      const publishTime = new Date(
        now.getTime() + index * config.intervalHours! * 60 * 60 * 1000,
      );
      return {
        keyword: plan.keyword,
        publishTime: publishTime.toLocaleString("zh-TW", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    });
  };

  const preview = calculateSchedulePreview();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={config.mode} onValueChange={handleModeChange}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="interval" id="interval" />
            <Label htmlFor="interval" className="font-normal cursor-pointer">
              {t("intervalMode")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="specific" id="specific" disabled />
            <Label
              htmlFor="specific"
              className="font-normal text-muted-foreground cursor-not-allowed"
            >
              {t("specificMode")}
            </Label>
          </div>
        </RadioGroup>

        {config.mode === "interval" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intervalHours">{t("intervalLabel")}</Label>
              <Input
                id="intervalHours"
                type="number"
                min={1}
                max={168}
                value={config.intervalHours || 24}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                {t("intervalHint", { hours: config.intervalHours || 24 })}
              </p>
            </div>

            {preview.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{t("previewTitle")}</h4>
                <div className="space-y-2">
                  {preview.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-md text-sm"
                    >
                      <span className="truncate max-w-xs">{item.keyword}</span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {item.publishTime}
                      </span>
                    </div>
                  ))}
                  {plans.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">
                      {t("morePlans", { count: plans.length - 5 })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("totalPlans")}</span>
            <span className="font-medium">
              {t("plansCount", { count: plans.length })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("estimatedTime")}</span>
            <span className="font-medium">
              {config.intervalHours
                ? t("days", {
                    days: Math.ceil((plans.length * config.intervalHours) / 24),
                  })
                : "-"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

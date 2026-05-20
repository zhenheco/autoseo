"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExcelUploadZone } from "@/components/articles/ExcelUploadZone";
import { PublishPlanTable } from "@/components/articles/PublishPlanTable";
import { ScheduleSettings } from "@/components/articles/ScheduleSettings";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export interface PublishPlan {
  id: string;
  keyword: string;
  websiteName: string;
  websiteId?: string;
  articleType?: string;
  publishTime?: string;
  customSlug?: string;
  generatedTitle?: string;
  generatedSlug?: string;
  previewUrl?: string;
  status: "valid" | "warning" | "error";
  errorMessage?: string;
}

export interface ScheduleConfig {
  mode: "specific" | "interval";
  intervalHours?: number;
  startTime?: Date;
}

export default function ImportPage() {
  const t = useTranslations("articles.import");
  const tCommon = useTranslations("common");
  const [step, setStep] = useState<
    "upload" | "preview" | "schedule" | "confirm"
  >("upload");
  const [publishPlans, setPublishPlans] = useState<PublishPlan[]>([]);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    mode: "interval",
    intervalHours: 24,
  });

  const handleFileUploaded = (plans: PublishPlan[]) => {
    setPublishPlans(plans);
    setStep("preview");
  };

  const handleScheduleNext = () => {
    setStep("confirm");
  };

  const handleConfirm = async () => {
    try {
      const response = await fetch("/api/articles/import-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: publishPlans, scheduleConfig }),
      });

      if (!response.ok) {
        throw new Error(t("importFailed"));
      }

      const result = await response.json();
      alert(t("importSuccess", { count: result.created }));
      window.location.href = "/dashboard/articles";
    } catch (error) {
      alert(error instanceof Error ? error.message : t("errorOccurred"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/articles">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tCommon("back")}
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("uploadTitle")}</CardTitle>
            <CardDescription>{t("uploadDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ExcelUploadZone onFileUploaded={handleFileUploaded} />
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <>
          <PublishPlanTable
            plans={publishPlans}
            onPlansChange={setPublishPlans}
          />
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setStep("upload")}>
              {t("backToUpload")}
            </Button>
            <Button onClick={() => setStep("schedule")}>
              {t("nextSchedule")}
            </Button>
          </div>
        </>
      )}

      {step === "schedule" && (
        <>
          <ScheduleSettings
            config={scheduleConfig}
            plans={publishPlans}
            onConfigChange={setScheduleConfig}
          />
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setStep("preview")}>
              {tCommon("back")}
            </Button>
            <Button onClick={handleScheduleNext}>{t("nextConfirm")}</Button>
          </div>
        </>
      )}

      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("confirmTitle")}</CardTitle>
            <CardDescription>
              {t("confirmDescription", { count: publishPlans.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div>
                <h3 className="font-semibold mb-2">{t("taskCount")}</h3>
                <p>{t("taskUnit", { count: publishPlans.length })}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">{t("scheduleMode")}</h3>
                <p>
                  {scheduleConfig.mode === "interval"
                    ? t("intervalPublish", {
                        hours: scheduleConfig.intervalHours || 24,
                      })
                    : t("specificTimePublish")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setStep("schedule")}>
                {tCommon("back")}
              </Button>
              <Button onClick={handleConfirm}>{t("confirm")}</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Copy,
  FileWarning,
  ImageOff,
  PanelTop,
  TextCursorInput,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dispatchShoplineSeoFilterChange,
  type ShoplineSeoFilter,
} from "./seo-filter-events";

type HealthSummaryCounts = {
  missingSeoTitle: number;
  seoTitleTooLong: number;
  missingSeoDescription: number;
  seoDescriptionTooLong: number;
  missingAlt: number;
  duplicateTitle: number;
};

type HealthSummaryResponse = {
  counts?: Partial<HealthSummaryCounts>;
};

type ShoplineHealthSummaryProps = {
  websiteId: string;
};

const emptyCounts: HealthSummaryCounts = {
  missingSeoTitle: 0,
  seoTitleTooLong: 0,
  missingSeoDescription: 0,
  seoDescriptionTooLong: 0,
  missingAlt: 0,
  duplicateTitle: 0,
};

export function ShoplineHealthSummary({
  websiteId,
}: ShoplineHealthSummaryProps) {
  const t = useTranslations("shopline.seo");
  const [counts, setCounts] = useState<HealthSummaryCounts>(emptyCounts);
  const [loading, setLoading] = useState(true);
  const saveErrorMessage = t("toast.saveError");

  useEffect(() => {
    let cancelled = false;

    async function loadHealthSummary() {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/shopline/${websiteId}/health-summary`,
        );
        if (!response.ok) throw new Error("shopline_health_summary_failed");

        const data = (await response.json()) as HealthSummaryResponse;
        if (!cancelled) {
          setCounts({ ...emptyCounts, ...(data.counts ?? {}) });
        }
      } catch {
        if (!cancelled) toast.error(saveErrorMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHealthSummary();

    return () => {
      cancelled = true;
    };
  }, [saveErrorMessage, websiteId]);

  const flags = useMemo(
    () => [
      {
        key: "missingSeoTitle",
        label: t("health.flag.missingSeoTitle"),
        count: counts.missingSeoTitle,
        filter: "missing-seo" as ShoplineSeoFilter,
        icon: PanelTop,
      },
      {
        key: "seoTitleTooLong",
        label: t("health.flag.seoTitleTooLong"),
        count: counts.seoTitleTooLong,
        filter: "title-too-long" as ShoplineSeoFilter,
        icon: TextCursorInput,
      },
      {
        key: "missingSeoDescription",
        label: t("health.flag.missingSeoDescription"),
        count: counts.missingSeoDescription,
        filter: "missing-seo" as ShoplineSeoFilter,
        icon: FileWarning,
      },
      {
        key: "seoDescriptionTooLong",
        label: t("health.flag.seoDescriptionTooLong"),
        count: counts.seoDescriptionTooLong,
        filter: "description-too-long" as ShoplineSeoFilter,
        icon: AlertTriangle,
      },
      {
        key: "missingAlt",
        label: t("health.flag.missingAlt"),
        count: counts.missingAlt,
        filter: "missing-alt" as ShoplineSeoFilter,
        icon: ImageOff,
      },
      {
        key: "duplicateTitle",
        label: t("health.flag.duplicateTitle"),
        count: counts.duplicateTitle,
        filter: "duplicate-title" as ShoplineSeoFilter,
        icon: Copy,
      },
    ],
    [counts, t],
  );
  const totalIssues = flags.reduce((sum, flag) => sum + flag.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("health.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!loading && totalIssues === 0 ? (
          <p className="text-sm text-muted-foreground">{t("health.empty")}</p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flags.map((flag) => {
            const Icon = flag.icon;

            return (
              <Button
                key={flag.key}
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 px-3 py-3 text-left"
                onClick={() => dispatchShoplineSeoFilterChange(flag.filter)}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block text-lg font-semibold leading-none">
                    {flag.count}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {flag.label}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

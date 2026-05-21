"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { CalendarClock, RefreshCw } from "lucide-react";
import { IconLabel } from "@/components/ui/icon-label";
import { StatusBadge } from "@/components/ui/status-badge";

type AutomationStatusCardProps = {
  brandId: string;
  automationLevel: number;
  autoArticlesPerWeek: number;
  initialScheduled: number;
  initialPublished: number;
};

type AutomationStatusResponse = {
  scheduled?: number;
  published?: number;
};

export function AutomationStatusCard({
  brandId,
  automationLevel,
  autoArticlesPerWeek,
  initialScheduled,
  initialPublished,
}: AutomationStatusCardProps) {
  const [scheduled, setScheduled] = useState(initialScheduled);
  const [published, setPublished] = useState(initialPublished);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function refreshStatus() {
      setIsRefreshing(true);
      try {
        const response = await fetch(
          `/api/dashboard/automation-status?brandId=${encodeURIComponent(
            brandId,
          )}`,
        );
        if (!response.ok) return;
        const body = (await response.json()) as AutomationStatusResponse;
        if (!isMounted) return;
        setScheduled(body.scheduled ?? 0);
        setPublished(body.published ?? 0);
      } finally {
        if (isMounted) setIsRefreshing(false);
      }
    }

    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [brandId]);

  const automated = automationLevel >= 3;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <IconLabel
            as="div"
            icon={
              <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
            }
          >
            <CardTitle>Automation status</CardTitle>
          </IconLabel>
          <StatusBadge
            status={automated ? "active" : "inactive"}
            label={`L${automationLevel}`}
          />
        </div>
        <CardDescription>
          Current automation level for this brand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Articles per week
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-normal">
            {autoArticlesPerWeek}
          </p>
        </div>

        {automated ? (
          <p className="text-sm leading-6 text-muted-foreground">
            This week&apos;s auto-pipeline:{" "}
            <span className="font-semibold text-foreground">
              {scheduled} articles scheduled
            </span>
            ,{" "}
            <span className="font-semibold text-foreground">
              {published} published
            </span>
            .
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Manual or recommendation-only mode. Automatic scheduling starts at
            L3.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/automation?brand=${brandId}`}>
              View automation
            </Link>
          </Button>
          {isRefreshing && (
            <IconLabel
              className="text-xs text-muted-foreground"
              icon={<RefreshCw className="h-3 w-3 animate-spin" aria-hidden />}
            >
              Refreshing
            </IconLabel>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

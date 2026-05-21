"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Progress } from "@shared/ui/progress";
import { Check, FilePlus2, Pin, TrendingUp, X } from "lucide-react";

type TrendSignalSource = "perplexity" | "gsc" | "google_trends" | "manual";

export type DashboardTrendSignal = {
  id: string;
  brandId: string;
  topic: string;
  source: TrendSignalSource;
  confidence: number;
  metadata?: Record<string, unknown> | null;
};

type TrendsResponse = {
  signals?: DashboardTrendSignal[];
};

const SOURCE_LABELS: Record<TrendSignalSource, string> = {
  perplexity: "Perplexity",
  gsc: "GSC",
  google_trends: "Google Trends",
  manual: "Manual",
};

function confidencePercent(confidence: number) {
  if (!Number.isFinite(confidence)) return 0;
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

export function TrendsWidget() {
  const [signals, setSignals] = useState<DashboardTrendSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdSignalId, setCreatedSignalId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSignals() {
      try {
        const response = await fetch("/api/trends");
        if (!response.ok) throw new Error("Failed to load trends");
        const payload = (await response.json()) as TrendsResponse;
        if (isMounted) {
          setSignals((payload.signals ?? []).slice(0, 5));
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load trends",
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadSignals();

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedSignals = useMemo(
    () => [...signals].sort((a, b) => b.confidence - a.confidence).slice(0, 5),
    [signals],
  );

  async function dismiss(signal: DashboardTrendSignal) {
    setPendingId(signal.id);
    try {
      const response = await fetch(`/api/trends/${signal.id}/dismiss`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to dismiss trend");
      setSignals((current) => current.filter((item) => item.id !== signal.id));
      setError(null);
    } catch (dismissError) {
      setError(
        dismissError instanceof Error
          ? dismissError.message
          : "Failed to dismiss trend",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function pin(signal: DashboardTrendSignal) {
    setPendingId(signal.id);
    try {
      const response = await fetch(`/api/trends/${signal.id}/pin`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to pin trend");
      setSignals((current) =>
        current.map((item) =>
          item.id === signal.id
            ? {
                ...item,
                metadata: {
                  ...(item.metadata ?? {}),
                  tags: [
                    ...new Set([
                      ...(((item.metadata?.tags as string[] | undefined) ??
                        []) as string[]),
                      "pinned",
                    ]),
                  ],
                },
              }
            : item,
        ),
      );
      setError(null);
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : "Failed to pin");
    } finally {
      setPendingId(null);
    }
  }

  async function createArticleJob(signal: DashboardTrendSignal) {
    setPendingId(signal.id);
    try {
      const response = await fetch("/api/articles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: signal.topic,
          title: signal.topic,
          mode: "trend_signal",
          brandId: signal.brandId,
          brand_id: signal.brandId,
          sourceTrendSignalId: signal.id,
        }),
      });
      if (!response.ok) throw new Error("Failed to create article job");
      setCreatedSignalId(signal.id);
      setError(null);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create article job",
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="border-border/30 bg-card/50 rounded-xl backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl font-semibold">
            Recommended topics this week
          </CardTitle>
        </div>
        <CardDescription>
          Trend signals ranked by confidence for the active brand.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3" aria-label="Loading trend signals">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        ) : sortedSignals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              Trends research will populate after first cron run
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSignals.map((signal) => {
              const percent = confidencePercent(signal.confidence);
              const isPinned = Array.isArray(signal.metadata?.tags)
                ? signal.metadata.tags.includes("pinned")
                : false;
              const isPending = pendingId === signal.id;

              return (
                <div
                  key={signal.id}
                  className="rounded-lg border border-border/60 bg-background p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-sm font-semibold text-foreground">
                          {signal.topic}
                        </h3>
                        <Badge variant="secondary">
                          {SOURCE_LABELS[signal.source]}
                        </Badge>
                        {isPinned && (
                          <Badge variant="outline" className="gap-1">
                            <Pin className="h-3 w-3" />
                            Pinned
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress
                          value={percent}
                          aria-label={`${signal.topic} confidence`}
                          className="h-2 max-w-[180px]"
                        />
                        <span className="w-10 text-xs font-medium text-muted-foreground">
                          {percent}%
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void createArticleJob(signal)}
                        disabled={isPending}
                      >
                        {createdSignalId === signal.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <FilePlus2 className="h-4 w-4" />
                        )}
                        Use for article
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Pin ${signal.topic}`}
                        onClick={() => void pin(signal)}
                        disabled={isPending}
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Dismiss ${signal.topic}`}
                        onClick={() => void dismiss(signal)}
                        disabled={isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

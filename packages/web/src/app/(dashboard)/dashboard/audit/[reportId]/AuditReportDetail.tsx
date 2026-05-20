"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { cn } from "@/lib/utils";
import { scoreBadgeClass, type AuditSeverity } from "../AuditReportsList";

export interface AuditIssueItem {
  id: string;
  ruleId: string;
  severity: AuditSeverity;
  page: string;
  current: string;
  suggested: string | null;
  selector: string | null;
}

export interface AuditReportDetailModel {
  id: string;
  url: string;
  scannedAt: string;
  healthScore: number;
  pagesScanned: number;
  source: string;
  issues: AuditIssueItem[];
}

interface AuditReportDetailProps {
  report: AuditReportDetailModel;
}

const severities = ["critical", "warning", "info"] as const;

export function AuditReportDetail({ report }: AuditReportDetailProps) {
  const t = useTranslations("audit");
  const counts = useMemo(
    () => ({
      all: report.issues.length,
      critical: report.issues.filter((issue) => issue.severity === "critical")
        .length,
      warning: report.issues.filter((issue) => issue.severity === "warning")
        .length,
      info: report.issues.filter((issue) => issue.severity === "info").length,
    }),
    [report.issues],
  );

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <section className="rounded-lg border bg-background p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t("detail.summaryTitle")}
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-normal">
              {report.url}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(report.scannedAt)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{report.pagesScanned} pages</Badge>
              <Badge variant="outline">{report.source}</Badge>
            </div>
          </div>
          <div className="text-left md:text-right">
            <div
              className={cn(
                "inline-flex min-w-24 items-center justify-center rounded-lg border px-4 py-3 text-4xl font-bold",
                scoreBadgeClass(report.healthScore),
              )}
            >
              {report.healthScore}
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="critical" className="space-y-4">
        <TabsList>
          <TabsTrigger value="critical">
            {t("detail.tabs.critical", { count: counts.critical })}
          </TabsTrigger>
          <TabsTrigger value="warning">
            {t("detail.tabs.warning", { count: counts.warning })}
          </TabsTrigger>
          <TabsTrigger value="info">
            {t("detail.tabs.info", { count: counts.info })}
          </TabsTrigger>
          <TabsTrigger value="all">
            {t("detail.tabs.all", { count: counts.all })}
          </TabsTrigger>
        </TabsList>

        {severities.map((severity) => (
          <TabsContent key={severity} value={severity}>
            <IssueList
              issues={report.issues.filter(
                (issue) => issue.severity === severity,
              )}
            />
          </TabsContent>
        ))}
        <TabsContent value="all">
          <IssueList issues={report.issues} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IssueList({ issues }: { issues: AuditIssueItem[] }) {
  const t = useTranslations("audit");

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
        No issues
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <article key={issue.id} className="rounded-lg border bg-background p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{issue.severity}</Badge>
                <span className="font-mono text-sm font-medium">
                  {issue.ruleId}
                </span>
              </div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <Field
                  label={t("detail.issueCard.rule")}
                  value={issue.ruleId}
                />
                <Field label={t("detail.issueCard.page")} value={issue.page} />
                <Field
                  label={t("detail.issueCard.current")}
                  value={issue.current}
                />
                <Field
                  label={t("detail.issueCard.suggested")}
                  value={issue.suggested ?? "-"}
                />
                <Field
                  label={t("detail.issueCard.selector")}
                  value={issue.selector ?? "-"}
                />
              </dl>
            </div>
            <Button disabled variant="outline">
              {t("detail.issueCard.applyButton")}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

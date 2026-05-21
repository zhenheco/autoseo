"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@shared/ui/tooltip";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { scoreBadgeClass, type AuditSeverity } from "../AuditReportsList";
import { AuditReviewCard } from "./_components/AuditReviewCard";
import { BulkActionsBar } from "./_components/BulkActionsBar";

export interface AuditIssueItem {
  id: string;
  ruleId: string;
  severity: AuditSeverity;
  riskLevel: "low" | "medium" | "high";
  estimatedImpact: "high" | "medium" | "low";
  source: "html-scan" | "cwv" | "gsc-cross" | "a11y" | "security";
  page: string;
  current: string;
  suggested: string | null;
  selector: string | null;
  status: "open" | "auto-applied" | "pending-review" | "manual" | "resolved";
  autoApplyAvailable: boolean;
  articleJobId: string | null;
  edgeInjected: boolean;
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
      review: report.issues.filter(isReviewIssue).length,
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

      <Tabs defaultValue="all" className="space-y-4">
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
          <TabsTrigger value="review">
            {t("review.tabLabel", { count: counts.review })}
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
        <TabsContent value="review">
          <ReviewIssueList issues={report.issues.filter(isReviewIssue)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function isReviewIssue(issue: AuditIssueItem) {
  return (
    issue.riskLevel === "medium" &&
    (issue.status === "open" || issue.status === "pending-review")
  );
}

function ReviewIssueList({ issues }: { issues: AuditIssueItem[] }) {
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);

  function setIssueSelected(issueId: string, selected: boolean) {
    setSelectedIssueIds((current) =>
      selected
        ? Array.from(new Set([...current, issueId]))
        : current.filter((id) => id !== issueId),
    );
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
        No issues
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <BulkActionsBar
        selectedIssueIds={selectedIssueIds}
        onClearSelection={() => setSelectedIssueIds([])}
      />
      {issues.map((issue) => (
        <AuditReviewCard
          key={issue.id}
          issue={issue}
          selected={selectedIssueIds.includes(issue.id)}
          onSelectedChange={setIssueSelected}
        />
      ))}
    </div>
  );
}

function IssueList({ issues }: { issues: AuditIssueItem[] }) {
  const t = useTranslations("audit");
  const router = useRouter();
  const [applyingIssueId, setApplyingIssueId] = useState<string | null>(null);
  const [dispatchingIssueId, setDispatchingIssueId] = useState<string | null>(
    null,
  );

  async function applyIssue(issue: AuditIssueItem) {
    setApplyingIssueId(issue.id);
    try {
      const response = await fetch(`/api/audit/issues/${issue.id}/apply`, {
        method: "POST",
      });
      const body = (await response.json()) as
        | { ok: true; route: string; before: string; after: string }
        | { ok: false; error?: string };

      if (!response.ok || !body.ok) {
        throw new Error(
          body.ok ? "apply_failed" : (body.error ?? "apply_failed"),
        );
      }

      toast.success(t("detail.issueCard.applySuccess"));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("detail.issueCard.applyFailed"),
      );
    } finally {
      setApplyingIssueId(null);
    }
  }

  async function dispatchArticle(issue: AuditIssueItem) {
    setDispatchingIssueId(issue.id);
    try {
      const response = await fetch(
        `/api/audit/issues/${issue.id}/dispatch-article`,
        {
          method: "POST",
        },
      );
      const body = (await response.json()) as
        | { ok: true; jobId: string }
        | { ok: false; reason?: string; error?: string };

      if (!response.ok || !body.ok) {
        throw new Error(
          body.ok
            ? "dispatch_failed"
            : (body.reason ?? body.error ?? "dispatch_failed"),
        );
      }

      toast.success("已派工到內容生成");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "派工失敗");
    } finally {
      setDispatchingIssueId(null);
    }
  }

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
                {issue.source === "gsc-cross" ? (
                  <Badge variant="secondary">
                    {t("issueSource.gsc-cross")}
                  </Badge>
                ) : null}
                {issue.edgeInjected ? <EdgeInjectedBadge /> : null}
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
            <IssueAction
              issue={issue}
              applyingIssueId={applyingIssueId}
              dispatchingIssueId={dispatchingIssueId}
              onApply={applyIssue}
              onDispatch={dispatchArticle}
              applyLabel={t("detail.issueCard.applyButton")}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function IssueAction({
  issue,
  applyingIssueId,
  dispatchingIssueId,
  onApply,
  onDispatch,
  applyLabel,
}: {
  issue: AuditIssueItem;
  applyingIssueId: string | null;
  dispatchingIssueId: string | null;
  onApply: (issue: AuditIssueItem) => void | Promise<void>;
  onDispatch: (issue: AuditIssueItem) => void | Promise<void>;
  applyLabel: string;
}) {
  if (issue.ruleId === "content.missing-topic") {
    if (issue.articleJobId) {
      return (
        <a
          href={`/dashboard/articles/${issue.articleJobId}`}
          className="max-w-64 truncate rounded-md border px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
        >
          已派工到內容生成 #{issue.articleJobId}
        </a>
      );
    }

    return (
      <Button
        disabled={dispatchingIssueId === issue.id}
        variant="outline"
        onClick={() => void onDispatch(issue)}
      >
        派工
      </Button>
    );
  }

  return (
    <Button
      disabled={!issue.autoApplyAvailable || applyingIssueId === issue.id}
      variant="outline"
      onClick={() => void onApply(issue)}
    >
      {applyLabel}
    </Button>
  );
}

function EdgeInjectedBadge() {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="border-green-200 bg-green-50 text-green-700"
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            邊緣已注入
          </Badge>
        </TooltipTrigger>
        <TooltipContent role="tooltip">
          Cloudflare Edge Worker 已從 KV 套用此 SEO 注入規則。
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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

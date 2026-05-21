"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Activity, ChevronRight, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/ui/table";
import { cn } from "@/lib/utils";

export type AuditSeverity = "critical" | "warning" | "info";

export interface AuditReportListItem {
  id: string;
  url: string;
  websiteId: string | null;
  scannedAt: string;
  healthScore: number;
  issueCounts: Record<AuditSeverity, number>;
  pendingReviewCount: number;
}

export interface AuditWebsiteOption {
  id: string;
  name: string;
  url: string;
}

interface AuditReportsListProps {
  reports: AuditReportListItem[];
  websites: AuditWebsiteOption[];
  selectedWebsiteId?: string;
  nextPageHref?: string;
}

const allWebsitesValue = "__all__";
const directUrlValue = "__direct_url__";

export function scoreBadgeClass(score: number) {
  if (score >= 80) return "border-green-200 bg-green-100 text-green-800";
  if (score >= 60) return "border-yellow-200 bg-yellow-100 text-yellow-800";
  return "border-red-200 bg-red-100 text-red-800";
}

export function AuditReportsList({
  reports,
  websites,
  selectedWebsiteId,
  nextPageHref,
}: AuditReportsListProps) {
  const t = useTranslations("audit");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanWebsiteId, setScanWebsiteId] = useState(
    websites[0]?.id ?? directUrlValue,
  );
  const [url, setUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedWebsite = useMemo(
    () => websites.find((website) => website.id === scanWebsiteId),
    [scanWebsiteId, websites],
  );

  function handleWebsiteFilter(value: string) {
    const params = new URLSearchParams(window.location.search);
    params.delete("page");
    if (value === allWebsitesValue) {
      params.delete("website");
    } else {
      params.set("website", value);
    }
    const query = params.toString();
    router.push(query ? `/dashboard/audit?${query}` : "/dashboard/audit");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsScanning(true);

    try {
      const payload =
        scanWebsiteId === directUrlValue
          ? { url: url.trim(), scope: "single-page" }
          : { websiteId: scanWebsiteId, scope: "single-page" };

      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? t("scan.failed"));
      }

      const redirectTo = body.redirect ?? body.data?.redirect;
      if (typeof redirectTo === "string") {
        router.push(redirectTo);
        router.refresh();
        return;
      }

      setDialogOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("scan.failed"));
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {reports.length > 0 ? `${reports.length} reports` : t("list.empty")}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-48">
            <Select
              value={selectedWebsiteId ?? allWebsitesValue}
              onValueChange={handleWebsiteFilter}
            >
              <SelectTrigger aria-label={t("list.filterByWebsite")}>
                <SelectValue placeholder={t("list.filterByWebsite")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allWebsitesValue}>
                  {t("list.filterByWebsite")}
                </SelectItem>
                {websites.map((website) => (
                  <SelectItem key={website.id} value={website.id}>
                    {website.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Play className="mr-2 h-4 w-4" />
                {t("list.newScanButton")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("scan.dialogTitle")}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="audit-website">
                    {t("scan.websiteLabel")}
                  </Label>
                  <Select
                    value={scanWebsiteId}
                    onValueChange={setScanWebsiteId}
                  >
                    <SelectTrigger id="audit-website">
                      <SelectValue placeholder={t("scan.websiteLabel")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={directUrlValue}>
                        {t("scan.urlLabel")}
                      </SelectItem>
                      {websites.map((website) => (
                        <SelectItem key={website.id} value={website.id}>
                          {website.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audit-url">{t("scan.urlLabel")}</Label>
                  <Input
                    id="audit-url"
                    type="url"
                    placeholder={selectedWebsite?.url ?? "https://example.com"}
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    disabled={scanWebsiteId !== directUrlValue}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("scan.scopeLabel")}</Label>
                  <Badge variant="outline">{t("scan.scopeSinglePage")}</Badge>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={isScanning} className="w-full">
                  {isScanning ? t("scan.scanning") : t("scan.submitButton")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center">
          <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("list.empty")}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("list.columns.url")}</TableHead>
                <TableHead>{t("list.columns.scannedAt")}</TableHead>
                <TableHead>{t("list.columns.healthScore")}</TableHead>
                <TableHead>{t("list.columns.issueCount")}</TableHead>
                <TableHead className="w-12">
                  {t("list.columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="max-w-[280px] truncate font-medium">
                    {report.url}
                  </TableCell>
                  <TableCell>{formatDateTime(report.scannedAt)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(scoreBadgeClass(report.healthScore))}
                    >
                      {report.healthScore}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-red-700">
                        {report.issueCounts.critical} critical
                      </span>
                      <span className="text-yellow-700">
                        {report.issueCounts.warning} warning
                      </span>
                      <span className="text-muted-foreground">
                        {report.issueCounts.info} info
                      </span>
                      {report.pendingReviewCount > 0 && (
                        <Badge variant="outline">
                          {t("review.tabLabel", {
                            count: report.pendingReviewCount,
                          })}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="icon">
                      <Link
                        href={`/dashboard/audit/${report.id}`}
                        aria-label={report.url}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {nextPageHref && (
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href={nextPageHref}>Next 20</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Checkbox } from "@shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/ui/dialog";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import { toast } from "sonner";
import type { AuditIssueItem } from "../AuditReportDetail";
import {
  approveAuditIssue,
  editAndApplyAuditIssue,
  rejectAuditIssue,
} from "../review-actions";

interface AuditReviewCardProps {
  issue: AuditIssueItem;
  selected: boolean;
  onSelectedChange: (issueId: string, selected: boolean) => void;
}

export function AuditReviewCard({
  issue,
  selected,
  onSelectedChange,
}: AuditReviewCardProps) {
  const t = useTranslations("audit.review");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [draftSuggested, setDraftSuggested] = useState(issue.suggested ?? "");

  function actionFormData(extra?: Record<string, string>) {
    const formData = new FormData();
    formData.set("issueId", issue.id);
    for (const [key, value] of Object.entries(extra ?? {})) {
      formData.set(key, value);
    }
    return formData;
  }

  function approve() {
    startTransition(async () => {
      const result = await approveAuditIssue(actionFormData());
      if (result.ok) {
        toast.success(t("approveSuccess", { rule: issue.ruleId }));
        router.refresh();
      } else {
        toast.error(t("approveFailed", { error: result.error ?? "unknown" }));
      }
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectAuditIssue(actionFormData());
      if (result.ok) {
        toast.success(t("rejectSuccess", { rule: issue.ruleId }));
        router.refresh();
      } else {
        toast.error(t("approveFailed", { error: result.error ?? "unknown" }));
      }
    });
  }

  function saveAndApply() {
    startTransition(async () => {
      const result = await editAndApplyAuditIssue(
        actionFormData({ newSuggested: draftSuggested }),
      );
      if (result.ok) {
        toast.success(t("approveSuccess", { rule: issue.ruleId }));
        setEditOpen(false);
        router.refresh();
      } else {
        toast.error(t("approveFailed", { error: result.error ?? "unknown" }));
      }
    });
  }

  const changed = issue.current.trim() !== (issue.suggested ?? "").trim();

  return (
    <article className="rounded-lg border bg-background p-4">
      <div className="flex gap-4">
        <Checkbox
          aria-label={issue.ruleId}
          checked={selected}
          onCheckedChange={(checked) =>
            onSelectedChange(issue.id, checked === true)
          }
          className="mt-1"
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{issue.severity}</Badge>
                <Badge variant="secondary">{issue.estimatedImpact}</Badge>
                <h3 className="font-mono text-sm font-semibold">
                  {issue.ruleId}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("impact", { impact: issue.estimatedImpact })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={approve}
                disabled={isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                {t("approveButton")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={reject}
                disabled={isPending}
              >
                <X className="mr-2 h-4 w-4" />
                {t("rejectButton")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditOpen(true)}
                disabled={isPending}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("editApplyButton")}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 text-sm">
            <ReviewValue label={t("current")} value={issue.current} />
            <ReviewValue
              label={t("suggested")}
              value={issue.suggested ?? "-"}
              changed={changed}
            />
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`suggested-${issue.id}`}>{t("suggested")}</Label>
            <Textarea
              id={`suggested-${issue.id}`}
              value={draftSuggested}
              onChange={(event) => setDraftSuggested(event.target.value)}
              className="min-h-36"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              {t("editDialog.cancel")}
            </Button>
            <Button
              type="button"
              onClick={saveAndApply}
              disabled={isPending || draftSuggested.trim().length === 0}
            >
              {t("editDialog.saveAndApply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function ReviewValue({
  label,
  value,
  changed = false,
}: {
  label: string;
  value: string;
  changed?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div
        className={
          changed
            ? "whitespace-pre-wrap rounded-md border border-green-200 bg-green-50 p-3 text-green-950"
            : "whitespace-pre-wrap rounded-md border bg-muted/30 p-3"
        }
      >
        {value}
      </div>
    </div>
  );
}

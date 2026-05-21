"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@shared/ui/button";
import { toast } from "sonner";
import { bulkApproveAuditIssues } from "../review-actions";

interface BulkActionsBarProps {
  selectedIssueIds: string[];
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedIssueIds,
  onClearSelection,
}: BulkActionsBarProps) {
  const t = useTranslations("audit.review");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function approveSelected() {
    startTransition(async () => {
      const formData = new FormData();
      for (const issueId of selectedIssueIds) {
        formData.append("issueIds", issueId);
      }

      const result = await bulkApproveAuditIssues(formData);
      if (result.ok) {
        toast.success(
          t("bulkApproveSuccess", { count: selectedIssueIds.length }),
        );
        onClearSelection();
        router.refresh();
        return;
      }

      const failed = result.results.find((item) => !item.ok);
      toast.error(
        t("approveFailed", { error: failed?.error ?? "bulk_approve_failed" }),
      );
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {t("selectedCount", { count: selectedIssueIds.length })}
      </p>
      <Button
        type="button"
        disabled={selectedIssueIds.length === 0 || isPending}
        onClick={approveSelected}
      >
        <CheckCheck className="mr-2 h-4 w-4" />
        {t("bulkApproveButton", { count: selectedIssueIds.length })}
      </Button>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

type RefundStatus =
  | "pending"
  | "retention_accepted"
  | "auto_processing"
  | "pending_review"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

interface RefundStatusBadgeProps {
  status: RefundStatus;
}

const statusClassNames: Record<RefundStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  retention_accepted: "bg-green-100 text-green-800",
  auto_processing: "bg-blue-100 text-blue-800",
  pending_review: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  processing: "bg-purple-100 text-purple-800",
  completed: "bg-green-200 text-green-900",
  rejected: "bg-red-100 text-red-800",
  failed: "bg-red-200 text-red-900",
};

const statusTranslationKeys: Record<RefundStatus, string> = {
  pending: "statusPending",
  retention_accepted: "statusRetentionAccepted",
  auto_processing: "statusAutoProcessing",
  pending_review: "statusPendingReview",
  approved: "statusApproved",
  processing: "statusProcessing",
  completed: "statusCompleted",
  rejected: "statusRejected",
  failed: "statusFailed",
};

export function RefundStatusBadge({ status }: RefundStatusBadgeProps) {
  const t = useTranslations("refund");
  const className = statusClassNames[status] || "bg-gray-100 text-gray-800";
  const translationKey = statusTranslationKeys[status];
  const label = translationKey ? t(translationKey) : status;

  return (
    <span className={`rounded-full px-2 py-1 text-xs ${className}`}>
      {label}
    </span>
  );
}

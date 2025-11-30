"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Gift } from "lucide-react";
import { REFERRAL_TOKEN_REWARD } from "@/types/referral.types";
import type { Referral } from "@/types/referral.types";

interface ReferralHistoryTableProps {
  referrals: Referral[];
}

export function ReferralHistoryTable({ referrals }: ReferralHistoryTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "rewarded":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            已獎勵
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
            <Gift className="h-3 w-3 mr-1" />
            已付款
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-400">
            <Clock className="h-3 w-3 mr-1" />
            待付款
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRewardDisplay = (referral: Referral) => {
    if (referral.status === "pending") {
      return <span className="text-muted-foreground">-</span>;
    }

    if (referral.status === "rewarded") {
      return (
        <span className="font-semibold text-green-600">
          +{REFERRAL_TOKEN_REWARD.toLocaleString()} tokens
        </span>
      );
    }

    return <span className="text-muted-foreground">處理中</span>;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>推薦對象</TableHead>
            <TableHead>推薦時間</TableHead>
            <TableHead>首次付款</TableHead>
            <TableHead>狀態</TableHead>
            <TableHead className="text-right">獎勵</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {referrals.map((referral) => (
            <TableRow key={referral.id}>
              <TableCell className="font-medium font-mono text-sm">
                {referral.referred_company_id.slice(0, 8)}...
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(referral.referred_at)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(referral.first_payment_at)}
              </TableCell>
              <TableCell>{getStatusBadge(referral.status)}</TableCell>
              <TableCell className="text-right">
                {getRewardDisplay(referral)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

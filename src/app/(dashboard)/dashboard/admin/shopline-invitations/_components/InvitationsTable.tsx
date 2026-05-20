"use client";

import { useState } from "react";
import { Ban, Check, Copy, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getInvitationStatus,
  type ShoplineInvitationStatus,
} from "@/lib/shopline/invitations";
import {
  revokeInvitationFormAction,
  type ShoplineInvitationWithCompany,
} from "../actions";

type InvitationsTableProps = {
  invitations: ShoplineInvitationWithCompany[];
  siteUrl: string;
};

const statusClasses: Record<ShoplineInvitationStatus, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  expired: "border-gray-200 bg-gray-100 text-gray-700",
  revoked: "border-red-200 bg-red-50 text-red-700",
};

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InvitationsTable({
  invitations,
  siteUrl,
}: InvitationsTableProps) {
  const locale = useLocale();
  const t = useTranslations("admin.shoplineInvitations");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");

  async function copyLink(token: string) {
    const link = `${normalizedSiteUrl}/connect/shopline/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(null), 1600);
  }

  if (invitations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("list.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.company")}</TableHead>
            <TableHead>{t("table.expectedHandle")}</TableHead>
            <TableHead>{t("table.status")}</TableHead>
            <TableHead>{t("table.redeemCount")}</TableHead>
            <TableHead>{t("table.expiresAt")}</TableHead>
            <TableHead>{t("table.createdAt")}</TableHead>
            <TableHead className="text-right">{t("table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => {
            const status = getInvitationStatus(invitation);
            const link = `${normalizedSiteUrl}/connect/shopline/${invitation.token}`;
            const isRevocable = status === "active";

            return (
              <TableRow key={invitation.token}>
                <TableCell className="font-medium">
                  {invitation.companyName}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {invitation.expectedShopHandle || "-"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusClasses[status]}>
                    {t(`status.${status}`)}
                  </Badge>
                </TableCell>
                <TableCell>{invitation.redeemCount}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(invitation.expiresAt, locale)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(invitation.createdAt, locale)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(invitation.token)}
                      title={
                        copiedToken === invitation.token
                          ? t("actions.copied")
                          : t("actions.copyLink")
                      }
                    >
                      {copiedToken === invitation.token ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {copiedToken === invitation.token
                          ? t("actions.copied")
                          : t("actions.copyLink")}
                      </span>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        title={t("actions.openLink")}
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">{t("actions.openLink")}</span>
                      </a>
                    </Button>
                    <form
                      action={revokeInvitationFormAction}
                      onSubmit={(event) => {
                        if (!window.confirm(t("actions.revokeConfirm"))) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input
                        type="hidden"
                        name="token"
                        value={invitation.token}
                      />
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={!isRevocable}
                        title={t("actions.revoke")}
                      >
                        <Ban className="h-4 w-4" />
                        <span className="sr-only">{t("actions.revoke")}</span>
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

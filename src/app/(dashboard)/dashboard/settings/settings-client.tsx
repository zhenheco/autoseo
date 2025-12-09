"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompany } from "./actions";
import { useTranslations } from "next-intl";
import { RefundRequestDialog } from "@/components/refund";

interface Company {
  id: string;
  name: string;
}

interface SettingsClientProps {
  company: Company;
  searchParams: { error?: string; success?: string; info?: string };
}

export function SettingsClient({ company, searchParams }: SettingsClientProps) {
  const t = useTranslations("settings");
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      {searchParams.error && (
        <div className="mb-6 rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          {searchParams.error}
        </div>
      )}
      {searchParams.success && (
        <div className="mb-6 rounded-md bg-green-500/15 p-4 text-sm text-green-700">
          {searchParams.success}
        </div>
      )}
      {searchParams.info && (
        <div className="mb-6 rounded-md bg-blue-500/15 p-4 text-sm text-blue-700">
          {searchParams.info}
        </div>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("accountInfo")}</CardTitle>
            <CardDescription>{t("accountInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCompany} className="space-y-4">
              <input type="hidden" name="companyId" value={company.id} />
              <div className="space-y-2">
                <Label htmlFor="company-name">{t("accountName")}</Label>
                <Input
                  id="company-name"
                  name="companyName"
                  defaultValue={company.name}
                  placeholder={t("accountNamePlaceholder")}
                  required
                />
              </div>
              <Button type="submit">{t("saveChanges")}</Button>
            </form>
          </CardContent>
        </Card>

        {/* Refund Request Card */}
        <Card>
          <CardHeader>
            <CardTitle>退款申請</CardTitle>
            <CardDescription>
              如果您對服務不滿意，可以在此申請退款
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                購買後 7 天內可自動退款，超過 7 天需經人工審核。
                退款完成後，您的訂閱將降級為 Free 方案，且相關 credits
                將被扣除。
              </p>
              <Button
                variant="outline"
                onClick={() => setRefundDialogOpen(true)}
              >
                申請退款
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <RefundRequestDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
      />
    </div>
  );
}

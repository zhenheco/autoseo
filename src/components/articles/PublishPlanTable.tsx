"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import type { PublishPlan } from "@/app/(dashboard)/dashboard/articles/import/page";

interface PublishPlanTableProps {
  plans: PublishPlan[];
  onPlansChange: (plans: PublishPlan[]) => void;
}

export function PublishPlanTable({
  plans,
  onPlansChange,
}: PublishPlanTableProps) {
  const t = useTranslations("articles.publishPlan");
  const [validatedPlans, setValidatedPlans] = useState<PublishPlan[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    validatePlans();
  }, [plans]);

  const validatePlans = async () => {
    setIsValidating(true);

    try {
      const response = await fetch("/api/websites");
      if (!response.ok) throw new Error(t("loadFailed"));

      const websites = await response.json();

      const validated = plans.map((plan) => {
        const match = websites.find(
          (w: { name: string; id: string }) =>
            w.name.toLowerCase() === plan.websiteName.toLowerCase(),
        );

        if (match) {
          return {
            ...plan,
            websiteId: match.id,
            status: "valid" as const,
          };
        } else {
          return {
            ...plan,
            status: "error" as const,
            errorMessage: t("websiteNotFound"),
          };
        }
      });

      setValidatedPlans(validated);
      onPlansChange(validated);
    } catch (error) {
      console.error("驗證失敗:", error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDelete = (planId: string) => {
    const updated = validatedPlans.filter((p) => p.id !== planId);
    setValidatedPlans(updated);
    onPlansChange(updated);
  };

  const getStatusIcon = (status: PublishPlan["status"]) => {
    switch (status) {
      case "valid":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: PublishPlan["status"]) => {
    switch (status) {
      case "valid":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            {t("status.valid")}
          </Badge>
        );
      case "warning":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            {t("status.warning")}
          </Badge>
        );
      case "error":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            {t("status.error")}
          </Badge>
        );
    }
  };

  const validCount = validatedPlans.filter((p) => p.status === "valid").length;
  const errorCount = validatedPlans.filter((p) => p.status === "error").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("summary", {
            total: validatedPlans.length,
            valid: validCount,
            error: errorCount,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t("columns.status")}</TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t("columns.keyword")}</TableHead>
                <TableHead>{t("columns.website")}</TableHead>
                <TableHead>{t("columns.type")}</TableHead>
                <TableHead>{t("columns.publishTime")}</TableHead>
                <TableHead>{t("columns.customSlug")}</TableHead>
                <TableHead className="w-24">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isValidating ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {t("validating")}
                  </TableCell>
                </TableRow>
              ) : validatedPlans.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {t("noData")}
                  </TableCell>
                </TableRow>
              ) : (
                validatedPlans.map((plan, index) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {getStatusIcon(plan.status)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {plan.keyword}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {plan.websiteName}
                        {plan.status === "error" && (
                          <span className="text-xs text-red-600">
                            ({plan.errorMessage})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan.articleType ? (
                        <Badge variant="secondary">{plan.articleType}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("aiDetermine")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {plan.publishTime || (
                        <span className="text-muted-foreground">
                          {t("bySchedule")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {plan.customSlug || (
                        <span className="text-muted-foreground">
                          {t("autoGenerate")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

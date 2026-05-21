import Link from "next/link";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function UnauthorizedPage() {
  const t = await getTranslations("unauthorized");

  return (
    <div className="container mx-auto p-8 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">{t("general.title")}</CardTitle>
          <CardDescription className="text-base mt-2">
            {t("general.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("general.contactAdmin")}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard/articles">
              <Button variant="outline">{t("general.backToArticles")}</Button>
            </Link>
            <Link href="/dashboard">
              <Button>{t("general.backToHome")}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

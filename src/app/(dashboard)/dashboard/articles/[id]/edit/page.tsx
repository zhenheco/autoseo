"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ArticleEditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const t = useTranslations("articles.detail");

  useEffect(() => {
    // Redirect to main articles page
    router.replace("/dashboard/articles");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">{t("redirectingToManage")}</p>
    </div>
  );
}

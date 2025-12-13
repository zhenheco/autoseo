import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-6">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">
            {t("resetPassword")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t("resetPasswordDesc")}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <Suspense
            fallback={
              <div className="text-center text-muted-foreground">載入中...</div>
            }
          >
            <ResetPasswordForm error={params.error} success={params.success} />
          </Suspense>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-8 px-8">
          <Link
            href="/login"
            className="underline underline-offset-2 hover:text-foreground transition-all"
          >
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}

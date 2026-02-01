import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

type AuthMode = "signin" | "signup" | "forgot";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth");

  // 從 URL 參數獲取模式
  const mode = (params.mode as AuthMode) || "signin";

  // 根據模式選擇標題和描述
  const getTitleAndDesc = () => {
    switch (mode) {
      case "signup":
        return {
          title: t("createAccount"),
          desc: t("createAccountDesc"),
        };
      case "forgot":
        return {
          title: t("forgotPassword"),
          desc: t("forgotPasswordDesc"),
        };
      default:
        return {
          title: t("welcomeBack"),
          desc: t("welcomeBackDesc"),
        };
    }
  };

  const { title, desc } = getTitleAndDesc();

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
            {title}
          </h1>
          <p className="text-base text-muted-foreground">{desc}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <Suspense
            fallback={
              <div className="text-center text-muted-foreground">{t("loading")}</div>
            }
          >
            <LoginForm
              error={params.error}
              success={params.success}
              initialMode={mode}
            />
          </Suspense>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-8 px-8">
          {t("termsAgreement")}{" "}
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-foreground transition-all"
          >
            {t("termsOfService")}
          </Link>{" "}
          {t("and")}{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-foreground transition-all"
          >
            {t("privacyPolicy")}
          </Link>
        </p>
      </div>
    </div>
  );
}

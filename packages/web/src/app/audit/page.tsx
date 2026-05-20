import { getTranslations } from "next-intl/server";
import { PublicAuditForm } from "./_components/PublicAuditForm";

export default async function PublicAuditPage() {
  const t = await getTranslations("publicAudit");

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-5 py-10 sm:px-8 lg:grid lg:grid-cols-[1fr_420px] lg:items-center lg:gap-14">
        <div className="max-w-3xl space-y-7">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-emerald-700">1waySEO</p>
            <h1 className="text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              {t("subtitle")}
            </p>
          </div>
          <PublicAuditForm
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
            labels={{
              urlLabel: t("urlLabel"),
              urlPlaceholder: t("urlPlaceholder"),
              submitButton: t("submitButton"),
              scanning: t("scanning"),
              scanningSteps: {
                fetching: t("scanningSteps.fetching"),
                analyzing: t("scanningSteps.analyzing"),
                scoring: t("scanningSteps.scoring"),
              },
              result: {
                scoreTitle: t("result.scoreTitle"),
                topIssuesTitle: t("result.topIssuesTitle"),
                totalIssues: t("result.totalIssues", { count: 0 }),
                ctaTitle: t("result.ctaTitle"),
                ctaSubtitle: t("result.ctaSubtitle"),
                ctaButton: t("result.ctaButton"),
              },
              errors: {
                turnstileInvalid: t("errors.turnstileInvalid"),
                rateLimited: t("errors.rateLimited"),
                fetchFailed: t("errors.fetchFailed"),
                invalidUrl: t("errors.invalidUrl"),
              },
            }}
          />
        </div>
        <aside className="hidden rounded-lg border border-slate-200 bg-slate-50 p-6 shadow-sm lg:block">
          <div className="space-y-5">
            <div>
              <p className="text-sm text-slate-500">{t("result.scoreTitle")}</p>
              <p className="mt-2 text-6xl font-bold text-emerald-600">86</p>
            </div>
            <div className="space-y-3">
              {[
                "meta.description.missing",
                "h1.duplicate",
                "image.alt.missing",
              ].map((rule) => (
                <div
                  key={rule}
                  className="rounded-md border border-slate-200 bg-white p-3"
                >
                  <p className="text-sm font-medium text-slate-900">{rule}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    https://your-shop.com
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

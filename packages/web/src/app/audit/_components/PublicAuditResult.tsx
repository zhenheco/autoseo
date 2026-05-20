import Link from "next/link";
import type { PublicAuditLabels } from "./PublicAuditForm";

export type PublicAuditResultData = {
  reportId: string;
  healthScore: number;
  totalIssues: number;
  topIssues: Array<{
    rule: string;
    page: string;
    impact: string;
  }>;
};

type PublicAuditResultProps = {
  result: PublicAuditResultData;
  labels: PublicAuditLabels["result"];
};

export function PublicAuditResult({ result, labels }: PublicAuditResultProps) {
  return (
    <section
      aria-label={labels.scoreTitle}
      className="mt-6 w-full max-w-2xl space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">
            {labels.scoreTitle}
          </p>
          <p className="mt-2 text-6xl font-bold text-emerald-600">
            {result.healthScore}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {labels.totalIssuesTemplate.replace(
            "{count}",
            String(result.totalIssues),
          )}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          {labels.topIssuesTitle}
        </h2>
        <div className="mt-3 space-y-3">
          {result.topIssues.map((issue) => (
            <article
              key={`${issue.rule}:${issue.page}`}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <p className="text-sm font-semibold text-slate-950">
                {issue.rule}
              </p>
              <p className="mt-1 break-words text-xs text-slate-500">
                {issue.page}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {issue.impact}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-md bg-emerald-50 p-4">
        <h2 className="text-base font-semibold text-emerald-950">
          {labels.ctaTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-emerald-900">
          {labels.ctaSubtitle}
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-flex min-h-10 items-center rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          {labels.ctaButton}
        </Link>
      </div>
    </section>
  );
}

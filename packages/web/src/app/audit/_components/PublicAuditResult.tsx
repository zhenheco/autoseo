"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
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
  emailFormLabels: PublicAuditLabels["emailForm"];
};

export function PublicAuditResult({
  result,
  labels,
  emailFormLabels,
}: PublicAuditResultProps) {
  const [email, setEmail] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  async function onEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIsSubmittingEmail(true);
      const response = await fetch("/api/public/audit/lead-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: result.reportId, email }),
      });

      if (!response.ok) {
        toast.error(emailFormLabels.errorToast);
        return;
      }

      toast.success(emailFormLabels.successToast);
      setEmail("");
    } catch {
      toast.error(emailFormLabels.errorToast);
    } finally {
      setIsSubmittingEmail(false);
    }
  }

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

      <form
        className="rounded-md border border-slate-200 bg-slate-50 p-4"
        onSubmit={onEmailSubmit}
      >
        <h2 className="text-base font-semibold text-slate-950">
          {emailFormLabels.title}
        </h2>
        <label
          htmlFor="audit-lead-email"
          className="mt-3 block text-sm font-medium text-slate-700"
        >
          {emailFormLabels.label}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="audit-lead-email"
            type="email"
            required
            value={email}
            placeholder={emailFormLabels.placeholder}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            disabled={isSubmittingEmail}
            className="min-h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {emailFormLabels.submitButton}
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {emailFormLabels.privacyHint}
        </p>
      </form>
    </section>
  );
}

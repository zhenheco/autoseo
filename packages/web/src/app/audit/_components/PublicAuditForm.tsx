"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  PublicAuditResult,
  type PublicAuditResultData,
} from "./PublicAuditResult";

export type PublicAuditLabels = {
  urlLabel: string;
  urlPlaceholder: string;
  submitButton: string;
  scanning: string;
  scanningSteps: {
    fetching: string;
    analyzing: string;
    scoring: string;
  };
  result: {
    scoreTitle: string;
    topIssuesTitle: string;
    totalIssuesTemplate: string;
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButton: string;
  };
  emailForm: {
    title: string;
    label: string;
    placeholder: string;
    submitButton: string;
    successToast: string;
    errorToast: string;
    privacyHint: string;
  };
  errors: {
    turnstileInvalid: string;
    rateLimited: string;
    fetchFailed: string;
    invalidUrl: string;
  };
};

type PublicAuditFormProps = {
  siteKey: string;
  labels: PublicAuditLabels;
};

export function PublicAuditForm({ siteKey, labels }: PublicAuditFormProps) {
  const [url, setUrl] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<PublicAuditResultData | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidUrl(url)) {
      setError(labels.errors.invalidUrl);
      return;
    }

    if (!turnstileToken) {
      setError(labels.errors.turnstileInvalid);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/public/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, turnstileToken }),
      });
      const payload = (await response.json()) as
        | PublicAuditResultData
        | { error?: string };

      if (!response.ok) {
        setError(
          errorMessageFor((payload as { error?: string }).error, labels),
        );
        return;
      }

      setResult(payload as PublicAuditResultData);
    } catch {
      setError(labels.errors.fetchFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <form
        className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        onSubmit={onSubmit}
      >
        <label
          htmlFor="audit-url"
          className="text-sm font-medium text-slate-700"
        >
          {labels.urlLabel}
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="audit-url"
            type="url"
            value={url}
            placeholder={labels.urlPlaceholder}
            onChange={(event) => setUrl(event.target.value)}
            className="min-h-12 flex-1 rounded-md border border-slate-300 px-4 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-12 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting ? labels.scanning : labels.submitButton}
          </button>
        </div>
        <div className="mt-4">
          {siteKey ? (
            <Turnstile
              siteKey={siteKey}
              onSuccess={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              onError={() => setTurnstileToken("")}
            />
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {labels.errors.turnstileInvalid}
            </div>
          )}
        </div>
        {isSubmitting && (
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>{labels.scanning}</p>
            <ol className="grid gap-2 sm:grid-cols-3">
              {Object.values(labels.scanningSteps).map((step) => (
                <li
                  key={step}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
      </form>
      {result && (
        <PublicAuditResult
          result={result}
          labels={labels.result}
          emailFormLabels={labels.emailForm}
        />
      )}
    </>
  );
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function errorMessageFor(code: string | undefined, labels: PublicAuditLabels) {
  if (code === "rate_limited") return labels.errors.rateLimited;
  if (code === "audit_fetch_failed") return labels.errors.fetchFailed;
  if (code === "invalid_url") return labels.errors.invalidUrl;
  return labels.errors.turnstileInvalid;
}

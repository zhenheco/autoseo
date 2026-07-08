"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";

type SubmitState = "idle" | "submitting" | "success" | "duplicate" | "error";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SIGNUP_HREF = "/signup?plan=solo_monthly";

export function FinalCTA() {
  const t = useTranslations("lp.finalCta");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SubmitState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!emailPattern.test(trimmedEmail)) {
      setValidationError(t("invalidEmail"));
      setStatus("idle");
      return;
    }

    setValidationError(null);
    setStatus("submitting");

    try {
      const response = await fetch("/api/marketing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus("success");
        setEmail("");
        return;
      }

      setStatus(response.status === 409 ? "duplicate" : "error");
    } catch {
      setStatus("error");
    }
  }

  const statusMessage =
    validationError ??
    (status === "success"
      ? t("success")
      : status === "duplicate"
        ? t("duplicate")
        : status === "error"
          ? t("error")
          : null);

  return (
    <section className="border-b border-border bg-bg-elevated py-20 md:py-28">
      <div className="container-section">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-body-sm font-semibold uppercase text-primary">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 text-balance text-h2 font-bold tracking-normal text-foreground">
              {t("headline")}
            </h2>
            <p className="mt-4 text-pretty text-body leading-relaxed text-muted-foreground">
              {t("subheadline")}
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 h-12 rounded-md text-body font-semibold"
            >
              <Link href={DEFAULT_SIGNUP_HREF}>
                {t("primaryCta")}
                <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <form
            className="rounded-md border border-border bg-card p-5 shadow-sm"
            noValidate
            onSubmit={handleSubmit}
          >
            <label
              className="text-body-sm font-semibold text-foreground"
              htmlFor="final-cta-email"
            >
              {t("emailLabel")}
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="final-cta-email"
                  type="email"
                  value={email}
                  placeholder={t("emailPlaceholder")}
                  className="h-12 rounded-md pl-10 text-body"
                  aria-invalid={Boolean(validationError)}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (validationError) setValidationError(null);
                  }}
                />
              </div>
              <Button
                type="submit"
                className="h-12 rounded-md px-5 text-body font-semibold"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? (
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 h-4 w-4 animate-spin"
                  />
                ) : null}
                {t("emailSubmit")}
              </Button>
            </div>
            <p className="mt-3 text-body-sm leading-relaxed text-muted-foreground">
              {t("emailHelp")}
            </p>
            {statusMessage ? (
              <p
                className="mt-3 text-body-sm font-medium text-foreground"
                role="status"
              >
                {statusMessage}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Brand } from "@/lib/brands/active-brand";

type BrandDashboardProps = {
  brands: Brand[];
  brandsCap: number;
  planLabel: string;
  websiteCountsByBrand: Record<string, number>;
};

export function BrandsDashboard({
  brands,
  brandsCap,
  planLabel,
  websiteCountsByBrand,
}: BrandDashboardProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAtCap = brands.length >= brandsCap;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const valueProps = String(formData.get("valueProps") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? ""),
          voiceTone: nullableFormValue(formData.get("voiceTone")),
          valueProps: valueProps.length > 0 ? valueProps : null,
        }),
      });
      const body = (await response.json()) as {
        success?: boolean;
        data?: { id?: string };
      };

      if (!response.ok || !body.success || !body.data?.id) {
        setErrorMessage(t("failedToCreate"));
        return;
      }

      router.refresh();
      router.push(
        `/dashboard/brands/${body.data.id}/memory?brand=${body.data.id}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <header>
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
        <p>
          {t("quotaUsage", {
            used: brands.length,
            cap: brandsCap,
            plan: planLabel,
          })}
        </p>
        <button
          type="button"
          disabled={isAtCap}
          onClick={() => setIsDialogOpen(true)}
        >
          {t("addBrand")}
        </button>
      </header>

      {brands.length === 0 ? (
        <section>
          <h2>{t("noBrandsYet")}</h2>
          <button type="button" onClick={() => setIsDialogOpen(true)}>
            {t("createFirstBrand")}
          </button>
        </section>
      ) : (
        <section>
          {brands.map((brand) => (
            <article key={brand.id}>
              <h2>{brand.name}</h2>
              {brand.is_default ? <span>{t("defaultBadge")}</span> : null}
              <dl>
                <dt>{t("websitesLinked")}</dt>
                <dd>{websiteCountsByBrand[brand.id] ?? 0}</dd>
                <dt>{t("socialAccountsLinked")}</dt>
                <dd>{t("socialAccountsUnavailable")}</dd>
                <dt>{t("created")}</dt>
                <dd>{formatDate(brand.created_at)}</dd>
              </dl>
              <button type="button">{t("edit")}</button>
              <button type="button">{t("delete")}</button>
            </article>
          ))}
        </section>
      )}

      {isDialogOpen ? (
        <div role="dialog" aria-modal="true" aria-label={t("addBrand")}>
          <form aria-label={t("addBrand")} onSubmit={handleSubmit}>
            <label>
              {t("name")}
              <input name="name" required />
            </label>
            <label>
              {t("voiceTone")}
              <input name="voiceTone" />
            </label>
            <label>
              {t("valueProps")}
              <input
                name="valueProps"
                placeholder={t("valuePropsPlaceholder")}
              />
            </label>
            {errorMessage ? <p role="alert">{errorMessage}</p> : null}
            <button type="button" onClick={() => setIsDialogOpen(false)}>
              {t("cancel")}
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("creating") : t("create")}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function nullableFormValue(value: FormDataEntryValue | null): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

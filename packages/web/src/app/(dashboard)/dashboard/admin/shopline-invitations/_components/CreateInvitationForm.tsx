"use client";

import { FormEvent, useState, useTransition } from "react";
import { AlertCircle, CalendarClock, ExternalLink, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { Textarea } from "@shared/ui/textarea";
import {
  createInvitationAction,
  createInvitationFromUrlAction,
  type AdminCompanyOption,
  type CreateInvitationFromUrlResult,
  type CreateInvitationResult,
} from "../actions";

type CreateInvitationFormProps = {
  companies: AdminCompanyOption[];
};

function focusAdvancedHandleInput() {
  window.setTimeout(() => {
    document.getElementById("expected_shop_handle")?.focus();
  }, 0);
}

export function CreateInvitationForm({ companies }: CreateInvitationFormProps) {
  const t = useTranslations("admin.shoplineInvitations");
  const [fromUrlResult, setFromUrlResult] =
    useState<CreateInvitationFromUrlResult | null>(null);
  const [advancedResult, setAdvancedResult] =
    useState<CreateInvitationResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submitFromUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createInvitationFromUrlAction(formData);
      setFromUrlResult(result);
    });
  }

  function submitAdvanced(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createInvitationAction(formData);
      setAdvancedResult(result);
    });
  }

  function openAdvancedMode() {
    setAdvancedOpen(true);
    focusAdvancedHandleInput();
  }

  const fromUrlParseFailed =
    fromUrlResult &&
    !fromUrlResult.ok &&
    fromUrlResult.error === "parse_failed";

  return (
    <div className="space-y-6">
      <form onSubmit={submitFromUrl} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="storeUrl">{t("fromUrl.urlLabel")}</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="storeUrl"
              name="storeUrl"
              type="url"
              placeholder={t("fromUrl.urlPlaceholder")}
              autoComplete="url"
              required
              className="sm:flex-1"
            />
            <Button type="submit" disabled={isPending}>
              <Plus className="h-4 w-4" />
              {t("fromUrl.submitButton")}
            </Button>
          </div>
        </div>

        {fromUrlResult?.ok ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <div className="font-medium">
              {t("fromUrl.parsedHandlePreview")}
              <span className="font-mono">{fromUrlResult.parsedHandle}</span>
            </div>
            <a
              href={fromUrlResult.link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-green-900 underline underline-offset-4"
            >
              {fromUrlResult.link}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : null}

        {fromUrlParseFailed ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <div className="font-medium">
                  {t("fromUrl.parseFailedTitle")}
                </div>
                <p>{t("fromUrl.parseFailedHint")}</p>
                <button
                  type="button"
                  onClick={openAdvancedMode}
                  className="font-medium underline underline-offset-4"
                >
                  {t("fromUrl.advancedToggle")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </form>

      <details
        id="advanced-shopline-invitation"
        open={advancedOpen}
        onToggle={(event) => {
          setAdvancedOpen(event.currentTarget.open);
        }}
        className="rounded-md border bg-muted/30 p-4"
      >
        <summary className="cursor-pointer text-sm font-medium">
          {t("fromUrl.advancedToggle")}
        </summary>

        <form
          onSubmit={submitAdvanced}
          className="mt-4 grid gap-5 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="companyId">{t("createForm.companyLabel")}</Label>
            <select
              id="companyId"
              name="companyId"
              aria-label={t("createForm.companyPlaceholder")}
              required
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ttlDays">{t("createForm.ttlHint")}</Label>
            <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {t("createForm.ttlHint")}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_shop_handle">
              {t("createForm.expectedShopHandleLabel")}
            </Label>
            <Input
              id="expected_shop_handle"
              name="expected_shop_handle"
              placeholder={t("createForm.expectedShopHandlePlaceholder")}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">{t("createForm.noteLabel")}</Label>
            <Textarea
              id="note"
              name="note"
              placeholder={t("createForm.notePlaceholder")}
              className="min-h-9"
            />
          </div>

          {advancedResult?.ok ? (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 md:col-span-2">
              <a
                href={advancedResult.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-4"
              >
                {advancedResult.link}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}

          {advancedResult && !advancedResult.ok ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 md:col-span-2">
              {t("errors.createFailed")}
            </div>
          ) : null}

          <div className="md:col-span-2">
            <Button type="submit" disabled={isPending}>
              <Plus className="h-4 w-4" />
              {t("createForm.submitButton")}
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}

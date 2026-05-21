"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@shared/ui/alert-dialog";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Label } from "@shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@shared/ui/radio-group";
import { Switch } from "@shared/ui/switch";
import { IconLabel } from "@/components/ui/icon-label";
import { getGoldenSlotOptions } from "@/lib/scheduling/golden-slots";
import { cn } from "@/lib/utils";

type AutomationBrand = {
  id: string;
  name: string;
  automation_level: number;
  auto_articles_per_week: number;
  auto_publish_to_social: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOMATION_LEVELS = [
  {
    value: 1,
    title: "L1 全手動",
    subtitle: "Full manual",
    description: "You create, review, schedule, and publish every article.",
  },
  {
    value: 2,
    title: "L2 半自動建議",
    subtitle: "Recommendation only",
    description:
      "1waySEO prepares recommendations while every action stays manual.",
  },
  {
    value: 3,
    title: "L3 排程",
    subtitle: "Scheduled with human review",
    description:
      "Articles can be planned into golden slots after human approval.",
  },
  {
    value: 4,
    title: "L4 全自動",
    subtitle: "Fully autonomous",
    description:
      "1waySEO can generate, schedule, publish, and distribute automatically.",
  },
] as const;

export function AutomationSettingsClient({
  brand,
}: {
  brand: AutomationBrand;
}) {
  const router = useRouter();
  const [automationLevel, setAutomationLevel] = useState(
    clampAutomationLevel(brand.automation_level),
  );
  const [articlesPerWeek, setArticlesPerWeek] = useState(
    clampArticlesPerWeek(brand.auto_articles_per_week),
  );
  const [autoPublishToSocial, setAutoPublishToSocial] = useState(
    brand.auto_publish_to_social,
  );
  const [confirmL4Open, setConfirmL4Open] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const weeklyPreview = useMemo(
    () => buildWeeklyPreview(articlesPerWeek),
    [articlesPerWeek],
  );

  function handleAutomationLevelChange(nextValue: string) {
    const nextLevel = Number(nextValue);
    if (nextLevel === 4 && automationLevel !== 4) {
      setConfirmL4Open(true);
      return;
    }
    setAutomationLevel(clampAutomationLevel(nextLevel));
  }

  async function handleSave() {
    setSaveState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/brands/${brand.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          automationLevel,
          autoArticlesPerWeek: articlesPerWeek,
          autoPublishToSocial,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || body?.success === false) {
        throw new Error(body?.error ?? "Failed to save automation settings.");
      }

      setSaveState("saved");
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save automation settings.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Active brand: {brand.name}
        </p>
        <h1 className="text-3xl font-semibold tracking-normal">
          Automation settings
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Control how much of this brand&apos;s article workflow 1waySEO can
          handle automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation level</CardTitle>
          <CardDescription>
            Pick the operating mode for this brand&apos;s content workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={String(automationLevel)}
            onValueChange={handleAutomationLevelChange}
            className="grid gap-3 md:grid-cols-2"
          >
            {AUTOMATION_LEVELS.map((level) => (
              <Label
                key={level.value}
                htmlFor={`automation-level-${level.value}`}
                className={cn(
                  "flex min-h-36 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                  "hover:bg-muted/50",
                  automationLevel === level.value
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <RadioGroupItem
                  value={String(level.value)}
                  id={`automation-level-${level.value}`}
                  className="mt-1"
                />
                <span className="min-w-0 space-y-2">
                  <span className="block text-base font-semibold">
                    {level.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {level.subtitle}
                  </span>
                  <span className="block text-sm font-normal leading-6 text-muted-foreground">
                    {level.description}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="auto-articles-per-week">
                  Articles per week
                </Label>
                <p className="text-sm text-muted-foreground">
                  auto_articles_per_week: {articlesPerWeek}
                </p>
              </div>
              <span className="w-12 text-right text-lg font-semibold">
                {articlesPerWeek}
              </span>
            </div>
            <input
              id="auto-articles-per-week"
              type="range"
              min={0}
              max={14}
              step={1}
              value={articlesPerWeek}
              aria-label="Articles per week"
              className="w-full accent-primary"
              onChange={(event) =>
                setArticlesPerWeek(
                  clampArticlesPerWeek(Number(event.target.value)),
                )
              }
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>14</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="auto-publish-to-social">
                Publish to social automatically
              </Label>
              <p className="text-sm text-muted-foreground">
                auto_publish_to_social controls whether approved automation can
                distribute posts to connected social channels.
              </p>
            </div>
            <Switch
              id="auto-publish-to-social"
              checked={autoPublishToSocial}
              aria-label="Publish to social automatically"
              onCheckedChange={setAutoPublishToSocial}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Saving..." : "Save"}
            </Button>
            {saveState === "saved" && (
              <IconLabel
                as="p"
                className="text-sm text-success-700"
                icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              >
                Settings saved.
              </IconLabel>
            )}
            {saveState === "error" && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <IconLabel
              icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
            >
              Weekly preview
            </IconLabel>
          </CardTitle>
          <CardDescription>
            If you switch to L3 / L4 today, this week&apos;s plan would be:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base font-medium">
            {weeklyPreview.count} articles, scheduled at golden slots
          </p>
          {weeklyPreview.slots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {weeklyPreview.slots.map((slot, index) => (
                <span
                  key={`${slot}-${index}`}
                  className="rounded-md border bg-muted/40 px-3 py-1 text-sm"
                >
                  {slot}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No articles will be scheduled while the weekly target is 0.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmL4Open} onOpenChange={setConfirmL4Open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <IconLabel
                icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
              >
                Enable L4 automation?
              </IconLabel>
            </AlertDialogTitle>
            <AlertDialogDescription>
              L4 can fully automate article generation, scheduling, publishing,
              and distribution. If auto-publish-to-social is enabled, social
              posts may also be published automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAutomationLevel(4);
                setConfirmL4Open(false);
              }}
            >
              Enable L4
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function clampAutomationLevel(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(4, Math.trunc(value)));
}

function clampArticlesPerWeek(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(14, Math.trunc(value)));
}

function buildWeeklyPreview(count: number) {
  const goldenSlots = getGoldenSlotOptions("zh-TW").map(
    (slot) => slot.label.split(" ")[0],
  );
  const normalizedCount = clampArticlesPerWeek(count);

  return {
    count: normalizedCount,
    slots: Array.from(
      { length: normalizedCount },
      (_, index) => goldenSlots[index % goldenSlots.length] ?? "09:00",
    ),
  };
}

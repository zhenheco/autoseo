"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Checkbox } from "@shared/ui/checkbox";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@shared/ui/radio-group";
import { AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { BrandSwitcher } from "@/components/ui/brand-switcher";
import type { DashboardTrendSignal } from "@/components/dashboard/TrendsWidget";

type BrandOption = {
  id: string;
  name: string;
};

type StructureTemplate = "standard" | "listicle" | "how-to" | "comparison";
type TopicTemplate = "long-form" | "tutorial" | "comparison";

type WizardDraft = {
  topic: string;
  selectedSignalId: string | null;
  topicTemplate: TopicTemplate | null;
  wordCount: string;
  structureTemplate: StructureTemplate;
  translateLocales: string[];
};

type GenerateResponse = {
  articleJobId?: string;
  jobId?: string;
  data?: {
    jobId?: string;
    articleJobId?: string;
  };
  error?: string;
  message?: string;
  upgradeUrl?: string;
};

type ArticleGenerationWizardClientProps = {
  brands: BrandOption[];
  activeBrandId: string | null;
  initialTopic?: string | null;
  initialTrendSignalId?: string | null;
};

const DEFAULT_DRAFT: WizardDraft = {
  topic: "",
  selectedSignalId: null,
  topicTemplate: null,
  wordCount: "1500",
  structureTemplate: "standard",
  translateLocales: [],
};

const TOPIC_TEMPLATES: Array<{ value: TopicTemplate; label: string }> = [
  { value: "long-form", label: "Long-form" },
  { value: "tutorial", label: "Tutorial" },
  { value: "comparison", label: "Comparison" },
];

const STRUCTURE_TEMPLATES: Array<{
  value: StructureTemplate;
  label: string;
}> = [
  { value: "standard", label: "Standard" },
  { value: "listicle", label: "Listicle" },
  { value: "how-to", label: "How-to" },
  { value: "comparison", label: "Comparison" },
];

const TRANSLATION_LOCALES = [
  { value: "en-US", label: "English" },
  { value: "ja-JP", label: "Japanese" },
  { value: "ko-KR", label: "Korean" },
  { value: "de-DE", label: "German" },
  { value: "es-ES", label: "Spanish" },
  { value: "fr-FR", label: "French" },
];

const SOURCE_LABELS: Record<DashboardTrendSignal["source"], string> = {
  perplexity: "Perplexity",
  gsc: "GSC",
  google_trends: "Google Trends",
  manual: "Manual",
};

function draftStorageKey(brandId: string) {
  return `${brandId}-wizard-draft`;
}

function readDraft(brandId: string): WizardDraft {
  try {
    const saved = localStorage.getItem(draftStorageKey(brandId));
    if (!saved) return DEFAULT_DRAFT;
    const parsed = JSON.parse(saved) as Partial<WizardDraft>;
    return {
      ...DEFAULT_DRAFT,
      ...parsed,
      translateLocales: Array.isArray(parsed.translateLocales)
        ? parsed.translateLocales.filter((locale): locale is string =>
            TRANSLATION_LOCALES.some((option) => option.value === locale),
          )
        : [],
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function getJobId(body: GenerateResponse) {
  return (
    body.articleJobId ||
    body.jobId ||
    body.data?.articleJobId ||
    body.data?.jobId ||
    null
  );
}

function confidencePercent(confidence: number) {
  if (!Number.isFinite(confidence)) return 0;
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

export function ArticleGenerationWizardClient({
  brands,
  activeBrandId,
  initialTopic,
  initialTrendSignalId,
}: ArticleGenerationWizardClientProps) {
  const router = useRouter();
  const fallbackBrandId = activeBrandId ?? brands[0]?.id ?? null;
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(
    fallbackBrandId,
  );
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<WizardDraft>(DEFAULT_DRAFT);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [signals, setSignals] = useState<DashboardTrendSignal[]>([]);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === selectedBrandId) ?? null,
    [brands, selectedBrandId],
  );

  useEffect(() => {
    if (!selectedBrandId) return;
    const savedDraft = readDraft(selectedBrandId);
    setDraft({
      ...savedDraft,
      ...(initialTopic
        ? {
            topic: initialTopic,
            selectedSignalId: initialTrendSignalId ?? null,
            topicTemplate: null,
          }
        : {}),
    });
    setStepError(null);
    setSubmitError(null);
    setIsDraftLoaded(true);
  }, [initialTopic, initialTrendSignalId, selectedBrandId]);

  useEffect(() => {
    if (!selectedBrandId || !isDraftLoaded) return;
    localStorage.setItem(
      draftStorageKey(selectedBrandId),
      JSON.stringify(draft),
    );
  }, [draft, isDraftLoaded, selectedBrandId]);

  useEffect(() => {
    if (!selectedBrandId) {
      setSignals([]);
      return;
    }

    const brandId = selectedBrandId;
    let isMounted = true;
    setIsLoadingSignals(true);

    async function loadSignals() {
      try {
        const response = await fetch(
          `/api/trends?brand=${encodeURIComponent(brandId)}`,
        );
        if (!response.ok) throw new Error("Failed to load trend signals");
        const body = (await response.json()) as {
          signals?: DashboardTrendSignal[];
        };
        if (isMounted) {
          setSignals((body.signals ?? []).slice(0, 5));
        }
      } catch {
        if (isMounted) setSignals([]);
      } finally {
        if (isMounted) setIsLoadingSignals(false);
      }
    }

    void loadSignals();

    return () => {
      isMounted = false;
    };
  }, [selectedBrandId]);

  function updateDraft(patch: Partial<WizardDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function selectSignal(signal: DashboardTrendSignal) {
    updateDraft({
      topic: signal.topic,
      selectedSignalId: signal.id,
      topicTemplate: null,
    });
    setStepError(null);
  }

  function selectTopicTemplate(topicTemplate: TopicTemplate) {
    updateDraft({
      topicTemplate,
      selectedSignalId: null,
      ...(topicTemplate === "comparison"
        ? { structureTemplate: "comparison" as StructureTemplate }
        : {}),
    });
  }

  function toggleLocale(locale: string, checked: boolean) {
    updateDraft({
      translateLocales: checked
        ? [...new Set([...draft.translateLocales, locale])]
        : draft.translateLocales.filter((item) => item !== locale),
    });
  }

  function continueToNextStep() {
    if (step === 1 && !selectedBrandId) {
      setStepError("Choose a brand before continuing.");
      return;
    }

    if (step === 2 && draft.topic.trim().length === 0) {
      setStepError("Choose a trend signal or enter a topic.");
      return;
    }

    setStepError(null);
    setStep((current) => Math.min(4, current + 1));
  }

  async function submit() {
    if (!selectedBrandId || draft.topic.trim().length === 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload = {
      keyword: draft.topic.trim(),
      title: draft.topic.trim(),
      mode: "wizard",
      brandId: selectedBrandId,
      brand_id: selectedBrandId,
      sourceTrendSignalId: draft.selectedSignalId,
      topicTemplate: draft.topicTemplate,
      wordCount: draft.wordCount,
      structureTemplate: draft.structureTemplate,
      translateLocales: draft.translateLocales,
    };

    try {
      const response = await fetch("/api/articles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as GenerateResponse;

      if (response.status === 402) {
        setSubmitError(
          "Article quota exceeded. Upgrade to generate more articles.",
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          body.message || body.error || "Failed to generate article",
        );
      }

      const jobId = getJobId(body);
      if (!jobId)
        throw new Error("Article job response did not include a job id");

      localStorage.removeItem(draftStorageKey(selectedBrandId));
      router.push(`/dashboard/articles/${jobId}/status`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to generate article",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (brands.length === 0 || !selectedBrandId) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border p-6">
        <h1 className="text-2xl font-semibold tracking-normal">
          Generate article
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a brand before starting an article generation wizard.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">
            Generate article
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure one article job and send it to the background pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Step {step} of 4
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        {["Brand", "Topic", "Structure", "Confirm"].map((label, index) => {
          const itemStep = index + 1;
          return (
            <div
              key={label}
              className={
                itemStep === step
                  ? "rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm font-medium text-primary"
                  : "rounded-md border px-3 py-2 text-sm text-muted-foreground"
              }
            >
              {itemStep}. {label}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          {step === 1 && (
            <>
              <CardTitle>Choose brand</CardTitle>
              <CardDescription>
                The active dashboard brand is preselected. You can override it
                for this article.
              </CardDescription>
            </>
          )}
          {step === 2 && (
            <>
              <CardTitle>Choose topic</CardTitle>
              <CardDescription>
                Use a current trend signal or enter a custom topic.
              </CardDescription>
            </>
          )}
          {step === 3 && (
            <>
              <CardTitle>Structure article</CardTitle>
              <CardDescription>
                Set length, outline style, and automatic translations.
              </CardDescription>
            </>
          )}
          {step === 4 && (
            <>
              <CardTitle>Confirm generation</CardTitle>
              <CardDescription>
                Review the job settings before reserving article quota.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="max-w-md space-y-2">
              <BrandSwitcher
                brands={brands}
                activeBrandId={selectedBrandId}
                onSwitch={setSelectedBrandId}
                className="static z-auto border-0 bg-transparent p-0"
              />
              {selectedBrand && (
                <p className="text-sm text-muted-foreground">
                  Selected brand: {selectedBrand.name}
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold tracking-normal">
                    Trend signals
                  </h2>
                </div>
                {isLoadingSignals ? (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    Loading trend signals...
                  </div>
                ) : signals.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No unused trend signals for this brand yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {signals.map((signal) => {
                      const isSelected = draft.selectedSignalId === signal.id;
                      return (
                        <button
                          key={signal.id}
                          type="button"
                          onClick={() => selectSignal(signal)}
                          className={
                            isSelected
                              ? "w-full rounded-md border border-primary bg-primary/5 p-3 text-left"
                              : "w-full rounded-md border p-3 text-left hover:bg-muted/50"
                          }
                        >
                          <span className="block text-sm font-medium text-foreground">
                            {signal.topic}
                          </span>
                          <span className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {SOURCE_LABELS[signal.source]}
                            </Badge>
                            <Badge variant="outline">
                              {confidencePercent(signal.confidence)}%
                            </Badge>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-topic">Custom topic</Label>
                  <Input
                    id="custom-topic"
                    value={draft.topic}
                    onChange={(event) =>
                      updateDraft({
                        topic: event.target.value,
                        selectedSignalId: null,
                      })
                    }
                    placeholder="Enter article topic"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_TEMPLATES.map((template) => (
                    <Button
                      key={template.value}
                      type="button"
                      variant={
                        draft.topicTemplate === template.value
                          ? "default"
                          : "outline"
                      }
                      aria-pressed={draft.topicTemplate === template.value}
                      onClick={() => selectTopicTemplate(template.value)}
                    >
                      {template.label}
                    </Button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="article-length">Article length</Label>
                  <span className="text-sm font-medium">
                    {draft.wordCount} words
                  </span>
                </div>
                <Input
                  id="article-length"
                  type="range"
                  min="500"
                  max="3000"
                  step="100"
                  value={draft.wordCount}
                  onChange={(event) =>
                    updateDraft({ wordCount: event.target.value })
                  }
                />
              </div>

              <div className="space-y-3">
                <Label>Structure template</Label>
                <RadioGroup
                  value={draft.structureTemplate}
                  onValueChange={(value) =>
                    updateDraft({
                      structureTemplate: value as StructureTemplate,
                    })
                  }
                  className="grid gap-3 md:grid-cols-4"
                >
                  {STRUCTURE_TEMPLATES.map((template) => (
                    <Label
                      key={template.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                    >
                      <RadioGroupItem value={template.value} />
                      {template.label}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Auto-translate to</Label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {TRANSLATION_LOCALES.map((locale) => (
                    <Label
                      key={locale.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-3"
                    >
                      <Checkbox
                        checked={draft.translateLocales.includes(locale.value)}
                        onCheckedChange={(checked) =>
                          toggleLocale(locale.value, checked === true)
                        }
                      />
                      {locale.label}
                    </Label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <dl className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Brand</dt>
                  <dd className="font-medium">{selectedBrand?.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Topic</dt>
                  <dd className="font-medium">{draft.topic}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Length</dt>
                  <dd className="font-medium">{draft.wordCount} words</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Structure</dt>
                  <dd className="font-medium">
                    {
                      STRUCTURE_TEMPLATES.find(
                        (template) =>
                          template.value === draft.structureTemplate,
                      )?.label
                    }
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm text-muted-foreground">
                    Translations
                  </dt>
                  <dd className="font-medium">
                    {draft.translateLocales.length === 0
                      ? "None"
                      : TRANSLATION_LOCALES.filter((locale) =>
                          draft.translateLocales.includes(locale.value),
                        )
                          .map((locale) => locale.label)
                          .join(", ")}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {stepError && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {stepError}
            </p>
          )}

          {submitError && (
            <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive md:flex-row md:items-center md:justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {submitError}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/settings">Upgrade plan</Link>
              </Button>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1 || isSubmitting}
              onClick={() => setStep((current) => Math.max(1, current - 1))}
            >
              Back
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={continueToNextStep}>
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Generate article
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

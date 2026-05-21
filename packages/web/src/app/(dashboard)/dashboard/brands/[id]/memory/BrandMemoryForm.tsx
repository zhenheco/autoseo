"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@shared/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs";
import { Textarea } from "@shared/ui/textarea";
import { brandMemoryFieldsSchema } from "@/lib/brands/memory-schema";
import type { Json } from "@/types/database.types";

type VoiceTonePreset = "formal" | "casual" | "witty" | "professional";
type VoiceToneChoice = VoiceTonePreset | "custom";

const voiceTonePresets: Array<{ value: VoiceTonePreset; label: string }> = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "witty", label: "Witty" },
  { value: "professional", label: "Professional" },
];

export interface BrandMemoryFormBrand {
  id: string;
  name: string;
  voice_tone: string | null;
  target_audience: Json | null;
  value_props: string[] | null;
  brand_guidelines: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

interface BrandMemoryFormProps {
  brand: BrandMemoryFormBrand;
}

interface StructuredTargetAudience {
  demographic: {
    ageRange: string;
    location: string;
    interests: string[];
  };
  psychographic: string;
}

export function BrandMemoryForm({ brand }: BrandMemoryFormProps) {
  const router = useRouter();
  const initialAudience = useMemo(
    () => readTargetAudience(brand.target_audience),
    [brand.target_audience],
  );
  const initialVoiceTone = readVoiceTone(brand.voice_tone);
  const [name, setName] = useState(brand.name);
  const [voiceToneChoice, setVoiceToneChoice] = useState<VoiceToneChoice>(
    initialVoiceTone.choice,
  );
  const [customVoiceTone, setCustomVoiceTone] = useState(
    initialVoiceTone.custom,
  );
  const [ageRange, setAgeRange] = useState(
    initialAudience.demographic.ageRange,
  );
  const [location, setLocation] = useState(
    initialAudience.demographic.location,
  );
  const [interests, setInterests] = useState(
    initialAudience.demographic.interests,
  );
  const [interestInput, setInterestInput] = useState("");
  const [psychographic, setPsychographic] = useState(
    initialAudience.psychographic,
  );
  const [valueProps, setValueProps] = useState(brand.value_props ?? []);
  const [valuePropInput, setValuePropInput] = useState("");
  const [brandGuidelines, setBrandGuidelines] = useState(
    brand.brand_guidelines ?? "",
  );
  const [logoUrl, setLogoUrl] = useState(brand.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(brand.primary_color ?? "");
  const [secondaryColor, setSecondaryColor] = useState(
    brand.secondary_color ?? "",
  );
  const [bgCanvasHex, setBgCanvasHex] = useState("#fbfaf7");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const rawValue = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-canvas")
      .trim();
    const parsed = parseHslCssValue(rawValue);
    if (parsed) setBgCanvasHex(rgbToHex(parsed));
  }, []);

  const primaryContrast = getContrastLabel(primaryColor, bgCanvasHex);
  const secondaryContrast = getContrastLabel(secondaryColor, bgCanvasHex);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      name: name.trim(),
      voiceTone:
        voiceToneChoice === "custom"
          ? textOrNull(customVoiceTone)
          : voiceToneChoice,
      targetAudience: {
        demographic: {
          ageRange: textOrNull(ageRange),
          location: textOrNull(location),
          interests,
        },
        psychographic: textOrNull(psychographic),
      },
      valueProps: valueProps.length > 0 ? valueProps : null,
      brandGuidelines: textOrNull(brandGuidelines),
      logoUrl: textOrNull(logoUrl),
      primaryColor: textOrNull(primaryColor),
      secondaryColor: textOrNull(secondaryColor),
    };

    const parsed = brandMemoryFieldsSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid brand memory");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || body?.success === false) {
        throw new Error(body?.error ?? "Failed to save brand memory");
      }

      toast.success("Brand memory saved");
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Failed to save brand memory";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit memory</CardTitle>
        <CardDescription>
          Voice, audience, guidelines, and visual identity used by generation
          workflows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          aria-label="Brand memory"
          className="space-y-8"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <Label htmlFor="brand-memory-name">Name</Label>
            <Input
              id="brand-memory-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">
                Voice tone
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a preset tone or write a custom prompt.
              </p>
            </div>
            <RadioGroup
              value={voiceToneChoice}
              onValueChange={(value) =>
                setVoiceToneChoice(value as VoiceToneChoice)
              }
              className="grid gap-3 sm:grid-cols-2"
            >
              {voiceTonePresets.map((tone) => (
                <div
                  key={tone.value}
                  className="flex items-center gap-2 rounded-md border border-border p-3"
                >
                  <RadioGroupItem
                    id={`voice-tone-${tone.value}`}
                    value={tone.value}
                  />
                  <Label
                    htmlFor={`voice-tone-${tone.value}`}
                    className="cursor-pointer"
                  >
                    {tone.label}
                  </Label>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-md border border-border p-3">
                <RadioGroupItem id="voice-tone-custom" value="custom" />
                <Label htmlFor="voice-tone-custom" className="cursor-pointer">
                  Custom
                </Label>
              </div>
            </RadioGroup>
            <div className="space-y-2">
              <Label htmlFor="voice-tone-custom-prompt">
                Custom voice prompt
              </Label>
              <Textarea
                id="voice-tone-custom-prompt"
                value={customVoiceTone}
                onChange={(event) => setCustomVoiceTone(event.target.value)}
                placeholder="Sharp, optimistic, and concrete."
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">
                Target audience
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Stored as structured JSONB for reusable audience context.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="audience-age-range">Age range</Label>
                <Input
                  id="audience-age-range"
                  value={ageRange}
                  onChange={(event) => setAgeRange(event.target.value)}
                  placeholder="30-45"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience-location">Location</Label>
                <Input
                  id="audience-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Taiwan, United States"
                />
              </div>
            </div>
            <ChipEditor
              id="audience-interests"
              label="Interests"
              inputValue={interestInput}
              items={interests}
              placeholder="SEO automation"
              onInputChange={setInterestInput}
              onAdd={() =>
                addUniqueChip(interestInput, interests, setInterests, () =>
                  setInterestInput(""),
                )
              }
              onRemove={(item) =>
                setInterests((current) =>
                  current.filter((value) => value !== item),
                )
              }
            />
            <div className="space-y-2">
              <Label htmlFor="audience-psychographic">
                Psychographic notes
              </Label>
              <Textarea
                id="audience-psychographic"
                value={psychographic}
                onChange={(event) => setPsychographic(event.target.value)}
                placeholder="Prefers direct proof, quick setup, and clear ROI."
              />
            </div>
          </section>

          <ChipEditor
            id="brand-value-props"
            label="Value props"
            inputValue={valuePropInput}
            items={valueProps}
            placeholder="Fast setup"
            onInputChange={setValuePropInput}
            onAdd={() =>
              addUniqueChip(valuePropInput, valueProps, setValueProps, () =>
                setValuePropInput(""),
              )
            }
            onRemove={(item) =>
              setValueProps((current) =>
                current.filter((value) => value !== item),
              )
            }
          />

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">
                Brand guidelines
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Markdown supported. Keep the first 500 characters focused on the
                rules generation should never miss.
              </p>
            </div>
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <Label htmlFor="brand-guidelines" className="sr-only">
                  Brand guidelines
                </Label>
                <Textarea
                  id="brand-guidelines"
                  className="min-h-48 font-mono"
                  value={brandGuidelines}
                  onChange={(event) => setBrandGuidelines(event.target.value)}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {Math.min(brandGuidelines.length, 500)}/500 priority
                  characters
                </p>
              </TabsContent>
              <TabsContent value="preview">
                <MarkdownPreview markdown={brandGuidelines} />
              </TabsContent>
            </Tabs>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold tracking-normal">
                Visual identity
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Logo and brand colors used in generated assets.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
              <div className="space-y-2">
                <Label htmlFor="brand-logo-url">Logo URL</Label>
                <Input
                  id="brand-logo-url"
                  type="url"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${name || "Brand"} logo preview`}
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">No logo</span>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ColorField
                id="primary-color"
                label="Primary color"
                value={primaryColor}
                fallback="#2563eb"
                contrast={primaryContrast}
                onChange={setPrimaryColor}
              />
              <ColorField
                id="secondary-color"
                label="Secondary color"
                value={secondaryColor}
                fallback="#14b8a6"
                contrast={secondaryContrast}
                onChange={setSecondaryColor}
              />
            </div>
          </section>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save memory"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface ChipEditorProps {
  id: string;
  label: string;
  inputValue: string;
  items: string[];
  placeholder: string;
  onInputChange(value: string): void;
  onAdd(): void;
  onRemove(item: string): void;
}

function ChipEditor({
  id,
  label,
  inputValue,
  items,
  placeholder,
  onInputChange,
  onAdd,
  onRemove,
}: ChipEditorProps) {
  return (
    <section className="space-y-3">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={inputValue}
          placeholder={placeholder}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="flex min-h-8 flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-sm text-muted-foreground">No items</span>
        ) : (
          items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1">
              {item}
              <button
                type="button"
                className="rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${item}`}
                onClick={() => onRemove(item)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </section>
  );
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  fallback: string;
  contrast: string;
  onChange(value: string): void;
}

function ColorField({
  id,
  label,
  value,
  fallback,
  contrast,
  onChange,
}: ColorFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-2">
        <input
          aria-label={`${label} picker`}
          className="h-9 w-12 rounded-md border border-input bg-transparent"
          type="color"
          value={isHexColor(value) ? value : fallback}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={fallback}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Contrast against bg-canvas: {contrast}
      </p>
    </div>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split(/\r?\n/);
  if (markdown.trim().length === 0) {
    return (
      <div className="min-h-48 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Nothing to preview
      </div>
    );
  }

  return (
    <div className="min-h-48 space-y-2 rounded-md border border-border p-4">
      {lines.map((line, index) => {
        const key = `${index}-${line}`;
        if (line.startsWith("### ")) {
          return (
            <h4 key={key} className="text-base font-semibold">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h3 key={key} className="text-lg font-semibold">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h2 key={key} className="text-xl font-semibold">
              {line.slice(2)}
            </h2>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <p key={key} className="pl-4 text-sm">
              {line}
            </p>
          );
        }
        return (
          <p key={key} className="text-sm text-pretty">
            {line || "\u00a0"}
          </p>
        );
      })}
    </div>
  );
}

function readVoiceTone(voiceTone: string | null): {
  choice: VoiceToneChoice;
  custom: string;
} {
  if (
    voiceTone === "formal" ||
    voiceTone === "casual" ||
    voiceTone === "witty" ||
    voiceTone === "professional"
  ) {
    return { choice: voiceTone, custom: "" };
  }

  return { choice: "custom", custom: voiceTone ?? "" };
}

function readTargetAudience(value: Json | null): StructuredTargetAudience {
  const fallback: StructuredTargetAudience = {
    demographic: {
      ageRange: "",
      location: "",
      interests: [],
    },
    psychographic: "",
  };

  if (!isRecord(value)) return fallback;

  const demographic = isRecord(value.demographic) ? value.demographic : {};
  return {
    demographic: {
      ageRange: readString(demographic.ageRange),
      location: readString(demographic.location),
      interests: Array.isArray(demographic.interests)
        ? demographic.interests.filter((item): item is string =>
            Boolean(typeof item === "string" && item.trim()),
          )
        : [],
    },
    psychographic:
      readString(value.psychographic) || readString(value.description),
  };
}

function addUniqueChip(
  input: string,
  current: string[],
  setItems: (updater: (items: string[]) => string[]) => void,
  reset: () => void,
) {
  const value = input.trim();
  if (!value || current.includes(value)) return;
  setItems((items) => [...items, value]);
  reset();
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function getContrastLabel(color: string, background: string): string {
  if (!isHexColor(color)) return "not set";
  const contrast = contrastRatio(hexToRgb(color), hexToRgb(background));
  return `${contrast.toFixed(2)}:1`;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function contrastRatio(
  foreground: [number, number, number],
  background: [number, number, number],
): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance([red, green, blue]: [number, number, number]) {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseHslCssValue(value: string): [number, number, number] | null {
  const [hue, saturation, lightness] = value
    .split(/\s+/)
    .map((part) => Number.parseFloat(part));
  if ([hue, saturation, lightness].some((part) => Number.isNaN(part))) {
    return null;
  }
  return hslToRgb(hue, saturation / 100, lightness / 100);
}

function hslToRgb(
  hue: number,
  saturation: number,
  lightness: number,
): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = lightness - chroma / 2;
  let rgb: [number, number, number] = [0, 0, 0];

  if (segment >= 0 && segment < 1) rgb = [chroma, second, 0];
  else if (segment >= 1 && segment < 2) rgb = [second, chroma, 0];
  else if (segment >= 2 && segment < 3) rgb = [0, chroma, second];
  else if (segment >= 3 && segment < 4) rgb = [0, second, chroma];
  else if (segment >= 4 && segment < 5) rgb = [second, 0, chroma];
  else if (segment >= 5 && segment < 6) rgb = [chroma, 0, second];

  return rgb.map((channel) => Math.round((channel + match) * 255)) as [
    number,
    number,
    number,
  ];
}

function rgbToHex([red, green, blue]: [number, number, number]): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

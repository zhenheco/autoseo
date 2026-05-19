export interface AiSeoGeneratorInput {
  entityType: "product" | "collection" | "image";
  entity: {
    title?: string;
    handle?: string;
    type?: string;
    vendor?: string;
    tags?: string;
    description?: string;
    position?: number;
  };
  shop?: { name?: string };
  fields: Array<"seoTitle" | "seoDescription" | "alt">;
}

export interface AiSeoGeneratorOutput {
  drafts: { seoTitle?: string; seoDescription?: string; alt?: string };
  model: string;
  generatedAt: string;
}

export interface AiSeoGeneratorDeps {
  callModel: (
    prompt: string,
    opts?: { taskType?: "simple" | "complex" },
  ) => Promise<{ text: string; model: string }>;
}

type AiSeoDrafts = AiSeoGeneratorOutput["drafts"];
type AiSeoField = AiSeoGeneratorInput["fields"][number];

const FIELD_LIMITS: Record<AiSeoField, number> = {
  seoTitle: 70,
  seoDescription: 160,
  alt: 125,
};

export async function generateShoplineSeoDraft(
  input: AiSeoGeneratorInput,
  deps: AiSeoGeneratorDeps,
): Promise<AiSeoGeneratorOutput> {
  const prompt = buildPrompt(input);
  let response = await deps.callModel(prompt, { taskType: "simple" });
  let parsed = parseDraftJson(response.text);

  if (!parsed) {
    response = await deps.callModel(buildPrompt(input, true), {
      taskType: "simple",
    });
    parsed = parseDraftJson(response.text);
  }

  if (!parsed) {
    throw new Error("shopline_ai_seo_invalid_json");
  }

  return {
    drafts: pickAndLimitDrafts(parsed, input.fields),
    model: response.model,
    generatedAt: new Date().toISOString(),
  };
}

function buildPrompt(input: AiSeoGeneratorInput, strictJson = false): string {
  const shopName = input.shop?.name?.trim();
  const useChinese = shopName ? containsChinese(shopName) : false;
  const languageInstruction = useChinese
    ? "請以繁體中文撰寫，語氣自然、適合台灣電商品牌。"
    : "Write in natural, customer-friendly English unless the entity context strongly suggests another language.";
  const fields = input.fields.join(", ");
  const jsonShape = buildJsonShape(input.fields);

  return [
    "You are generating manual-review SEO drafts for a SHOPLINE store.",
    "Do not include customer data, order data, private identifiers, or unsupported claims.",
    languageInstruction,
    strictJson
      ? "Return only strict JSON. No markdown fences, comments, prose, or trailing commas."
      : "Return valid JSON only.",
    `Requested fields: ${fields}`,
    `JSON shape: ${jsonShape}`,
    "",
    "Entity context:",
    `- Entity type: ${input.entityType}`,
    `- Shop name: ${shopName || "(not provided)"}`,
    `- Title: ${input.entity.title || "(not provided)"}`,
    `- Handle: ${input.entity.handle || "(not provided)"}`,
    `- Type: ${input.entity.type || "(not provided)"}`,
    `- Vendor: ${input.entity.vendor || "(not provided)"}`,
    `- Tags: ${input.entity.tags || "(not provided)"}`,
    `- Description: ${input.entity.description || "(not provided)"}`,
    `- Image position: ${input.entity.position ?? "(not provided)"}`,
    "",
    "Length limits:",
    "- seoTitle <= 70 characters",
    "- seoDescription <= 160 characters",
    "- alt <= 125 characters",
  ].join("\n");
}

function buildJsonShape(fields: AiSeoField[]): string {
  const entries = fields.map((field) => `"${field}": "..."`);
  return `{ ${entries.join(", ")} }`;
}

function containsChinese(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function parseDraftJson(text: string): AiSeoDrafts | null {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
    trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed !== "object" || parsed === null) continue;

      const record = parsed as Record<string, unknown>;
      return {
        seoTitle:
          typeof record.seoTitle === "string" ? record.seoTitle : undefined,
        seoDescription:
          typeof record.seoDescription === "string"
            ? record.seoDescription
            : undefined,
        alt: typeof record.alt === "string" ? record.alt : undefined,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function pickAndLimitDrafts(
  drafts: AiSeoDrafts,
  fields: AiSeoField[],
): AiSeoDrafts {
  const output: AiSeoDrafts = {};

  for (const field of fields) {
    const value = drafts[field];
    if (typeof value !== "string") continue;
    output[field] = truncate(value.trim(), FIELD_LIMITS[field]);
  }

  return output;
}

function truncate(value: string, maxLength: number): string {
  return Array.from(value).slice(0, maxLength).join("");
}

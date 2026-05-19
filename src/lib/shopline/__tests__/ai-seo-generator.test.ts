import { describe, expect, it, vi } from "vitest";
import { generateShoplineSeoDraft } from "../ai-seo-generator";
import type {
  AiSeoGeneratorDeps,
  AiSeoGeneratorInput,
} from "../ai-seo-generator";

function productInput(
  overrides: Partial<AiSeoGeneratorInput> = {},
): AiSeoGeneratorInput {
  return {
    entityType: "product",
    entity: {
      title: "Trail Running Jacket",
      handle: "trail-running-jacket",
      type: "Outerwear",
      vendor: "Summit Co",
      tags: "running, waterproof",
      description: "Lightweight waterproof jacket for mountain trails.",
    },
    shop: { name: "Summit Store" },
    fields: ["seoTitle", "seoDescription"],
    ...overrides,
  };
}

describe("generateShoplineSeoDraft", () => {
  it("generates product SEO title and description drafts", async () => {
    const deps: AiSeoGeneratorDeps = {
      callModel: vi.fn(async () => ({
        text: JSON.stringify({
          seoTitle: "Trail Running Jacket | Summit Store",
          seoDescription:
            "Shop a lightweight waterproof trail running jacket from Summit Co.",
          alt: "Ignored image alt",
        }),
        model: "deepseek-chat",
      })),
    };

    const result = await generateShoplineSeoDraft(productInput(), deps);

    expect(result.drafts).toEqual({
      seoTitle: "Trail Running Jacket | Summit Store",
      seoDescription:
        "Shop a lightweight waterproof trail running jacket from Summit Co.",
    });
    expect(result.model).toBe("deepseek-chat");
    expect(Date.parse(result.generatedAt)).not.toBeNaN();
    expect(deps.callModel).toHaveBeenCalledWith(
      expect.stringContaining("Trail Running Jacket"),
      { taskType: "simple" },
    );
  });

  it("generates only alt for image input", async () => {
    const deps: AiSeoGeneratorDeps = {
      callModel: vi.fn(async () => ({
        text: JSON.stringify({
          seoTitle: "Ignored title",
          seoDescription: "Ignored description",
          alt: "Trail running jacket on a rocky mountain path",
        }),
        model: "openai/gpt-5-mini",
      })),
    };

    const result = await generateShoplineSeoDraft(
      productInput({
        entityType: "image",
        entity: {
          title: "Trail Running Jacket",
          position: 2,
        },
        fields: ["alt"],
      }),
      deps,
    );

    expect(result.drafts).toEqual({
      alt: "Trail running jacket on a rocky mountain path",
    });
  });

  it("generates collection SEO title and description drafts", async () => {
    const deps: AiSeoGeneratorDeps = {
      callModel: vi.fn(async () => ({
        text: JSON.stringify({
          seoTitle: "Trail Running Gear",
          seoDescription:
            "Explore waterproof jackets, hydration packs, and trail essentials.",
        }),
        model: "deepseek-chat",
      })),
    };

    const result = await generateShoplineSeoDraft(
      productInput({
        entityType: "collection",
        entity: {
          title: "Trail Running Gear",
          handle: "trail-running-gear",
          description: "Gear for technical mountain runs.",
        },
      }),
      deps,
    );

    expect(result.drafts).toEqual({
      seoTitle: "Trail Running Gear",
      seoDescription:
        "Explore waterproof jackets, hydration packs, and trail essentials.",
    });
  });

  it("retries once with a stricter prompt when model output is not JSON", async () => {
    const deps: AiSeoGeneratorDeps = {
      callModel: vi
        .fn()
        .mockResolvedValueOnce({
          text: "Here are some draft ideas, not JSON.",
          model: "deepseek-chat",
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            seoTitle: "Trail Running Jacket",
            seoDescription: "Waterproof trail jacket for mountain runners.",
          }),
          model: "openai/gpt-5-mini",
        }),
    };

    const result = await generateShoplineSeoDraft(productInput(), deps);

    expect(result.drafts.seoTitle).toBe("Trail Running Jacket");
    expect(deps.callModel).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deps.callModel).mock.calls[1][0]).toContain(
      "Return only strict JSON",
    );
  });

  it("truncates generated fields to SEO limits", async () => {
    const deps: AiSeoGeneratorDeps = {
      callModel: vi.fn(async () => ({
        text: JSON.stringify({
          seoTitle: "T".repeat(90),
          seoDescription: "D".repeat(200),
          alt: "A".repeat(150),
        }),
        model: "deepseek-chat",
      })),
    };

    const result = await generateShoplineSeoDraft(
      productInput({ fields: ["seoTitle", "seoDescription", "alt"] }),
      deps,
    );

    expect(result.drafts.seoTitle).toHaveLength(70);
    expect(result.drafts.seoDescription).toHaveLength(160);
    expect(result.drafts.alt).toHaveLength(125);
  });

  it("includes entity context in the prompt", async () => {
    const deps: AiSeoGeneratorDeps = {
      callModel: vi.fn(async () => ({
        text: JSON.stringify({
          seoTitle: "Trail Running Jacket",
          seoDescription: "Waterproof trail running jacket.",
        }),
        model: "deepseek-chat",
      })),
    };

    await generateShoplineSeoDraft(productInput(), deps);

    const prompt = vi.mocked(deps.callModel).mock.calls[0][0];
    expect(prompt).toContain("Trail Running Jacket");
    expect(prompt).toContain("Outerwear");
    expect(prompt).toContain("Summit Co");
    expect(prompt).toContain("running, waterproof");
    expect(prompt).toContain("Summit Store");
  });

  it("uses a Chinese-friendly prompt when the shop name contains Chinese", async () => {
    const deps: AiSeoGeneratorDeps = {
      callModel: vi.fn(async () => ({
        text: JSON.stringify({
          seoTitle: "山徑跑步外套",
          seoDescription: "防水輕量外套，適合山徑跑者。",
        }),
        model: "deepseek-chat",
      })),
    };

    await generateShoplineSeoDraft(
      productInput({ shop: { name: "山系選物店" } }),
      deps,
    );

    expect(vi.mocked(deps.callModel).mock.calls[0][0]).toContain(
      "請以繁體中文",
    );
  });
});

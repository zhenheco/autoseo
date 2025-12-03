import { BaseAgent } from "./base-agent";
import type {
  FeaturedImageInput,
  FeaturedImageOutput,
  GeneratedImage,
} from "@/types/agents";
import {
  SupabaseStorageClient,
  getSupabaseStorageConfig,
} from "@/lib/storage/supabase-storage-client";
import {
  processBase64Image,
  formatFileSize,
  calculateCompressionRatio,
} from "@/lib/image-processor";

const DEFAULT_MODEL = "gemini-2.5-flash-image";

const IMAGE_PRICING: Record<string, Record<string, number>> = {
  "gemini-2.5-flash-image": { "1024x1024": 0.01, "1792x1024": 0.02 },
  "gemini-imagen-flash": { "1024x1024": 0.01 },
  "gpt-image-1-mini": { "1024x1024": 0.015 },
};

export class FeaturedImageAgent extends BaseAgent<
  FeaturedImageInput,
  FeaturedImageOutput
> {
  get agentName(): string {
    return "FeaturedImageAgent";
  }

  protected async process(
    input: FeaturedImageInput,
  ): Promise<FeaturedImageOutput> {
    const model = input.model || DEFAULT_MODEL;
    console.log(
      `[FeaturedImageAgent] 🎨 Generating featured image with model: ${model}`,
    );

    const image = await this.generateFeaturedImage(input, model);

    const cost = this.calculateCost(model, input.size);

    return {
      image,
      executionInfo: {
        model,
        executionTime: this.startTime ? Date.now() - this.startTime : 0,
        cost,
      },
    };
  }

  private async generateFeaturedImage(
    input: FeaturedImageInput,
    model: string,
  ): Promise<GeneratedImage> {
    const prompt = this.buildPrompt(input);

    const result = await this.generateImage(prompt, {
      model,
      quality: input.quality,
      size: input.size,
    });

    let finalUrl = result.url;

    console.log("[FeaturedImageAgent] 📦 Processing and compressing image...");

    const processed = await processBase64Image(result.url, {
      format: "jpeg",
      quality: 85,
      maxWidth: 1920,
      maxHeight: 1920,
    });

    const originalSize = Buffer.from(result.url.split(",")[1], "base64").length;
    const compressionRatio = calculateCompressionRatio(
      originalSize,
      processed.size,
    );

    console.log(
      `[FeaturedImageAgent] ✅ Compressed: ${formatFileSize(originalSize)} → ${formatFileSize(processed.size)} (${compressionRatio}% reduction)`,
    );

    const timestamp = Date.now();
    const filename = `article-hero-${timestamp}.jpg`;
    const base64Data = processed.buffer.toString("base64");

    const supabaseConfig = getSupabaseStorageConfig();
    if (supabaseConfig) {
      try {
        console.log("[FeaturedImageAgent] 🔄 Uploading to Supabase Storage...");
        const supabaseClient = new SupabaseStorageClient(supabaseConfig);
        const uploaded = await supabaseClient.uploadImage(
          base64Data,
          filename,
          "image/jpeg",
        );
        finalUrl = uploaded.url;
        console.log(
          `[FeaturedImageAgent] ☁️ Upload successful: ${uploaded.path}`,
        );
      } catch (error) {
        const err = error as Error;
        console.warn("[FeaturedImageAgent] ⚠️ Upload failed:", err.message);
      }
    }

    const [width, height] = input.size.split("x").map(Number);

    return {
      url: finalUrl,
      prompt,
      altText: `${input.title} - 精選圖片`,
      width,
      height,
      model,
    };
  }

  private buildPrompt(input: FeaturedImageInput): string {
    const targetLang = input.targetLanguage || "zh-TW";

    const styleGuide = input.brandStyle
      ? `
Style: ${input.brandStyle.style || "professional, modern"}
Color scheme: ${input.brandStyle.colorScheme?.join(", ") || "vibrant, eye-catching"}
Mood: ${input.brandStyle.mood || "engaging, informative"}
`
      : `
Style: professional, modern, clean
Color scheme: vibrant, eye-catching
Mood: engaging, informative
`;

    let contextSection = "";
    if (input.articleContext) {
      const parts: string[] = [];
      if (input.articleContext.outline?.length) {
        parts.push(
          `Main Sections: ${input.articleContext.outline.slice(0, 5).join(", ")}`,
        );
      }
      if (input.articleContext.mainTopics?.length) {
        parts.push(
          `Key Topics: ${input.articleContext.mainTopics.slice(0, 5).join(", ")}`,
        );
      }
      if (input.articleContext.keywords?.length) {
        parts.push(
          `Keywords: ${input.articleContext.keywords.slice(0, 5).join(", ")}`,
        );
      }
      if (parts.length > 0) {
        contextSection = `\nArticle Context:\n${parts.join("\n")}\n`;
      }
    }

    return `Create a high-quality featured image for an article.

Target Language Context: ${targetLang}
Article Title: "${input.title}"
${contextSection}
${styleGuide}

CRITICAL - ABSOLUTELY NO TEXT (THIS IS THE MOST IMPORTANT RULE):
- ZERO text, words, letters, numbers, or characters of ANY language
- NO Chinese, English, Japanese, Korean, or any other written language
- NO watermarks, NO labels, NO captions, NO titles within the image
- If ANY text appears in the image, it will be REJECTED immediately
- Use ONLY visual symbols, icons, illustrations, and visual metaphors

Other Requirements:
- Eye-catching and professional
- Relevant to the article topic and its main sections
- This is for a ${targetLang} article - create culturally appropriate visuals
- Suitable for blog header/social media
- High visual impact
- Pure visual design ONLY`;
  }

  private calculateCost(model: string, size: string): number {
    const pricing = IMAGE_PRICING[model];
    if (!pricing) return 0;
    return pricing[size] || pricing["1024x1024"] || 0;
  }
}

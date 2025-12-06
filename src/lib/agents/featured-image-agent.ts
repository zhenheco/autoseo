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

const DEFAULT_MODEL = "gemini-3-pro-image-preview";

const IMAGE_PRICING: Record<string, Record<string, number>> = {
  "gemini-3-pro-image-preview": { "1024x1024": 0.02, "1792x1024": 0.03 },
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

    const altText = this.generateAltText(input.title, input.targetLanguage);

    return {
      url: finalUrl,
      prompt,
      altText,
      width,
      height,
      model,
    };
  }

  private generateAltText(title: string, targetLanguage?: string): string {
    const lang = targetLanguage || "zh-TW";

    const altTextSuffix: Record<string, string> = {
      "zh-TW": "精選圖片",
      "zh-CN": "精选图片",
      en: "Featured Image",
      "en-US": "Featured Image",
      "en-GB": "Featured Image",
      ja: "アイキャッチ画像",
      ko: "대표 이미지",
      vi: "Hình ảnh nổi bật",
      th: "ภาพเด่น",
      id: "Gambar Unggulan",
      ms: "Imej Pilihan",
    };

    const suffix =
      altTextSuffix[lang] || altTextSuffix["en"] || "Featured Image";
    return `${title} - ${suffix}`;
  }

  private getCulturalStyleGuide(targetLang: string): string {
    const culturalGuides: Record<string, string> = {
      "zh-TW": `
Cultural Style Guide (Traditional Chinese / Taiwan):
- Use warm, inviting colors that resonate with East Asian aesthetics
- Consider incorporating subtle elements inspired by Taiwanese culture
- Modern yet approachable visual style
- Balance between traditional elegance and contemporary design`,
      "zh-CN": `
Cultural Style Guide (Simplified Chinese / China):
- Use bold, dynamic colors popular in Chinese digital media
- Consider modern Chinese design aesthetics
- Clean, professional appearance with Asian influences
- Contemporary visual style`,
      ja: `
Cultural Style Guide (Japanese):
- Embrace minimalist aesthetics (less is more)
- Consider subtle Japanese design principles
- Clean lines, balanced composition
- Refined and elegant visual approach`,
      ko: `
Cultural Style Guide (Korean):
- Modern, trendy K-style aesthetics
- Clean and polished visual design
- Consider Korean design sensibilities
- Fresh, contemporary look`,
      en: `
Cultural Style Guide (English / Western):
- Professional Western design aesthetics
- Bold, impactful visuals
- Clean, modern composition
- Universal visual appeal`,
    };

    // Default to English style guide if language not found
    const langPrefix = targetLang.split("-")[0];
    return (
      culturalGuides[targetLang] ||
      culturalGuides[langPrefix] ||
      culturalGuides["en"]
    );
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

    const culturalGuide = this.getCulturalStyleGuide(targetLang);

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

Target Language/Region: ${targetLang}
Article Title: "${input.title}"
${contextSection}
${styleGuide}
${culturalGuide}

CRITICAL - ABSOLUTELY NO TEXT (THIS IS THE MOST IMPORTANT RULE):
- ZERO text, words, letters, numbers, or characters of ANY language
- NO Chinese, English, Japanese, Korean, or any other written language
- NO watermarks, NO labels, NO captions, NO titles within the image
- If ANY text appears in the image, it will be REJECTED immediately
- Use ONLY visual symbols, icons, illustrations, and visual metaphors

Other Requirements:
- Eye-catching and professional
- Relevant to the article topic and its main sections
- Create culturally appropriate visuals for the target audience (${targetLang})
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

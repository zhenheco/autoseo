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
  processImageFromUrl,
  formatFileSize,
  calculateCompressionRatio,
} from "@/lib/image-processor";

const DEFAULT_MODEL = "fal-ai/bytedance/seedream/v4/text-to-image";

/** 語系對應的視覺文化風格指引 */
const LOCALE_VISUAL_STYLES: Record<string, string> = {
  "zh-TW":
    "East Asian modern aesthetic, warm and approachable tones, clean layout with subtle traditional elements",
  "zh-CN":
    "Contemporary Chinese design, bold and vibrant colors, dynamic composition with modern urban feel",
  "ja-JP":
    "Japanese minimalist aesthetic (和風), generous whitespace, soft pastel or muted earth tones, clean lines, zen-inspired simplicity",
  "ko-KR":
    "Korean modern aesthetic (한국 감성), bright and fresh color palette, trendy K-style design, clean with high contrast accents",
  "en-US":
    "Western professional style, bold typography emphasis, high contrast, editorial magazine look",
  "de-DE":
    "German precision aesthetic (Bauhaus-inspired), structured grid layout, industrial clean lines, restrained color palette",
  "es-ES":
    "Warm Mediterranean palette, vibrant and energetic colors, expressive and engaging composition",
  "fr-FR":
    "French elegant aesthetic, sophisticated muted tones, refined composition, editorial chic style",
};

/** 取得語系對應的視覺風格指引 */
function getLocaleVisualStyle(locale: string): string {
  return LOCALE_VISUAL_STYLES[locale] || LOCALE_VISUAL_STYLES["en-US"];
}

const IMAGE_PRICING: Record<string, Record<string, number>> = {
  // fal.ai Seedream v4 定價（支援文字渲染，每張圖約 $0.005）
  "fal-ai/bytedance/seedream/v4/text-to-image": {
    "1024x1024": 0.005,
    "1792x1024": 0.005,
    auto_2K: 0.005,
  },
  // fal.ai qwen-image 定價（每張圖約 $0.003）
  "fal-ai/qwen-image": { "1024x1024": 0.003, "1792x1024": 0.003 },
  "gemini-3-pro-image-preview": { "1024x1024": 0.02, "1792x1024": 0.03 },
  "gemini-2.5-flash-image": { "1024x1024": 0.01, "1792x1024": 0.02 },
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

    try {
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
    } catch (error) {
      const err = error as Error;
      // 如果是內容安全過濾器拒絕，返回 null 圖片而非失敗
      if (
        err.message.includes("[NO_IMAGE]") ||
        err.message.includes("content_policy_violation")
      ) {
        console.warn(
          `[FeaturedImageAgent] ⚠️ 圖片生成被拒（內容安全過濾器），繼續無精選圖片`,
        );
        return {
          image: null,
          executionInfo: {
            model,
            executionTime: this.startTime ? Date.now() - this.startTime : 0,
            cost: 0,
            skippedReason: "content_safety_filter",
          },
        };
      }
      throw error;
    }
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

    // 判斷返回的是 URL 還是 base64
    const isExternalUrl = result.url.startsWith("http");

    let processed;
    let originalSize: number;

    if (isExternalUrl) {
      // fal.ai 等服務返回外部 URL，需要下載後處理
      console.log("[FeaturedImageAgent] 🌐 Downloading from external URL...");
      processed = await processImageFromUrl(result.url, {
        format: "jpeg",
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1920,
      });
      // 外部 URL 無法預知原始大小，使用處理後大小估算
      originalSize = Math.round(processed.size * 1.3);
    } else {
      // base64 格式（Gemini 等）
      processed = await processBase64Image(result.url, {
        format: "jpeg",
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1920,
      });
      originalSize = Buffer.from(result.url.split(",")[1], "base64").length;
    }

    const compressionRatio = calculateCompressionRatio(
      originalSize,
      processed.size,
    );

    console.log(
      `[FeaturedImageAgent] ✅ Processed: ${formatFileSize(processed.size)} (${compressionRatio}% compression)`,
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

    const altText = this.generateAltText(input.title);

    return {
      url: finalUrl,
      prompt,
      altText,
      width,
      height,
      model,
    };
  }

  private generateAltText(title: string): string {
    // 直接使用標題作為 alt text，因為標題已經是目標語言
    return title;
  }

  private buildPrompt(input: FeaturedImageInput): string {
    // 一律使用英文 prompt：fal.ai Seedream v4 的 content policy 會誤判中文 prompt
    return this.buildEnglishPrompt(input);
  }

  /**
   * 英文 Prompt 格式（fal.ai Seedream v4 的 content policy 會誤判中文 prompt，一律使用英文）
   */
  private buildEnglishPrompt(input: FeaturedImageInput): string {
    const targetLang = input.targetLanguage || "en-US";

    // 優先使用 imageStyle，否則使用 brandStyle
    const styleGuide = input.imageStyle
      ? `Visual Style: ${input.imageStyle}`
      : input.brandStyle
        ? `Style: ${input.brandStyle.style || "professional, modern"}
Color scheme: ${input.brandStyle.colorScheme?.join(", ") || "vibrant, eye-catching"}
Mood: ${input.brandStyle.mood || "engaging, informative"}`
        : `Style: professional photography, clean and modern, bright natural lighting
Mood: engaging, informative`;

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
        contextSection = `Article Context:
${parts.join("\n")}`;
      }
    }

    // 如果有指定 imageText，使用英文強調文字
    let textInstruction = "";
    if (input.imageText) {
      textInstruction = `

📝 TEXT OVERLAY (IMPORTANT):
Include the text "${input.imageText}" prominently in the image.
- Typography: bold, modern, highly readable sans-serif font
- Position: center or lower-third, well-integrated with the composition
- Style: clean signage style, professional typography
- The text "${input.imageText}" should be clearly visible and legible`;
    }

    return `Create a high-quality featured image for:
Title: "${input.title}"
Target audience: ${targetLang}
${contextSection ? `\n${contextSection}` : ""}

${styleGuide}
${textInstruction}

Cultural & Visual Style:
- ${getLocaleVisualStyle(targetLang)}
- Use colors and aesthetics that appeal to the target region

Visual Requirements:
- Eye-catching and professional
- Relevant to the article topic
- Suitable for blog header/social media
- High quality, detailed, photorealistic or stylized as appropriate`;
  }

  private calculateCost(model: string, size: string): number {
    const pricing = IMAGE_PRICING[model];
    if (!pricing) return 0;
    return pricing[size] || pricing["1024x1024"] || 0;
  }
}

import { BaseAgent } from "./base-agent";
import type {
  ArticleImageInput,
  ArticleImageOutput,
  GeneratedImage,
  Outline,
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
import {
  IMAGE_ALT_SUFFIXES,
  getTranslation,
} from "@/lib/i18n/article-translations";

const DEFAULT_MODEL = "fal-ai/qwen-image";

const IMAGE_PRICING: Record<string, Record<string, number>> = {
  // fal.ai qwen-image 定價（每張圖約 $0.003）
  "fal-ai/qwen-image": { "1024x1024": 0.003, "1792x1024": 0.003 },
  // 保留舊模型定價供參考
  "gpt-image-1-mini": { "1024x1024": 0.015, "1792x1024": 0.03 },
  "gemini-2.5-flash-image": { "1024x1024": 0.01 },
};

export class ArticleImageAgent extends BaseAgent<
  ArticleImageInput,
  ArticleImageOutput
> {
  get agentName(): string {
    return "ArticleImageAgent";
  }

  protected async process(
    input: ArticleImageInput,
  ): Promise<ArticleImageOutput> {
    const model = input.model || DEFAULT_MODEL;
    const images: GeneratedImage[] = [];
    const failedIndices: number[] = [];

    const maxImages = input.maxImages ?? 3;
    const sectionsNeedingImages = Math.min(
      input.outline.mainSections.length,
      maxImages,
    );
    console.log(
      `[ArticleImageAgent] 🎨 Generating ${sectionsNeedingImages} content images (max: ${maxImages}) with model: ${model}`,
    );

    for (let i = 0; i < sectionsNeedingImages; i++) {
      const section = input.outline.mainSections[i];
      try {
        const image = await this.generateContentImageWithRetry(
          input,
          section,
          i,
          model,
          3,
        );
        images.push(image);
        console.log(
          `[ArticleImageAgent] ✅ Content image ${i + 1}/${sectionsNeedingImages} generated`,
        );
      } catch (error) {
        const err = error as Error;
        console.warn(
          `[ArticleImageAgent] ⚠️ Content image ${i + 1} failed: ${err.message}`,
        );
        failedIndices.push(i + 1);
      }
    }

    if (failedIndices.length > 0) {
      console.warn(
        `[ArticleImageAgent] ⚠️ Failed images (positions): ${failedIndices.join(", ")}`,
      );
    }

    const totalCost = this.calculateTotalCost(images.length, model, input.size);

    return {
      images,
      executionInfo: {
        model,
        totalImages: images.length,
        executionTime: this.startTime ? Date.now() - this.startTime : 0,
        totalCost,
      },
    };
  }

  private async generateContentImageWithRetry(
    input: ArticleImageInput,
    section: Outline["mainSections"][0],
    index: number,
    model: string,
    maxRetries: number,
  ): Promise<GeneratedImage> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[ArticleImageAgent] 🎨 Content image ${index + 1} (attempt ${attempt}/${maxRetries})...`,
        );
        const image = await this.generateContentImage(
          input,
          section,
          index,
          model,
        );
        return image;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[ArticleImageAgent] ⚠️ Attempt ${attempt} failed: ${lastError.message}`,
        );

        // NO_IMAGE 錯誤是內容安全過濾器拒絕，不需要重試
        if (lastError.message.includes("[NO_IMAGE]")) {
          console.warn(`[ArticleImageAgent] ⚠️ 內容安全過濾器拒絕，跳過此圖片`);
          throw lastError;
        }

        if (attempt < maxRetries) {
          const delays = [5000, 10000, 20000];
          const delay = delays[attempt - 1] || 20000;
          console.log(`[ArticleImageAgent] ⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Content image ${index + 1} failed after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async generateContentImage(
    input: ArticleImageInput,
    section: Outline["mainSections"][0],
    index: number,
    model: string,
  ): Promise<GeneratedImage> {
    const prompt = this.buildPrompt(input, section);

    const result = await this.generateImage(prompt, {
      model,
      quality: input.quality,
      size: input.size,
    });

    let finalUrl = result.url;

    console.log(
      `[ArticleImageAgent] 📦 Processing content image ${index + 1}...`,
    );

    // 判斷返回的是 URL 還是 base64
    const isExternalUrl = result.url.startsWith("http");
    let processed;
    let originalSize: number;

    if (isExternalUrl) {
      console.log(
        `[ArticleImageAgent] 🌐 Downloading image ${index + 1} from URL...`,
      );
      processed = await processImageFromUrl(result.url, {
        format: "jpeg",
        quality: 85,
        maxWidth: 1920,
        maxHeight: 1920,
      });
      originalSize = Math.round(processed.size * 1.3);
    } else {
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
      `[ArticleImageAgent] ✅ Processed: ${formatFileSize(processed.size)} (${compressionRatio}% compression)`,
    );

    const timestamp = Date.now();
    const filename = `article-content-${index + 1}-${timestamp}.jpg`;
    const base64Data = processed.buffer.toString("base64");

    const supabaseConfig = getSupabaseStorageConfig();
    if (supabaseConfig) {
      try {
        console.log(
          `[ArticleImageAgent] 🔄 Uploading content image ${index + 1}...`,
        );
        const supabaseClient = new SupabaseStorageClient(supabaseConfig);
        const uploaded = await supabaseClient.uploadImage(
          base64Data,
          filename,
          "image/jpeg",
        );
        finalUrl = uploaded.url;
        console.log(
          `[ArticleImageAgent] ☁️ Upload successful (image ${index + 1}): ${uploaded.path}`,
        );
      } catch (error) {
        const err = error as Error;
        console.warn(
          `[ArticleImageAgent] ⚠️ Upload failed (image ${index + 1}):`,
          err.message,
        );
      }
    }

    const [width, height] = input.size.split("x").map(Number);

    const altSuffix = getTranslation(
      IMAGE_ALT_SUFFIXES,
      input.targetLanguage || "zh-TW",
    );

    return {
      url: finalUrl,
      prompt,
      altText: `${section.heading} - ${altSuffix}`,
      suggestedSection: section.heading,
      width,
      height,
      model,
    };
  }

  private buildPrompt(
    input: ArticleImageInput,
    section: Outline["mainSections"][0],
  ): string {
    const styleGuide = input.brandStyle
      ? `Style: ${input.brandStyle.style || "professional, modern"}
Color scheme: ${input.brandStyle.colorScheme?.join(", ") || "clear, informative"}`
      : `Style: professional, modern, clean
Color scheme: clear, informative`;

    // 把「禁止文字」規則放在最前面，這是最重要的規則
    return `⚠️ CRITICAL RULE - ABSOLUTELY NO TEXT IN THE IMAGE ⚠️
This is the MOST IMPORTANT rule. The image MUST NOT contain:
- ANY text, words, letters, numbers, or characters
- ANY language: Chinese, English, Japanese, Korean, Arabic, etc.
- ANY watermarks, labels, captions, titles, or logos with text
- ANY text-like shapes or symbols that resemble writing
If ANY text appears, the image will be REJECTED immediately.

Create an illustration for section "${section.heading}" in article "${input.title}".

${styleGuide}

Key points to visualize:
${section.keyPoints.join("\n")}

Visual Requirements:
- Clear and informative visual
- Supports the text content
- Professional quality
- Use ONLY illustrations, icons, photos, and visual metaphors
- Pure visual storytelling - NO TEXT

⚠️ FINAL REMINDER: ZERO TEXT ALLOWED - This image must be purely visual ⚠️`;
  }

  private calculateTotalCost(
    imageCount: number,
    model: string,
    size: string,
  ): number {
    const pricing = IMAGE_PRICING[model];
    if (!pricing) return 0;
    const pricePerImage = pricing[size] || pricing["1024x1024"] || 0;
    return imageCount * pricePerImage;
  }
}

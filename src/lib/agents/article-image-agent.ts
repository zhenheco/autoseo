import { BaseAgent } from "./base-agent";
import type {
  ArticleImageInput,
  ArticleImageOutput,
  GeneratedImage,
  Outline,
} from "@/types/agents";
import { uploadImageToStorage } from "@/lib/storage/upload-image";
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

    // 新邏輯：只在文章中間位置生成 1 張配圖
    const totalSections = input.outline.mainSections.length;
    const targetIndices: number[] = [];

    // 選擇中間位置的 H2 放圖（如果有 5 個段落，就選第 3 個）
    if (totalSections >= 1) {
      const middleIndex = Math.floor(totalSections / 2);
      targetIndices.push(middleIndex);
    }

    console.log(
      `[ArticleImageAgent] 🎨 Generating ${targetIndices.length} content images for H2 positions: ${targetIndices.map((i) => i + 1).join(", ")} with model: ${model}`,
    );

    for (const i of targetIndices) {
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
          `[ArticleImageAgent] ✅ Content image for H2 #${i + 1} generated`,
        );
      } catch (error) {
        const err = error as Error;
        console.warn(
          `[ArticleImageAgent] ⚠️ Content image for H2 #${i + 1} failed: ${err.message}`,
        );
        failedIndices.push(i + 1);
      }
    }

    if (failedIndices.length > 0) {
      console.warn(
        `[ArticleImageAgent] ⚠️ Failed images (H2 positions): ${failedIndices.join(", ")}`,
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

        // 內容安全過濾器拒絕，不需要重試（重試也會被拒）
        if (
          lastError.message.includes("[NO_IMAGE]") ||
          lastError.message.includes("content_policy_violation")
        ) {
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
    const prompt = this.buildPrompt(input, section, index);

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

    const uploadResult = await uploadImageToStorage(
      base64Data,
      filename,
      "image/jpeg",
      `[ArticleImageAgent][image ${index + 1}]`,
    );
    if (uploadResult.storage !== "none") {
      finalUrl = uploadResult.url;
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
    sectionIndex: number,
  ): string {
    // 一律使用英文 prompt：fal.ai Seedream v4 的 content policy 會誤判中文 prompt
    return this.buildEnglishPrompt(input, section, sectionIndex);
  }

  /**
   * 英文 Prompt 格式（fal.ai Seedream v4 的 content policy 會誤判中文 prompt，一律使用英文）
   */
  private buildEnglishPrompt(
    input: ArticleImageInput,
    section: Outline["mainSections"][0],
    sectionIndex: number,
  ): string {
    // 優先使用 imageStyle，否則使用 brandStyle
    const styleGuide = input.imageStyle
      ? `Visual Style: ${input.imageStyle}`
      : input.brandStyle
        ? `Style: ${input.brandStyle.style || "professional, modern"}
Color scheme: ${input.brandStyle.colorScheme?.join(", ") || "clear, informative"}`
        : `Style: professional, modern, clean
Color scheme: clear, informative`;

    // 從 sectionImageTexts 取得對應的文字（如果有的話）
    const imageText = input.sectionImageTexts?.[sectionIndex];

    // 如果有指定 imageText，使用英文強調文字
    let textInstruction = "";
    if (imageText) {
      textInstruction = `

📝 TEXT OVERLAY (IMPORTANT):
Include the text "${imageText}" prominently in the image.
- Typography: bold, modern, highly readable sans-serif font
- Position: integrated with the composition, easy to read
- Style: clean signage style, professional typography
- The text "${imageText}" should be clearly visible and legible`;
    }

    return `Create an illustration for section "${section.heading}" in article "${input.title}".

${styleGuide}
${textInstruction}

Key points to visualize:
${section.keyPoints.join("\n")}

Cultural & Visual Style:
- ${getLocaleVisualStyle(input.targetLanguage || "en-US")}

Visual Requirements:
- Clear and informative visual
- Supports the text content
- Professional quality
- High resolution, detailed`;
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

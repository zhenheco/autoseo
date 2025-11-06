import { BaseAgent } from './base-agent';
import type { ImageInput, ImageOutput, GeneratedImage } from '@/types/agents';
import { GoogleDriveClient, getGoogleDriveConfig } from '@/lib/storage/google-drive-client';
import { processBase64Image, formatFileSize, calculateCompressionRatio } from '@/lib/image-processor';

const IMAGE_MODELS = {
  'dall-e-3': {
    provider: 'openai' as const,
    pricing: { '1024x1024': 0.04, '1024x1792': 0.08, '1792x1024': 0.08 },
  },
  'dall-e-2': {
    provider: 'openai' as const,
    pricing: { '256x256': 0.016, '512x512': 0.018, '1024x1024': 0.02 },
  },
  'nano-banana': {
    provider: 'nano' as const,
    pricing: { '1024x1024': 0.01 },
  },
  'chatgpt-image-mini': {
    provider: 'openai' as const,
    pricing: { '1024x1024': 0.015 },
  },
  'gpt-image-1-mini': {
    provider: 'openai' as const,
    pricing: { '1024x1024': 0.015 },
  },
};

export class ImageAgent extends BaseAgent<ImageInput, ImageOutput> {
  get agentName(): string {
    return 'ImageAgent';
  }

  protected async process(input: ImageInput): Promise<ImageOutput> {
    if (input.model === 'none') {
      console.warn('[ImageAgent] Image generation skipped (model is "none")');
      return {
        featuredImage: null as any,
        contentImages: [],
        executionInfo: {
          model: 'none',
          totalImages: 0,
          executionTime: 0,
          totalCost: 0,
        },
      };
    }

    const successfulImages: GeneratedImage[] = [];
    const failedImages: number[] = [];

    let featuredImage: GeneratedImage | null = null;
    try {
      featuredImage = await this.generateFeaturedImageWithRetry(input, 3);
      successfulImages.push(featuredImage);
      console.log('[ImageAgent] ✅ Featured image generated successfully');
    } catch (error) {
      const err = error as Error;
      console.error('[ImageAgent] ❌ Featured image generation failed after retries:', err.message);
      failedImages.push(0);
    }

    const contentImages: GeneratedImage[] = [];
    const sectionsNeedingImages = Math.min(
      input.count - 1,
      input.outline.mainSections.length
    );

    for (let i = 0; i < sectionsNeedingImages; i++) {
      const section = input.outline.mainSections[i];
      try {
        const image = await this.generateContentImageWithRetry(input, section, i, 3);
        contentImages.push(image);
        successfulImages.push(image);
        console.log(`[ImageAgent] ✅ Content image ${i + 1}/${sectionsNeedingImages} generated successfully`);
      } catch (error) {
        const err = error as Error;
        console.warn(`[ImageAgent] ⚠️ Content image ${i + 1} failed after retries: ${err.message}`);
        failedImages.push(i + 1);
      }
    }

    if (failedImages.length > 0) {
      console.warn(`[ImageAgent] ⚠️ Failed images (positions): ${failedImages.join(', ')}`);
    }

    const totalCost = this.calculateTotalCost(
      successfulImages,
      input.model,
      input.size
    );

    if (!featuredImage) {
      throw new Error('Featured image generation failed completely');
    }

    return {
      featuredImage,
      contentImages,
      executionInfo: {
        model: input.model,
        totalImages: successfulImages.length,
        executionTime: this.startTime ? Date.now() - this.startTime : 0,
        totalCost,
      },
    };
  }

  private async generateFeaturedImageWithRetry(input: ImageInput, maxRetries: number): Promise<GeneratedImage> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ImageAgent] 🎨 Generating featured image (attempt ${attempt}/${maxRetries})...`);
        const image = await this.generateFeaturedImage(input);
        return image;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[ImageAgent] ⚠️ Featured image attempt ${attempt} failed: ${lastError.message}`);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[ImageAgent] ⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Featured image generation failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  private async generateContentImageWithRetry(
    input: ImageInput,
    section: ImageInput['outline']['mainSections'][0],
    index: number,
    maxRetries: number
  ): Promise<GeneratedImage> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ImageAgent] 🎨 Generating content image ${index + 1} (attempt ${attempt}/${maxRetries})...`);
        const image = await this.generateContentImage(input, section, index);
        return image;
      } catch (error) {
        lastError = error as Error;
        console.warn(`[ImageAgent] ⚠️ Content image ${index + 1} attempt ${attempt} failed: ${lastError.message}`);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[ImageAgent] ⏳ Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Content image ${index + 1} generation failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async generateFeaturedImage(input: ImageInput): Promise<GeneratedImage> {
    const prompt = this.buildFeaturedImagePrompt(input);

    const result = await this.generateImage(prompt, {
      model: input.model,
      quality: input.quality,
      size: input.size,
    });

    let finalUrl = result.url;
    let storage: 'openai' | 'google-drive' = 'openai';

    const driveConfig = getGoogleDriveConfig();
    if (driveConfig) {
      try {
        console.log('[ImageAgent] 📦 Processing and compressing featured image...');

        const processed = await processBase64Image(result.url, {
          format: 'jpeg',
          quality: 85,
          maxWidth: 1920,
          maxHeight: 1920,
        });

        const originalSize = Buffer.from(result.url.split(',')[1], 'base64').length;
        const compressionRatio = calculateCompressionRatio(originalSize, processed.size);

        console.log(`[ImageAgent] ✅ Compressed: ${formatFileSize(originalSize)} → ${formatFileSize(processed.size)} (${compressionRatio}% reduction)`);

        const driveClient = new GoogleDriveClient(driveConfig);
        const timestamp = Date.now();
        const filename = `article-hero-${timestamp}.jpg`;

        const base64Jpeg = processed.buffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Jpeg}`;

        const uploaded = await driveClient.uploadFromUrl(dataUrl, filename);
        finalUrl = uploaded.url;
        storage = 'google-drive';

        console.log(`[ImageAgent] ☁️ Uploaded featured image to Google Drive: ${uploaded.fileId}`);
      } catch (error) {
        const err = error as Error;
        console.warn('[ImageAgent] Failed to upload to Google Drive, using original URL:', err.message);
      }
    } else {
      console.log('[GoogleDrive] Not configured, using OpenAI URL');
    }

    const [width, height] = input.size.split('x').map(Number);

    return {
      url: finalUrl,
      prompt,
      altText: `${input.title} - 精選圖片`,
      width,
      height,
      model: input.model,
    };
  }

  private async generateContentImage(
    input: ImageInput,
    section: ImageInput['outline']['mainSections'][0],
    index: number
  ): Promise<GeneratedImage> {
    const prompt = this.buildContentImagePrompt(input, section);

    const result = await this.generateImage(prompt, {
      model: input.model,
      quality: input.quality,
      size: input.size,
    });

    let finalUrl = result.url;

    const driveConfig = getGoogleDriveConfig();
    if (driveConfig) {
      try {
        console.log(`[ImageAgent] 📦 Processing and compressing content image ${index + 1}...`);

        const processed = await processBase64Image(result.url, {
          format: 'jpeg',
          quality: 85,
          maxWidth: 1920,
          maxHeight: 1920,
        });

        const originalSize = Buffer.from(result.url.split(',')[1], 'base64').length;
        const compressionRatio = calculateCompressionRatio(originalSize, processed.size);

        console.log(`[ImageAgent] ✅ Compressed: ${formatFileSize(originalSize)} → ${formatFileSize(processed.size)} (${compressionRatio}% reduction)`);

        const driveClient = new GoogleDriveClient(driveConfig);
        const timestamp = Date.now();
        const filename = `article-content-${index + 1}-${timestamp}.jpg`;

        const base64Jpeg = processed.buffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Jpeg}`;

        const uploaded = await driveClient.uploadFromUrl(dataUrl, filename);
        finalUrl = uploaded.url;

        console.log(`[ImageAgent] ☁️ Uploaded content image ${index + 1} to Google Drive: ${uploaded.fileId}`);
      } catch (error) {
        const err = error as Error;
        console.warn('[ImageAgent] Failed to upload to Google Drive, using original URL:', err.message);
      }
    }

    const [width, height] = input.size.split('x').map(Number);

    return {
      url: finalUrl,
      prompt,
      altText: `${section.heading} - 說明圖片`,
      suggestedSection: section.heading,
      width,
      height,
      model: input.model,
    };
  }

  private buildFeaturedImagePrompt(input: ImageInput): string {
    const styleGuide = input.brandStyle
      ? `
Style: ${input.brandStyle.style || 'professional, modern'}
Color scheme: ${input.brandStyle.colorScheme?.join(', ') || 'vibrant, eye-catching'}
Mood: ${input.brandStyle.mood || 'engaging, informative'}
`
      : `
Style: professional, modern, clean
Color scheme: vibrant, eye-catching
Mood: engaging, informative
`;

    return `Create a high-quality featured image for an article titled "${input.title}".

${styleGuide}

Requirements:
- Eye-catching and professional
- Relevant to the article topic
- IMPORTANT: No text, no words, no letters, no Chinese characters - pure visual image only
- Suitable for blog header/social media
- High visual impact
- Use symbols, icons, or illustrations instead of any text`;
  }

  private buildContentImagePrompt(
    input: ImageInput,
    section: ImageInput['outline']['mainSections'][0]
  ): string {
    const styleGuide = input.brandStyle
      ? `
Style: ${input.brandStyle.style || 'professional, modern'}
Color scheme: ${input.brandStyle.colorScheme?.join(', ') || 'clear, informative'}
`
      : `
Style: professional, modern, clean
Color scheme: clear, informative
`;

    return `Create an illustration for the section "${section.heading}" in an article about "${input.title}".

${styleGuide}

Key points to visualize:
${section.keyPoints.join('\n')}

Requirements:
- Clear and informative
- Supports the text content
- Professional quality
- IMPORTANT: No text, no words, no letters, no Chinese characters - pure visual image only
- Use symbols, icons, or illustrations instead of any text`;
  }

  private calculateTotalCost(
    images: GeneratedImage[],
    model: string,
    size: string
  ): number {
    const modelConfig = IMAGE_MODELS[model as keyof typeof IMAGE_MODELS];
    if (!modelConfig) {
      return 0;
    }

    const pricing = modelConfig.pricing;
    const pricePerImage = pricing[size as keyof typeof pricing] || 0;

    return images.length * pricePerImage;
  }
}

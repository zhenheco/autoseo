import { BaseAgent } from './base-agent';
import type { ImageInput, ImageOutput, GeneratedImage } from '@/types/agents';
import { GoogleDriveClient } from '@/lib/storage/google-drive-client';

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
};

export class ImageAgent extends BaseAgent<ImageInput, ImageOutput> {
  get agentName(): string {
    return 'ImageAgent';
  }

  protected async process(input: ImageInput): Promise<ImageOutput> {
    if (input.model === 'none') {
      console.warn('[ImageAgent] Image generation skipped (model is "none")');
      return {
        featuredImage: null as any,  // TypeScript workaround
        contentImages: [],
        executionInfo: {
          model: 'none',
          totalImages: 0,
          executionTime: 0,
          totalCost: 0,
        },
      };
    }

    const featuredImage = await this.generateFeaturedImage(input);

    const contentImages: GeneratedImage[] = [];
    const sectionsNeedingImages = Math.min(
      input.count - 1,
      input.outline.mainSections.length
    );

    for (let i = 0; i < sectionsNeedingImages; i++) {
      const section = input.outline.mainSections[i];
      const image = await this.generateContentImage(input, section);
      contentImages.push(image);
    }

    const totalCost = this.calculateTotalCost(
      [featuredImage, ...contentImages],
      input.model,
      input.size
    );

    return {
      featuredImage,
      contentImages,
      executionInfo: {
        model: input.model,
        totalImages: 1 + contentImages.length,
        executionTime: this.startTime ? Date.now() - this.startTime : 0,
        totalCost,
      },
    };
  }

  private async generateFeaturedImage(input: ImageInput): Promise<GeneratedImage> {
    const prompt = this.buildFeaturedImagePrompt(input);

    const result = await this.generateImage(prompt, {
      model: input.model,
      quality: input.quality,
      size: input.size,
    });

    let finalUrl = result.url;

    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      try {
        const driveClient = new GoogleDriveClient({
          folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
          accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
        });

        const filename = `featured-${Date.now()}.jpg`;
        const uploaded = await driveClient.uploadFromUrl(result.url, filename);
        finalUrl = uploaded.url;

        console.log(`[ImageAgent] Uploaded featured image to Google Drive: ${uploaded.fileId}`);
      } catch (error) {
        console.warn('[ImageAgent] Failed to upload to Google Drive, using original URL:', error);
      }
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
    section: ImageInput['outline']['mainSections'][0]
  ): Promise<GeneratedImage> {
    const prompt = this.buildContentImagePrompt(input, section);

    const result = await this.generateImage(prompt, {
      model: input.model,
      quality: input.quality,
      size: input.size,
    });

    let finalUrl = result.url;

    if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
      try {
        const driveClient = new GoogleDriveClient({
          folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
          accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
        });

        const filename = `content-${Date.now()}.jpg`;
        const uploaded = await driveClient.uploadFromUrl(result.url, filename);
        finalUrl = uploaded.url;

        console.log(`[ImageAgent] Uploaded content image to Google Drive: ${uploaded.fileId}`);
      } catch (error) {
        console.warn('[ImageAgent] Failed to upload to Google Drive, using original URL:', error);
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
- No text overlays
- Suitable for blog header/social media
- High visual impact`;
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
- No text overlays`;
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

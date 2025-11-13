/**
 * Image Processing Utilities
 * 處理圖片格式轉換和壓縮
 */

import sharp from 'sharp';

export interface ImageProcessOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: 'jpeg' | 'webp' | 'png';
}

export interface ProcessedImage {
  buffer: Buffer;
  format: string;
  size: number;
  width: number;
  height: number;
}

/**
 * 將 base64 圖片轉換為 JPEG 並壓縮
 */
export async function processBase64Image(
  base64Data: string,
  options: ImageProcessOptions = {}
): Promise<ProcessedImage> {
  const {
    quality = 85,
    maxWidth = 1920,
    maxHeight = 1920,
    format = 'jpeg',
  } = options;

  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Content, 'base64');

  let sharpInstance = sharp(imageBuffer);

  const metadata = await sharpInstance.metadata();

  if (metadata.width && metadata.height) {
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }

  let processedBuffer: Buffer;

  if (format === 'jpeg') {
    processedBuffer = await sharpInstance
      .jpeg({
        quality,
        mozjpeg: true,
      })
      .toBuffer();
  } else if (format === 'webp') {
    processedBuffer = await sharpInstance
      .webp({
        quality,
      })
      .toBuffer();
  } else {
    processedBuffer = await sharpInstance
      .png({
        compressionLevel: 9,
        quality,
      })
      .toBuffer();
  }

  const processedMetadata = await sharp(processedBuffer).metadata();

  return {
    buffer: processedBuffer,
    format,
    size: processedBuffer.length,
    width: processedMetadata.width || 0,
    height: processedMetadata.height || 0,
  };
}

/**
 * 將處理過的圖片轉換回 base64
 */
export function bufferToBase64(buffer: Buffer, format: string): string {
  const base64 = buffer.toString('base64');
  return `data:image/${format};base64,${base64}`;
}

/**
 * 批次處理多張圖片
 */
export async function processBatchImages(
  images: Array<{ base64: string; filename: string }>,
  options: ImageProcessOptions = {}
): Promise<Array<{ buffer: Buffer; filename: string; metadata: ProcessedImage }>> {
  const results = await Promise.allSettled(
    images.map(async (img) => {
      const processed = await processBase64Image(img.base64, options);
      const newFilename = img.filename.replace(/\.(png|jpg|jpeg|webp)$/i, `.${options.format || 'jpeg'}`);

      return {
        buffer: processed.buffer,
        filename: newFilename,
        metadata: processed,
      };
    })
  );

  return results
    .filter((result): result is PromiseFulfilledResult<{
      buffer: Buffer;
      filename: string;
      metadata: ProcessedImage;
    }> => result.status === 'fulfilled')
    .map(result => result.value);
}

/**
 * 計算壓縮率
 */
export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round((1 - compressedSize / originalSize) * 100);
}

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

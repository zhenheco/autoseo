/**
 * R2 Storage Client (Cloudflare Workers Runtime)
 * 使用 Cloudflare Workers R2 Binding，無需額外依賴
 */

// Cloudflare R2 Bucket type (from @cloudflare/workers-types)
declare global {
  interface R2Bucket {
    put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<void>;
    get(key: string): Promise<R2ObjectBody | null>;
    delete(key: string): Promise<void>;
  }

  interface R2ObjectBody {
    arrayBuffer(): Promise<ArrayBuffer>;
  }
}

export interface UploadImageOptions {
  filename: string;
  buffer: Buffer | ArrayBuffer;
  mimeType?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

export class R2StorageClient {
  constructor(private r2Bucket: R2Bucket, private publicDomain?: string) {}

  /**
   * 上傳圖片到 R2
   */
  async uploadImage(options: UploadImageOptions): Promise<UploadResult> {
    const { filename, buffer, mimeType = 'image/jpeg' } = options;

    // 生成唯一檔名
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const ext = filename.split('.').pop() || 'jpg';
    const key = `images/${new Date().getFullYear()}/${timestamp}-${randomId}.${ext}`;

    // 轉換 Buffer 到 ArrayBuffer（如果需要）
    const arrayBuffer: ArrayBuffer = buffer instanceof Buffer
      ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
      : buffer as ArrayBuffer;

    // 上傳到 R2
    await this.r2Bucket.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    // 生成公開 URL
    const url = this.publicDomain
      ? `https://${this.publicDomain}/${key}`
      : `/r2/${key}`; // Fallback to worker route

    return {
      url,
      key,
      size: arrayBuffer.byteLength,
    };
  }

  /**
   * 從 URL 上傳圖片
   */
  async uploadFromUrl(imageUrl: string, filename: string): Promise<UploadResult> {
    console.log(`[R2] Starting upload from URL: ${filename}`);

    let buffer: ArrayBuffer;
    let mimeType: string;

    if (imageUrl.startsWith('data:')) {
      // Data URL (base64)
      const matches = imageUrl.match(/^data:(.+?);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format');
      }

      mimeType = matches[1];
      const base64Data = matches[2];

      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      buffer = bytes.buffer;

      console.log(`[R2] Converted data URL to buffer (${buffer.byteLength} bytes)`);
    } else {
      // HTTP URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      buffer = await response.arrayBuffer();
      mimeType = response.headers.get('content-type') || 'image/jpeg';

      console.log(`[R2] Downloaded from URL (${buffer.byteLength} bytes)`);
    }

    const result = await this.uploadImage({
      filename,
      buffer,
      mimeType,
    });

    console.log(`[R2] Upload successful: ${filename} -> ${result.url}`);

    return result;
  }

  /**
   * 刪除圖片
   */
  async deleteImage(key: string): Promise<void> {
    await this.r2Bucket.delete(key);
    console.log(`[R2] Deleted: ${key}`);
  }

  /**
   * 取得圖片
   */
  async getImage(key: string): Promise<R2ObjectBody | null> {
    return await this.r2Bucket.get(key);
  }
}

/**
 * 在 Cloudflare Workers context 中建立 R2 client
 * 使用 Workers binding，無需憑證
 */
export function createR2Client(env: { UPLOADS: R2Bucket }, publicDomain?: string): R2StorageClient {
  if (!env.UPLOADS) {
    throw new Error('R2 bucket binding "UPLOADS" not found. Please configure in wrangler.toml');
  }

  return new R2StorageClient(env.UPLOADS, publicDomain);
}

/**
 * 在 Node.js 環境中使用（本地開發）
 * 需要配置 wrangler dev 的 remote bindings
 */
export function getR2PublicDomain(): string | undefined {
  return process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_DOMAIN;
}

import { createClient } from '@supabase/supabase-js';

export interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
  bucketName: string;
}

export interface UploadResult {
  url: string;
  path: string;
}

export class SupabaseStorageClient {
  private supabase;
  private bucketName: string;

  constructor(config: SupabaseStorageConfig) {
    this.bucketName = config.bucketName;
    this.supabase = createClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  async uploadImage(
    base64Data: string,
    filename: string,
    contentType: string = 'image/jpeg'
  ): Promise<UploadResult> {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const path = `articles/${filename}`;

      console.log('[SupabaseStorage] 📤 Uploading to bucket:', this.bucketName, 'path:', path);

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(path, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.error('[SupabaseStorage] ❌ Upload failed:', {
          error: error.message,
          path,
        });
        throw error;
      }

      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(path);

      console.log('[SupabaseStorage] ✅ Upload successful:', publicUrlData.publicUrl);

      return {
        url: publicUrlData.publicUrl,
        path: data.path,
      };
    } catch (error) {
      const err = error as Error;
      console.error('[SupabaseStorage] Upload error:', err.message);
      throw error;
    }
  }
}

export function getSupabaseStorageConfig(): SupabaseStorageConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'article-images';

  if (!url || !serviceRoleKey) {
    console.warn('[SupabaseStorage] Missing configuration');
    return null;
  }

  return {
    url,
    serviceRoleKey,
    bucketName,
  };
}

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

interface UploadResult {
  url: string;
  fileKey: string;
  size: number;
}

export class R2Client {
  private client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(config: R2Config) {
    this.bucketName = config.bucketName;
    this.publicUrl = `https://pub-${config.accountId}.r2.dev`;

    // 建立自訂 HTTPS agent 來處理 SSL/TLS
    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 50,
      rejectUnauthorized: true, // 保持 SSL 驗證
      minVersion: 'TLSv1.2', // 最低 TLS 版本
    });

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // R2 需要使用 path-style URLs
      forcePathStyle: true,
      maxAttempts: 3,
      // 使用自訂 HTTP handler 處理 SSL/TLS
      requestHandler: new NodeHttpHandler({
        httpsAgent,
        connectionTimeout: 30000,
        requestTimeout: 60000,
      }),
    });
  }

  async uploadImage(
    base64Data: string,
    fileName: string,
    contentType: string = 'image/png'
  ): Promise<UploadResult> {
    console.log('[R2 Upload Diagnostics]', {
      filename: fileName,
      contentType,
      base64Length: base64Data.length,
      bucketName: this.bucketName,
    });

    const nonAsciiMatch = fileName.match(/[^\x00-\x7F]/g);
    if (nonAsciiMatch) {
      console.warn('[R2] ⚠️ Non-ASCII characters detected in filename:', nonAsciiMatch);
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const fileKey = `images/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    });

    try {
      await this.client.send(command);
      console.log('[R2] ✅ Upload successful:', fileKey);
    } catch (error) {
      const err = error as Error;
      console.error('[R2] ❌ Upload failed:', {
        error: err.message,
        errorName: err.name,
        stack: err.stack,
        fileKey,
      });

      if (err.message.includes('SSL') || err.message.includes('TLS') || err.message.includes('EPROTO')) {
        console.error('[R2] 🔒 SSL/TLS Error detected - possible causes:');
        console.error('  1. Incorrect R2 credentials');
        console.error('  2. Network/firewall blocking Cloudflare R2');
        console.error('  3. R2 endpoint configuration issue');
        console.error('  Suggestion: Verify R2 credentials in Vercel Dashboard');
      }

      throw error;
    }

    const url = `${this.publicUrl}/${fileKey}`;

    return {
      url,
      fileKey,
      size: buffer.length,
    };
  }

  async getSignedUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  console.log('[R2 Config Check]', {
    R2_ACCOUNT_ID: accountId ? 'SET' : 'MISSING',
    R2_ACCESS_KEY_ID: accessKeyId ? 'SET' : 'MISSING',
    R2_SECRET_ACCESS_KEY: secretAccessKey ? 'SET' : 'MISSING',
    R2_BUCKET_NAME: bucketName ? 'SET' : 'MISSING',
  });

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.warn('[R2] ⚠️ R2 configuration incomplete, R2 upload disabled');
    return null;
  }

  if (secretAccessKey.match(/[^\x00-\x7F]/)) {
    console.warn('[R2] ⚠️ Non-ASCII characters detected in R2_SECRET_ACCESS_KEY');
  }

  return {
    accountId: accountId.trim(),
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
    bucketName: bucketName.trim(),
  };
}

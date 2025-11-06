import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';

export interface GoogleDriveServiceAccountConfig {
  clientEmail: string;
  privateKey: string;
  folderId: string;
}

export interface GoogleDriveOAuthConfig {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  folderId: string;
  redirectUri?: string;
}

export type GoogleDriveConfig = GoogleDriveServiceAccountConfig | GoogleDriveOAuthConfig;

function isServiceAccountConfig(config: GoogleDriveConfig): config is GoogleDriveServiceAccountConfig {
  return 'clientEmail' in config && 'privateKey' in config;
}

export class GoogleDriveClient {
  private drive: drive_v3.Drive;
  private folderId: string;

  constructor(config: GoogleDriveConfig) {
    this.folderId = config.folderId;

    if (isServiceAccountConfig(config)) {
      const auth = new google.auth.JWT({
        email: config.clientEmail,
        key: config.privateKey,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      this.drive = google.drive({ version: 'v3', auth });
    } else {
      const redirectUri = config.redirectUri || 'http://localhost:3168/api/google-drive/auth/callback';

      const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        redirectUri
      );

      oauth2Client.setCredentials({
        refresh_token: config.refreshToken
      });

      this.drive = google.drive({ version: 'v3', auth: oauth2Client });
    }
  }

  async uploadImage(
    imageBuffer: Buffer,
    filename: string,
    mimeType: string = 'image/jpeg'
  ): Promise<{ url: string; fileId: string }> {
    try {
      const fileMetadata = {
        name: filename,
        parents: [this.folderId],
      };

      const { Readable } = await import('stream');
      const media = {
        mimeType,
        body: Readable.from(imageBuffer),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
      });

      const fileId = response.data.id;
      if (!fileId) {
        throw new Error('No file ID returned from Google Drive');
      }

      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

      return {
        url: directUrl,
        fileId: fileId,
      };
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to upload image to Google Drive: ${err.message}`);
    }
  }

  async uploadFromUrl(imageUrl: string, filename: string): Promise<{ url: string; fileId: string }> {
    try {
      console.log(`[GoogleDrive] Starting upload: ${filename}`);

      let buffer: Buffer;
      let mimeType: string;

      if (imageUrl.startsWith('data:')) {
        const matches = imageUrl.match(/^data:(.+?);base64,(.+)$/);
        if (!matches) {
          throw new Error('Invalid data URL format');
        }

        mimeType = matches[1];
        const base64Data = matches[2];
        buffer = Buffer.from(base64Data, 'base64');

        console.log(`[GoogleDrive] Converting data URL to buffer (${buffer.length} bytes)`);
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        mimeType = response.headers.get('content-type') || 'image/jpeg';

        console.log(`[GoogleDrive] Downloaded from URL (${buffer.length} bytes)`);
      }

      const result = await this.uploadImage(buffer, filename, mimeType);

      console.log(`[GoogleDrive] Upload successful: ${filename} -> ${result.url}`);

      return result;
    } catch (error) {
      const err = error as Error;
      console.error(`[GoogleDrive] Upload failed: ${filename} - ${err.message}`);
      throw new Error(`Failed to upload image from URL: ${err.message}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({ fileId });
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to delete file from Google Drive: ${err.message}`);
    }
  }
}

export function getGoogleDriveConfig(): GoogleDriveConfig | null {
  const serviceAccountEmail = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (serviceAccountEmail && serviceAccountKey && folderId) {
    return {
      clientEmail: serviceAccountEmail,
      privateKey: serviceAccountKey.replace(/\\n/g, '\n'),
      folderId,
    };
  }

  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret && folderId) {
    return { refreshToken, clientId, clientSecret, folderId };
  }

  return null;
}

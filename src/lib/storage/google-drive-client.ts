import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';

export interface GoogleDriveOAuthConfig {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  folderId: string;
  redirectUri?: string;
}

export class GoogleDriveClient {
  private drive: drive_v3.Drive;
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private folderId: string;

  constructor(config: GoogleDriveOAuthConfig) {
    this.folderId = config.folderId;

    const redirectUri = config.redirectUri || 'http://localhost:3168/api/google-drive/auth/callback';

    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.refreshToken
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  private async ensureValidToken(): Promise<void> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
    } catch (error) {
      const err = error as Error & { response?: { data?: { error?: string } } };
      if (err.response?.data?.error === 'invalid_grant') {
        throw new Error('Google Drive authorization revoked. Please re-authorize using: npm run google-drive:authorize');
      }
      throw new Error(`Failed to refresh Google Drive token: ${err.message}`);
    }
  }

  async uploadImage(
    imageBuffer: Buffer,
    filename: string,
    mimeType: string = 'image/jpeg'
  ): Promise<{ url: string; fileId: string }> {
    await this.ensureValidToken();

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

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = response.headers.get('content-type') || 'image/jpeg';

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
    await this.ensureValidToken();

    try {
      await this.drive.files.delete({ fileId });
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to delete file from Google Drive: ${err.message}`);
    }
  }
}

export function getGoogleDriveConfig(): GoogleDriveOAuthConfig | null {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!refreshToken || !clientId || !clientSecret || !folderId) {
    return null;
  }

  return { refreshToken, clientId, clientSecret, folderId };
}

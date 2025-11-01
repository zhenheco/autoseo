import { google } from 'googleapis';

export interface GoogleDriveConfig {
  folderId: string;
  serviceAccountEmail?: string;
  serviceAccountKey?: string;
  accessToken?: string;
}

export class GoogleDriveClient {
  private drive: any;
  private folderId: string;

  constructor(config: GoogleDriveConfig) {
    this.folderId = config.folderId;

    if (config.accessToken) {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: config.accessToken });
      this.drive = google.drive({ version: 'v3', auth });
    } else if (config.serviceAccountEmail && config.serviceAccountKey) {
      const auth = new google.auth.JWT({
        email: config.serviceAccountEmail,
        key: config.serviceAccountKey,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      this.drive = google.drive({ version: 'v3', auth });
    } else {
      throw new Error('Google Drive credentials not configured');
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

      const media = {
        mimeType,
        body: require('stream').Readable.from(imageBuffer),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
      });

      await this.drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      const directUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;

      return {
        url: directUrl,
        fileId: response.data.id,
      };
    } catch (error: any) {
      throw new Error(`Failed to upload image to Google Drive: ${error.message}`);
    }
  }

  async uploadFromUrl(imageUrl: string, filename: string): Promise<{ url: string; fileId: string }> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = response.headers.get('content-type') || 'image/jpeg';

      return await this.uploadImage(buffer, filename, mimeType);
    } catch (error: any) {
      throw new Error(`Failed to upload image from URL: ${error.message}`);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({ fileId });
    } catch (error: any) {
      throw new Error(`Failed to delete file from Google Drive: ${error.message}`);
    }
  }
}

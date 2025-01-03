/**
 * src/services/driveService.ts
 * 
 * Provides methods to interact with Google Drive API for file operations.
 * Handles file saving, retrieval, and updates for .bloomdocx files.
 * 
 * Dependencies:
 * - google-auth-library for OAuth2
 * - googleapis for Drive API
 * - AuthService for token management
 * - Environment variables for API configuration
 */

import { drive_v3, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GaxiosResponse } from 'gaxios';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export class DriveService {
  private static instance: DriveService;
  private drive: drive_v3.Drive | null = null;

  private constructor() {}

  static getInstance(): DriveService {
    if (!DriveService.instance) {
      DriveService.instance = new DriveService();
    }
    return DriveService.instance;
  }

  getDriveInstance(): drive_v3.Drive {
    if (!this.drive) throw new Error('Drive client not initialized');
    return this.drive;
  }

  async initializeDriveClient(accessToken: string): Promise<void> {
    const oauth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    });
    
    oauth2Client.setCredentials({ access_token: accessToken });
    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
  }

  async saveFile(fileName: string, content: Buffer, folderId?: string): Promise<string> {
    if (!this.drive) throw new Error('Drive client not initialized');

    const fileMetadata: drive_v3.Schema$File = {
      name: `${fileName}.bloomdocx`,
      mimeType: 'application/vnd.bloom.document',
      parents: folderId ? [folderId] : undefined
    };

    const media = {
      mimeType: 'application/vnd.bloom.document',
      body: content
    };

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id'
    });

    return response.data.id!;
  }

  async updateFile(fileId: string, content: Buffer): Promise<void> {
    if (!this.drive) throw new Error('Drive client not initialized');

    await this.drive.files.update({
      fileId,
      media: {
        mimeType: 'application/vnd.bloom.document',
        body: content
      }
    });
  }

  async getFile(fileId: string): Promise<Buffer> {
    if (!this.drive) throw new Error('Drive client not initialized');

    const response = await this.drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'arraybuffer' }) as GaxiosResponse<ArrayBuffer>;

    return Buffer.from(new Uint8Array(response.data));
  }


  async listFiles(): Promise<DriveFile[]> {
    if (!this.drive) throw new Error('Drive client not initialized');

    const response = await this.drive.files.list({
      q: "mimeType='application/vnd.bloom.document'",
      fields: 'files(id, name, mimeType, modifiedTime)'
    });

    return response.data.files as DriveFile[];
  }
}

export default DriveService.getInstance();
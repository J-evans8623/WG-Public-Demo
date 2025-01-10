/**
 * File: /server/services/google-drive.ts
 * Responsibility: Provide methods to manage Google Drive content on behalf of the user.
 * Dependencies:
 *   - googleapis for Google Drive API interaction.
 *   - /server/auth/session.ts for retrieving session data.
 */

import { google, drive_v3 } from 'googleapis';
// Instead of importing RedisSessionManager directly, import the interface
import { SessionManager, SessionData } from '../auth/session';
import { Readable } from 'stream';
export interface IGoogleDriveService {
  saveDocument(sessionId: string, content: any, fileName:string): Promise<string>;
  loadDocument(sessionId: string, fileId: string): Promise<any>;
  enableAutoSave(sessionId: string, fileId: string): Promise<void>;
}

export class GoogleDriveService implements IGoogleDriveService {
  private authClient = new google.auth.OAuth2();

  // Inject an existing session manager via constructor
  constructor(private sessionManager: SessionManager) {}

  /**
   * Fetches the user's session from Redis, sets the access token,
   * and returns an authenticated Drive client.
   */
  private async authenticate(sessionId: string): Promise<{ driveClient: drive_v3.Drive; userData: SessionData }> {
    const session: SessionData | null = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('No valid session found for user.');
    }
    if (!session.accessToken) {
      throw new Error('Session has no access token.');
    }

    this.authClient.setCredentials({ access_token: session.accessToken });
    const driveClient = google.drive({ version: 'v3', auth: this.authClient });

    return { driveClient, userData: session };
  }

  /**
   * Saves a document to the user's Google Drive.
   * @param sessionId - The session identifier from the client.
   * @param content - The content to save.
   * @returns The ID of the newly created file.
   */
  async saveDocument(sessionId: string, content: any, fileName:string): Promise<string> {
    const { driveClient, userData } = await this.authenticate(sessionId);

    // Decode Base64 content to binary
  const bufferContent = Buffer.from(content, 'base64');
  const bufferStream = new Readable();
  bufferStream.push(bufferContent);
  bufferStream.push(null);

    const fileMetadata = {
      name: `${fileName}.bloomdocx`,
      mimeType: 'application/octet-stream',
    };
    const media = {
      mimeType: 'application/octet-stream',
      body:  bufferStream,
    };

    const response = await driveClient.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id',
    });

    if (!response.data.id) {
      throw new Error('Failed to save document to Google Drive.');
    }

    // Optionally, log or perform actions based on userData
    console.log(`Document saved for user: ${userData.userId} with fileId: ${response.data.id}`);

    return response.data.id;
  }

  /**
   * Loads a document from the user's Google Drive.
   * @param sessionId - The session identifier from the client.
   * @param fileId - The ID of the file to load.
   * @returns The file content.
   */
  async loadDocument(sessionId: string, fileId: string): Promise<any> {
    const { driveClient, userData } = await this.authenticate(sessionId);

    const response = await driveClient.files.get({
      fileId,
      alt: 'media',
    }, { responseType: 'stream' });
  
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      response.data.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      response.data.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Enables autosave functionality for a specific document.
   * (This function is a placeholder and requires further backend logic for autosave intervals.)
   * @param sessionId - The session identifier from the client.
   * @param fileId - The ID of the file to enable autosave for.
   */
  async enableAutoSave(sessionId: string, fileId: string): Promise<void> {
    const { userData } = await this.authenticate(sessionId);
    console.log(`Autosave enabled for file: ${fileId} by user: ${userData.userId}`);
    // Implement backend autosave logic, e.g., scheduling regular saves.
  }
/**
   * Lists files from the user's Google Drive.
   * @param sessionId - The session identifier from the client.
   * @param query - Optional search query to filter files.
   * @returns An array of files with metadata.
   */
async listFiles(sessionId: string, query?: string): Promise<drive_v3.Schema$File[]> {
  const { driveClient } = await this.authenticate(sessionId);

  const params: drive_v3.Params$Resource$Files$List = {
    pageSize: 100,
    fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
    orderBy: 'modifiedTime desc',
  };

  if (query) {
    params.q = `name contains '${query}' and trashed = false`;
  } else {
    params.q = 'trashed = false';
  }

  const response = await driveClient.files.list(params);

  return response.data.files || [];
}
}
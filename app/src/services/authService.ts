/**
 * authService.ts
 * 
 * Provides a comprehensive service for Google authentication and Drive operations.
 * Combines authentication, drive operations, and sharing functionality into a single service.
 * 
 * Responsibilities:
 * - Handles Google OAuth2 authentication flow
 * - Manages access tokens and refresh tokens
 * - Provides Google Drive operations (create, read, update, delete)
 * - Handles file sharing and permissions
 * - Manages user persistence and JWT generation
 * 
 * Dependencies:
 * - google-auth-library for OAuth2
 * - googleapis for Drive API
 * - Mongoose for user persistence
 * - JwtUtils for JWT operations
 */

import { OAuth2Client } from 'google-auth-library';
import { drive_v3, google } from 'googleapis';
import { Readable } from 'stream';
import UserModel, { IUser } from '../models/userModel';
import JwtUtils from '../utils/jwtUtils';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export interface ShareSettings {
  role: 'reader' | 'writer' | 'commenter';
  type: 'user' | 'domain' | 'anyone';
  emailAddress?: string;
  domain?: string;
}

class AuthService {
  private static instance: AuthService;
  private googleClient: OAuth2Client;
  private drive: drive_v3.Drive | null = null;

  private constructor() {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.REDIRECT_URL
    );
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initializes the Drive client with provided access token
   * @param accessToken - Valid Google OAuth2 access token
   */
  async initializeDriveClient(accessToken: string): Promise<void> {
    try {
      this.googleClient.setCredentials({
        access_token: accessToken,
        scope: 'https://www.googleapis.com/auth/drive.file'
      });

      await this.verifyToken(accessToken);

      this.drive = google.drive({
        version: 'v3',
        auth: this.googleClient
      });
    } catch (error) {
      console.error('Failed to initialize Drive client:', error);
      throw error;
    }
  }

  /**
   * Verifies the validity of an access token
   * @param token - Access token to verify
   */
  private async verifyToken(token: string): Promise<void> {
    try {
      await this.googleClient.getTokenInfo(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Saves a file to Google Drive
   * @param fileName - Name of the file
   * @param content - File content as Buffer
   * @param folderId - Optional folder ID
   * @returns File ID of the saved file
   */
  async saveFile(fileName: string, content: Buffer, folderId?: string): Promise<string> {
    if (!this.drive) throw new Error('Drive client not initialized');

    try {
      const fileStream = new Readable();
      fileStream.push(content);
      fileStream.push(null);

      const requestBody = {
        name: `${fileName}.bloomdocx`,
        mimeType: 'application/vnd.bloom.document',
        ...(folderId && { parents: [folderId] }),
      };

      const response = await this.drive.files.create({
        requestBody,
        media: {
          mimeType: 'application/octet-stream',
          body: fileStream,
        },
        fields: 'id',
      });

      if (!response.data.id) {
        throw new Error('Failed to get file ID from response');
      }

      return response.data.id;
    } catch (error) {
      console.error('Error saving file to Drive:', error);
      throw error;
    }
  }

  /**
   * Updates an existing file in Google Drive
   * @param fileId - ID of the file to update
   * @param content - New file content
   */
  async updateFile(fileId: string, content: Buffer): Promise<void> {
    if (!this.drive) throw new Error('Drive client not initialized');

    try {
      const fileStream = new Readable();
      fileStream.push(content);
      fileStream.push(null);

      await this.drive.files.update({
        fileId,
        media: {
          mimeType: 'application/octet-stream',
          body: fileStream,
        },
      });
    } catch (error) {
      console.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * Retrieves a file from Google Drive
   * @param fileId - ID of the file to retrieve
   * @returns File content as Buffer
   */
  async getFile(fileId: string): Promise<Buffer> {
    if (!this.drive) throw new Error('Drive client not initialized');

    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      console.error('Error getting file:', error);
      throw error;
    }
  }

  /**
   * Lists all .bloomdocx files in Drive
   * @returns Array of DriveFile objects
   */
  async listFiles(): Promise<DriveFile[]> {
    if (!this.drive) throw new Error('Drive client not initialized');

    try {
      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.bloom.document'",
        fields: 'files(id, name, mimeType, modifiedTime)',
      });

      return (response.data.files || [])
        .filter((file): file is Required<Pick<drive_v3.Schema$File, 'id' | 'name' | 'mimeType'>> & 
          { modifiedTime?: string } =>
          Boolean(file.id && file.name && file.mimeType)
        )
        .map(file => ({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          modifiedTime: file.modifiedTime || undefined,
        }));
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Shares a file with specified permissions
   * @param fileId - ID of the file to share
   * @param settings - Share settings including permissions
   */
  async shareFile(fileId: string, settings: ShareSettings): Promise<void> {
    if (!this.drive) throw new Error('Drive client not initialized');

    try {
      const requestBody = {
        role: settings.role,
        type: settings.type,
        ...(settings.emailAddress && { emailAddress: settings.emailAddress }),
        ...(settings.domain && { domain: settings.domain }),
      };

      await this.drive.permissions.create({
        fileId,
        requestBody,
        sendNotificationEmail: true,
      });
    } catch (error) {
      console.error('Error sharing file:', error);
      throw error;
    }
  }

  // Original AuthService methods

  generateAuthUrl(actionType: string): string {
    return this.googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.appdata',
      ],
      prompt: 'consent',
      state: actionType,
    });
  }

  async getTokensFromCode(code: string): Promise<any> {
    const { tokens } = await this.googleClient.getToken(code);
    this.googleClient.setCredentials(tokens);
    return tokens;
  }

  async validateToken(token: string): Promise<any> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (!response.ok) throw new Error('Failed to validate token');
      
      return await response.json();
    } catch (error) {
      throw new Error('Invalid Google OAuth token.');
    }
  }

  async retrieveUser(googleUserData: any): Promise<IUser> {
    const { sub: googleId, email } = googleUserData;
    let user = await UserModel.findOne({ googleId });
    if (!user) {
      user = await UserModel.create({ googleId, email });
    }
    return user;
  }

  generateJWT(user: IUser): string {
    return JwtUtils.generateJWT({
      id: user._id,
      email: user.email,
      accountType: user.accountType,
    });
  }
}

export default AuthService.getInstance();
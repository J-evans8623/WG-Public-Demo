/**
 * src/services/driveShareService.ts
 * 
 * Manages file sharing capabilities through Google Drive.
 * 
 * Dependencies:
 * - DriveService for file operations
 * - googleapis for Drive API types
 */

import { drive_v3 } from 'googleapis';
import driveServiceInstance, { DriveService } from './driveService';

export interface ShareSettings {
    type: 'user' | 'domain' | 'anyone';
    role: 'reader' | 'writer' | 'commenter';
    emailAddress?: string;
    domain?: string;
  }
  
  class DriveShareService {
    private static instance: DriveShareService;
    private driveService: DriveService;

    private constructor() {
        this.driveService = driveServiceInstance;
      }
  
      static getInstance(): DriveShareService {
        if (!DriveShareService.instance) {
          DriveShareService.instance = new DriveShareService();
        }
        return DriveShareService.instance;
      }
  
      async shareFile(fileId: string, settings: ShareSettings): Promise<void> {
        if (!this.driveService.getDriveInstance()) throw new Error('Drive client not initialized');
    
        const permission: drive_v3.Schema$Permission = {
          type: settings.type,
          role: settings.role,
          emailAddress: settings.emailAddress,
          domain: settings.domain
        };
    
        await this.driveService.getDriveInstance().permissions.create({
          fileId,
          requestBody: permission,
          sendNotificationEmail: true
        });
      }
  
    async getShareSettings(fileId: string): Promise<drive_v3.Schema$Permission[]> {
      const driveService = DriveService.getInstance();
      if (!driveService.getDriveInstance()) throw new Error('Drive client not initialized');
  
      const response = await driveService.getDriveInstance().permissions.list({
        fileId,
        fields: 'permissions(id, type, role, emailAddress, domain)'
      });
  
      return response.data.permissions || [];
    }
  
    async updateShareSettings(
      fileId: string, 
      permissionId: string, 
      settings: Partial<ShareSettings>
    ): Promise<void> {
      const driveService = DriveService.getInstance();
      if (!driveService.getDriveInstance()) throw new Error('Drive client not initialized');
  
      await driveService.getDriveInstance().permissions.update({
        fileId,
        permissionId,
        requestBody: settings as drive_v3.Schema$Permission
      });
    }
  }
  
  export default DriveShareService.getInstance();
// services/frontendDriveService.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:5000';

export class FrontendDriveService {
  private static getHeaders(accessToken: string) {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  static async saveFile(fileName: string, content: any, accessToken: string, folderId?: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drive/save`, {
        method: 'POST',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({ fileName, content, folderId })
      });

      if (!response.ok) {
        throw new Error('Failed to save file');
      }

      const data = await response.json();
      return data.fileId;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }

  static async loadFile(fileId: string, accessToken: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drive/load/${fileId}`, {
        method: 'GET',
        headers: this.getHeaders(accessToken)
      });

      if (!response.ok) {
        throw new Error('Failed to load file');
      }

      const data = await response.json();
      return Buffer.from(data.content, 'base64');
    } catch (error) {
      console.error('Error loading file:', error);
      throw error;
    }
  }

  static async listFiles(accessToken: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drive/list`, {
        method: 'GET',
        headers: this.getHeaders(accessToken)
      });

      if (!response.ok) {
        throw new Error('Failed to list files');
      }

      const data = await response.json();
      return data.files;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  static async shareFile(fileId: string, settings: any, accessToken: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drive/share`, {
        method: 'POST',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({ fileId, settings })
      });

      if (!response.ok) {
        throw new Error('Failed to share file');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sharing file:', error);
      throw error;
    }
  }

  static async updateFile(fileId: string, content: any, accessToken: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/drive/update`, {
        method: 'PUT',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify({ fileId, content })
      });

      if (!response.ok) {
        throw new Error('Failed to update file');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating file:', error);
      throw error;
    }
  }
}
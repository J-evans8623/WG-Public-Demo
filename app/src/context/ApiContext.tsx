/***************************************************************************************
 * @file ApiContext.tsx
 * @description
 *   Provides client-side functions for communicating with the backend API.
 *   This update integrates file deletion functionality. The new function:
 *     - deleteFile: Calls the /api/document/delete endpoint to delete a file.
 *
 * Responsibilities:
 *   - Expose functions for authentication and file management.
 *   - Include new functionality to delete files using the secure BFF endpoint.
 *
 * @author 
 * @date 
 ***************************************************************************************/
import React, { createContext, useState } from 'react';

export interface DriveFile {
  fileId: string;            // Firestore doc ID (docFileID)
  name: string;              // e.g. "My Document"
  timestamp: string;         // e.g. "2025-03-25T23:59:59Z"
  fileSize: number;          // e.g. 12345
  contentType: string;       // e.g. "application/octet-stream"
  fileStoragePath: string;   // e.g. "documents/some-uuid.bloomdocx"
}

interface User {
  email: string;
  accountType: 'free' | 'premium';
}

interface ApiContextType {
  signOut: () => Promise<void>;
  listFiles: (query?: string) => Promise<{
    ownedFiles: DriveFile[];
    sharedFiles: DriveFile[];
  }>;
  getWebSocketUrl: (documentId: string) => Promise<string>;
  deleteFile: (fileStorageId: string) => Promise<void>;
}

export const ApiContext = createContext<ApiContextType>({
  signOut: async () => {},
  listFiles: async () => ({ ownedFiles: [], sharedFiles: [] }),
  getWebSocketUrl: async () => '',
  deleteFile: async () => {},
});

export const ApiProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setIsGuest(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };


const listFiles = async (query?: string) => {
    console.log('ApiContext.tsx 9001 › fetching file lists');
    const url = new URL('/api/files/list', window.location.origin);
    if (query) url.searchParams.append('query', query);

    const res = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include'
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('ApiContext.tsx 9002 › listFiles failed:', res.statusText, text);
      throw new Error(`List files failed: ${res.statusText}`);
    }

    const data = await res.json() as {
      ownedFiles: any[];
      sharedFiles: any[];
    };
    console.log('ApiContext.tsx 9003 › received ownedFiles count', data.ownedFiles.length);
    console.log('ApiContext.tsx 9004 › received sharedFiles count', data.sharedFiles.length);

    const mapDriveFile = (f: any): DriveFile => ({
      fileId: f.fileId,
      name: f.fileName,
      timestamp: f.timestamp,
      fileSize: f.fileSize,
      contentType: f.contentType,
      fileStoragePath: f.fileStoragePath
    });

    return {
      ownedFiles: data.ownedFiles.map(mapDriveFile),
      sharedFiles: data.sharedFiles.map(mapDriveFile),
    };
  };

  const getWebSocketUrl = async (documentId: string): Promise<string> => {
    try {
      const maxRetries = 3;
      let retryCount = 0;
      let lastError: Error | null = null;
      while (retryCount < maxRetries) {
        try {
          const response = await fetch('/api/realtime/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ documentId }),
          });
          if (!response.ok) {
            throw new Error(`Failed to fetch WebSocket URL: ${response.statusText}`);
          }
          const data = await response.json();
          const wsUrl = new URL(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:1234');
          wsUrl.searchParams.append('token', data.token);
          return wsUrl.toString();
        } catch (error) {
          lastError = error as Error;
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
          }
        }
      }
      throw lastError || new Error('Failed to get WebSocket URL after retries');
    } catch (error) {
      console.error('Error fetching WebSocket URL:', error);
      throw error;
    }
  };

  /**
   * Deletes a file from Firebase by calling the deletion API endpoint.
   * @param fileStorageId - The storage path identifier of the file to delete.
   */
  const deleteFile = async (fileStorageId: string): Promise<void> => {
    try {
      const url = new URL('/api/document/delete', window.location.origin);
      url.searchParams.append('fileStorageId', fileStorageId);
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete file failed:', response.statusText, errorText);
        throw new Error(`Delete file failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  };

  return (
    <ApiContext.Provider
      value={{
        signOut,
        listFiles,
        getWebSocketUrl,
        deleteFile,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};

export default ApiProvider;

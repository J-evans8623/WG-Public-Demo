/***************************************************************************************
 * @file ApiContext.tsx
 * @description
 *   Provides client-side functions for communicating with the backend API.
 *   UPDATED: Now uses the proper UserFileMetadata interface instead of deprecated DriveFile.
 *   This ensures type safety and aligns with the actual Firebase schema.
 *
 * Responsibilities:
 *   - Expose functions for authentication and file management.
 *   - Include functionality to delete files using the secure BFF endpoint.
 *   - Use proper typing that matches the backend data structure.
 *
 * @author 
 * @date 
 ***************************************************************************************/
import React, { createContext, useState } from 'react';
import { UserFileMetadata, UserFilesResponse } from '@/app/src/types/fileTypes';

interface User {
  email: string;
  accountType: 'free' | 'premium';
}

interface ApiContextType {
  signOut: () => Promise<void>;
  listFiles: (query?: string) => Promise<UserFilesResponse>;
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

  /**
   * @function listFiles
   * @description
   *   Fetches user files from the backend API. Now returns UserFileMetadata objects
   *   with proper role information and type safety.
   * 
   * @param query - Optional search query string
   * @returns Promise<UserFilesResponse> - Object containing ownedFiles and sharedFiles arrays
   */
  const listFiles = async (query?: string): Promise<UserFilesResponse> => {
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

    const data = await res.json() as UserFilesResponse;
    console.log('ApiContext.tsx 9003 › received ownedFiles count', data.ownedFiles.length);
    console.log('ApiContext.tsx 9004 › received sharedFiles count', data.sharedFiles.length);

    /**
     * @function mapToUserFileMetadata
     * @description
     *   Converts raw API response to properly typed UserFileMetadata.
     *   Ensures all required fields are present and properly typed.
     */
    const mapToUserFileMetadata = (f: any): UserFileMetadata => {
      // Handle timestamp conversion - could be Firestore Timestamp or ISO string
      let updatedAt: string;
      if (f.updatedAt) {
        updatedAt = f.updatedAt;
      } else if (f.timestamp) {
        // Handle Firestore Timestamp objects
        if (f.timestamp.toDate && typeof f.timestamp.toDate === 'function') {
          updatedAt = f.timestamp.toDate().toISOString();
        } else if (typeof f.timestamp === 'string') {
          updatedAt = new Date(f.timestamp).toISOString();
        } else {
          updatedAt = new Date().toISOString();
        }
      } else {
        updatedAt = new Date().toISOString();
      }

      return {
        fileId: f.fileId || '',
        ownerId: f.ownerId || '',
        fileName: f.fileName || 'Untitled Document',
        fileStoragePath: f.fileStoragePath || '',
        timestamp: f.timestamp || new Date().toISOString(),
        fileSize: f.fileSize || 0,
        contentType: f.contentType || 'application/octet-stream',
        editors: f.editors || [],
        sharedWith: f.sharedWith || [],
        publicEdit: f.publicEdit || false,
        publicView: f.publicView || false,
        // These should be computed by the backend
        role: f.role || 'Viewer',
        updatedAt: updatedAt
      };
    };

    return {
      ownedFiles: data.ownedFiles.map(mapToUserFileMetadata),
      sharedFiles: data.sharedFiles.map(mapToUserFileMetadata),
    };
  };

  /**
   * @function getWebSocketUrl
   * @description
   *   Fetches a WebSocket URL with authentication token for real-time collaboration.
   * 
   * @param documentId - The document ID to connect to
   * @returns Promise<string> - WebSocket URL with embedded token
   */
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
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 30000));
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
   * @function deleteFile
   * @description
   *   Deletes a file from Firebase by calling the deletion API endpoint.
   * 
   * @param fileStorageId - The storage path identifier of the file to delete
   * @returns Promise<void>
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
      
      console.log('ApiContext.tsx 9005 › file deleted successfully:', fileStorageId);
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



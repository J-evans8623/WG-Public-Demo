// File: /app/src/context/ApiContext.tsx

import React, { createContext, useState, useEffect, useContext } from 'react';
import { openAuthPopup } from './authUtils';


export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

interface User {
  email: string;
  accountType: 'free' | 'premium';
}

interface ApiContextType {
  isAuthenticated: boolean;
  isGuest: boolean;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  skipAuth: () => void;
  saveToDrive: (content: ArrayBuffer,  fileName:string) => Promise<string>;
  loadFromDrive: (fileId: string) => Promise<ArrayBuffer>;
  listFiles: (query?: string) => Promise<DriveFile[]>;
  getWebSocketUrl: (documentId: string) => Promise<string>;
  updateDriveFile: (fileId: string, content: ArrayBuffer) => Promise<string>;
  autosaveDocument: (documentContent: ArrayBuffer, fileName: string, fileId?: string) => Promise<string>;
}

export const ApiContext = createContext<ApiContextType>({
  isAuthenticated: false,
  isGuest: false,
  user: null,
  signIn: async () => {},
  signOut: async () => {},
  skipAuth: () => {},
  saveToDrive: async () => '',
  loadFromDrive: async () => new ArrayBuffer(0),
  listFiles: async () => [],
  getWebSocketUrl: async () => '',
  updateDriveFile: async () => '',
  autosaveDocument: async () => '',
});

export const ApiProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.session) {
            setUser({ email: data.session.email, accountType: data.session.accountType });// do this on the backend
          } else {
            console.log('No active session found.');
          }
        } else {
          console.error('Failed to fetch session:', response.status);
        }
      } catch (error) {
        console.error('Error fetching session:', error);
      }
    };
  
    fetchSession();
  
    const handleMessage = async (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'AUTH_SUCCESS') {
        await fetchSession(); // Refresh session data after successful auth
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  
  }, []);

  const signIn = async () => {
    try {
      const popup = openAuthPopup();
      if (!popup) {
        throw new Error('Popup blocked. Please enable popups for this site.');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setIsGuest(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const skipAuth = () => {
    setIsGuest(true);
    setUser(null);
  };

  /**
   * Saves a document to Google Drive via the BFF.
   * @param content - The ArrayBuffer content of the .bloomdocx file.
   * @returns The Google Drive file ID.
   */
  const saveToDrive = async (content: ArrayBuffer, fileName:string): Promise<string> => {
    try {
      // Convert ArrayBuffer to Base64 string
      const base64Content = Buffer.from(content).toString('base64');
  
      const response = await fetch('/api/drive/save', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json', // Change to JSON
        },
        body: JSON.stringify({ content: base64Content, fileName }), // Send as JSON
      });
  
      console.log('Drive save response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save to Drive failed:', response.statusText, errorText);
        throw new Error(`Save to Drive failed: ${response.statusText}`);
      }
  
      const data = await response.json();
      console.log('Save to Drive successful:', data);
      return data.fileId;
    } catch (error) {
      console.error('Error saving to Drive:', error);
      throw error;
    }
  };

    /**
   * Updates an existing Google Drive file.
   * @param fileId - The ID of the file to update.
   * @param content - The ArrayBuffer content of the updated .bloomdocx file.
   * @returns The updated Google Drive file ID.
   */
    const updateDriveFile = async (fileId: string, content: ArrayBuffer): Promise<string> => {
      try {
        // Convert ArrayBuffer to Base64 string
        const base64Content = Buffer.from(content).toString('base64');
  
        const response = await fetch('/api/drive/update', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileId, content: base64Content }),
        });
  
        console.log('Drive update response status:', response.status);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Update Drive failed:', response.statusText, errorText);
          throw new Error(`Update Drive failed: ${response.statusText}`);
        }
  
        const data = await response.json();
        console.log('Update Drive successful:', data);
        return data.fileId;
      } catch (error) {
        console.error('Error updating Drive:', error);
        throw error;
      }
    };
  

  /**
   * Loads a document from Google Drive via the BFF.
   * @param fileId - The Google Drive file ID.
   * @returns The ArrayBuffer content of the .bloomdocx file.
   */
  const loadFromDrive = async (fileId: string): Promise<ArrayBuffer> => {
    try {
      const response = await fetch(`/api/drive/load?fileId=${encodeURIComponent(fileId)}`, {
        method: 'GET',
        credentials: 'include',
      });
  
      if (!response.ok) {
        throw new Error(`Load from Drive failed: ${response.statusText}`);
      }
  
      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer;
    } catch (error) {
      console.error('Error loading from Drive:', error);
      throw error;
    }
  };
  

  /**
   * Lists files from Google Drive via the BFF.
   * @param query - Optional search query to filter files by name.
   * @returns An array of DriveFile objects.
   */
  const listFiles = async (query?: string): Promise<DriveFile[]> => {
    try {
      const url = new URL('/api/drive/list', window.location.origin);
      if (query) {
        url.searchParams.append('query', query);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('List files failed:', response.statusText, errorText);
        throw new Error(`List files failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.files as DriveFile[];
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  };

 /**
   * Retrieves a WebSocket URL for real-time synchronization.
   * @param documentId - The active document ID.
   * @returns A Promise resolving to the WebSocket URL.
   */
// ApiContext.tsx
const getWebSocketUrl = async (documentId: string): Promise<string> => {
  try {
    // Add retry logic with exponential backoff
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
          // Exponential backoff
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
   * Autosaves a document by deciding whether to create a new file or update an existing one based on the presence of `fileId`.
   * @param documentContent - The ArrayBuffer content of the document to autosave.
   * @param fileName - The name of the file to save.
   * @param fileId - (Optional) The existing Google Drive file ID.
   * @returns The Google Drive file ID after autosave.
   */
  const autosaveDocument = async (documentContent: ArrayBuffer, fileName: string, fileId?: string): Promise<string> => {
    try {
      if (fileId) {
        // Update existing file
        const updatedFileId = await updateDriveFile(fileId, documentContent);
        return updatedFileId;
      } else {
        // Create new file
        const newFileId = await saveToDrive(documentContent, fileName);
        return newFileId;
      }
    } catch (error) {
      console.error('Error during autosave:', error);
      throw error;
    }
  };


  return (
    <ApiContext.Provider
      value={{
        isAuthenticated: !!user,
        isGuest,
        user,
        signIn,
        signOut,
        skipAuth,
        saveToDrive,
        loadFromDrive,
        listFiles,
        getWebSocketUrl,
        updateDriveFile,
        autosaveDocument,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};



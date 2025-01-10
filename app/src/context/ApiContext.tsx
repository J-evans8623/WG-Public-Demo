// File: /app/src/context/ApiContext.tsx

import React, { createContext, useState, useEffect, useContext } from 'react';
import { openAuthPopup } from './authUtils';
import { DriveFile } from '../services/authService';

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
            setUser({ email: data.session.email, accountType: data.session.accountType });
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
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};

export type { DriveFile };

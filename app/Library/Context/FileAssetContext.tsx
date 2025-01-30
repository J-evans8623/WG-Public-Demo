// contexts/FileAssetContext.tsx

/**
 * 
 * FileAssetContext provides an interface for all application logic that deals with uploading PDF, DOC, DOCX, and text files to the frontend client for use. 
 * This file provides methods for users to upload their files and fetch content from the backend so users can read 
 * the content of the files they uploaded. The application uses Y.Doc to facilitate a collaborative environment. 
 * The TextFileMessage contains a URL to the files held on the backend associated with a specific concept map document. 
 * Any logic pertaining to uploading and managing these files is handled here, making this file the sole point of contact with the backend.
 * 
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode
} from 'react';
import * as Y from 'yjs';
import { useYDoc } from './YDocContext';
import { TextFileMessage } from '../Definitions/Definitions';

interface FileAssetContextType {
  files: Map<string, TextFileMessage>;
  addFile: (file: File) => Promise<void>;
  removeFile: (fileId: string) => Promise<void>;
  getAllFiles: () => TextFileMessage[];
  getFileById: (fileId: string) => TextFileMessage | undefined;
  getFileContent: (fileId: string) => Promise<string>;
  clearCache: (fileId: string) => void;
}

interface CachedContent {
  content: string;
  timestamp: number;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const FileAssetContext = createContext<FileAssetContextType | undefined>(undefined);

/**
 * fetchFileContent fetches the entire content of a file from the server.
 * For PDFs, it returns the server URL to allow client-side rendering with react-pdf.
 * For HTML and TXT files, it fetches and returns the content as text.
 */
const fetchFileContent = async (serverUrl: string, fileType: TextFileMessage['type']): Promise<string> => {
  const response = await fetch(serverUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch file content');
  }

  if (fileType === 'pdf') {
    // For PDFs, return the server URL to be used by react-pdf
    return serverUrl;
  } else {
    // For HTML and TXT, return the content as text
    return await response.text();
  }
};

export const FileAssetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ydoc } = useYDoc();
  const yFileMap = ydoc.getMap<TextFileMessage>('fileAssets');
  const [files, setFiles] = useState<Map<string, TextFileMessage>>(new Map());
  const contentCache = useMemo(() => new Map<string, CachedContent>(), []);

  // Initialize files from Y.js on mount
  useEffect(() => {
    const loadInitialFiles = () => {
      const initialFiles = new Map<string, TextFileMessage>();
      yFileMap.forEach((file, id) => {
        initialFiles.set(id, file);
      });
      setFiles(initialFiles);
    };

    loadInitialFiles();

    // Subscribe to Y.js changes
    const updateListener = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      if (transaction.origin?.type === 'system') {
        return;
      }

      const updatedFiles = new Map<string, TextFileMessage>();
      yFileMap.forEach((file, id) => {
        updatedFiles.set(id, file);
      });
      setFiles(updatedFiles);
    };

    yFileMap.observeDeep(updateListener);
    return () => yFileMap.unobserveDeep(updateListener);
  }, [yFileMap]);

  const validateFileType = useCallback((file: File): boolean => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    return allowedTypes.includes(file.type);
  }, []);

  const getMimeTypeMapping = (mimeType: string): TextFileMessage['type'] => {
    const mapping: Record<string, TextFileMessage['type']> = {
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    return mapping[mimeType] || 'txt';
  };

  const addFile = useCallback(async (file: File) => {
    try {
      if (!validateFileType(file)) {
        throw new Error('Invalid file type. Only PDF, TXT, DOC, and DOCX files are allowed.');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/FileAssets', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload file');
      }

      const { id, size, type } = await response.json();

      // Manually construct the correct serverUrl based on backend refactor
      const serverUrl = `/api/FileAssets?id=${id}`;

      // Log the serverUrl to confirm correctness
      console.log(`File uploaded. ID: ${id}, Server URL: ${serverUrl}`);

      const fileMessage: TextFileMessage = {
        id,
        type: getMimeTypeMapping(file.type),
        title: file.name,
        serverUrl, // Correctly set to `/api/FileAssets?id={id}`
        uploadDate: new Date(),
        size
      };

      ydoc.transact(() => {
        yFileMap.set(fileMessage.id, fileMessage);
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }, [ydoc, yFileMap, validateFileType]);

  const removeFile = useCallback(async (fileId: string) => {
    try {
      await fetch(`/api/FileAssets?id=${fileId}`, {
        method: 'DELETE'
      });

      ydoc.transact(() => {
        yFileMap.delete(fileId);
      });

      // Clear cached content upon file removal
      clearCache(fileId);
    } catch (error) {
      console.error('Error removing file:', error);
      throw error;
    }
  }, [ydoc, yFileMap]);

  const getAllFiles = useCallback(() => {
    return Array.from(files.values());
  }, [files]);

  const getFileById = useCallback((fileId: string) => {
    return files.get(fileId);
  }, [files]);

  const getCachedContent = (fileId: string): string | null => {
    const cachedData = contentCache.get(fileId);
    if (!cachedData) return null;

    if (Date.now() - cachedData.timestamp > CACHE_DURATION) {
      contentCache.delete(fileId);
      return null;
    }

    return cachedData.content;
  };

  const setCachedContent = (fileId: string, content: string) => {
    contentCache.set(fileId, {
      content,
      timestamp: Date.now()
    });
  };

  /**
   * getFileContent fetches the entire content of a file.
   * For PDFs, it returns the server URL.
   * For HTML and TXT, it fetches and returns the content as text.
   */
  const getFileContent = useCallback(async (fileId: string): Promise<string> => {
    const cached = getCachedContent(fileId);
    if (cached) {
      console.log(`Fetching content from cache for file ID: ${fileId}`);
      return cached;
    }

    const file = files.get(fileId);
    if (!file) throw new Error('File not found');

    console.log(`Fetching content from server for file ID: ${fileId}, URL: ${file.serverUrl}`);

    const content = await fetchFileContent(file.serverUrl, file.type);
    setCachedContent(fileId, content);
    return content;
  }, [files, contentCache]);

  const clearCache = useCallback((fileId: string) => {
    contentCache.delete(fileId);
    console.log(`Cache cleared for file ID: ${fileId}`);
  }, [contentCache]);

  const value = useMemo(() => ({
    files,
    addFile,
    removeFile,
    getAllFiles,
    getFileById,
    getFileContent,
    clearCache,
  }), [files, addFile, removeFile, getAllFiles, getFileById, getFileContent, clearCache]);

  return (
    <FileAssetContext.Provider value={value}>
      {children}
    </FileAssetContext.Provider>
  );
};

export const useFileAsset = () => {
  const context = useContext(FileAssetContext);
  if (!context) {
    throw new Error('useFileAsset must be used within FileAssetProvider');
  }
  return context;
};

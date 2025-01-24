// ImageContext.tsx

import React, { createContext, useContext, useCallback, useState, useMemo, ReactNode } from 'react';
import { toast } from 'react-toastify';

interface ImageMetadata {
  file: File;
  localUrl: string;
  serverUrl?: string;
}

interface ImageContextType {
  // Image management
  storeImage: (id: string, file: File) => Promise<string>;
  getImage: (id: string) => File | undefined;
  getLocalUrl: (id: string) => string | undefined;
  getServerUrl: (id: string) => string | undefined;
  
  // Cache management
  clearCache: () => void;
  invalidateImage: (id: string) => void;
}

const ImageContext = createContext<ImageContextType | undefined>(undefined);

export const useImage = () => {
  const context = useContext(ImageContext);
  if (!context) {
    throw new Error('useImage must be used within ImageProvider');
  }
  return context;
};

interface ImageProviderProps {
  children: ReactNode;
}

export const ImageProvider: React.FC<ImageProviderProps> = ({ children }) => {
  // State for image cache
  const [imageCache, setImageCache] = useState<Map<string, ImageMetadata>>(new Map());

  // Image management methods
  const storeImage = useCallback(async (id: string, file: File): Promise<string> => {
    try {
      // Create local URL for UI
      const localUrl = URL.createObjectURL(file);

      // Store in cache
      setImageCache(prev => {
        const newCache = new Map(prev);
        newCache.set(id, { file, localUrl });
        return newCache;
      });

      return localUrl;
    } catch (error) {
      console.error('Error storing image:', error);
      toast.error('Failed to store image');
      throw error;
    }
  }, []);

  const getImage = useCallback((id: string): File | undefined => {
    return imageCache.get(id)?.file;
  }, [imageCache]);

  const getLocalUrl = useCallback((id: string): string | undefined => {
    return imageCache.get(id)?.localUrl;
  }, [imageCache]);

  const getServerUrl = useCallback((id: string): string | undefined => {
    return imageCache.get(id)?.serverUrl;
  }, [imageCache]);

  // Cache management methods
  const clearCache = useCallback(() => {
    // Revoke all object URLs
    imageCache.forEach(metadata => {
      URL.revokeObjectURL(metadata.localUrl);
    });
    
    setImageCache(new Map());
  }, [imageCache]);

  const invalidateImage = useCallback((id: string) => {
    setImageCache(prev => {
      const metadata = prev.get(id);
      if (metadata) {
        URL.revokeObjectURL(metadata.localUrl);
        const newCache = new Map(prev);
        newCache.delete(id);
        return newCache;
      }
      return prev;
    });
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      imageCache.forEach(metadata => {
        URL.revokeObjectURL(metadata.localUrl);
      });
    };
  }, [imageCache]);

  // Context value
  const value = useMemo((): ImageContextType => ({
    storeImage,
    getImage,
    getLocalUrl,
    getServerUrl,
    clearCache,
    invalidateImage,
  }), [
    storeImage,
    getImage,
    getLocalUrl,
    getServerUrl,
    clearCache,
    invalidateImage,
  ]);

  return (
    <ImageContext.Provider value={value}>
      {children}
    </ImageContext.Provider>
  );
};
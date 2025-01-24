// utils/imageHandling.ts

/**
 * Image Handling Utilities
 * Manages image upload, fetching, and caching operations
 */

interface ImageUploadResponse {
    id: string;
    url: string; // Server URL
  }
  
  interface ImageCacheEntry {
    file: File;
    localUrl: string;
    timestamp: number;
  }
  
  interface ImageCache {
    [url: string]: ImageCacheEntry;
  }
  
  // In-memory cache for image files
  const imageCache: ImageCache = {};
  
  /**
   * Uploads an image to the asset server.
   *
   * @param file - The image file to upload.
   * @returns The response containing the image URL.
   */
  export const uploadImage = async (file: File): Promise<ImageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
  
    const response = await fetch('/api/asset', {
      method: 'POST',
      body: formData,
    });
  
    if (!response.ok) {
      throw new Error('Failed to upload image');
    }
  
    return await response.json();
  };
  
  /**
   * Fetches an image from the asset server and converts it to a File object.
   *
   * @param url - The URL of the image to fetch.
   * @returns The fetched image as a File object.
   */
  export const fetchImageAsFile = async (url: string): Promise<File> => {
    // Check cache first
    const cached = imageCache[url];
    if (cached) {
      return cached.file;
    }
  
    // Fetch and cache if not found
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch image from URL');
    }
    const blob = await response.blob();
    const file = new File([blob], url.split('/').pop() || 'image', { type: blob.type });
    const localUrl = URL.createObjectURL(file);
  
    imageCache[url] = {
      file,
      localUrl,
      timestamp: Date.now(),
    };
  
    return file;
  };
  
  /**
   * Retrieves the local URL for a given server URL.
   *
   * @param url - The server URL of the image.
   * @returns The local URL if cached, otherwise fetches the image.
   */
  export const getLocalImageUrl = async (url: string): Promise<string> => {
    // Check cache first
    const cached = imageCache[url];
    if (cached) {
      return cached.localUrl;
    }
  
    // Fetch and cache if not found
    const file = await fetchImageAsFile(url);
    return imageCache[url].localUrl;
  };
  
  /**
   * Clears the image cache. Useful for testing or cache invalidation.
   */
  export const clearImageCache = () => {
    for (const key in imageCache) {
      URL.revokeObjectURL(imageCache[key].localUrl); // Revoke object URLs to free memory
      delete imageCache[key];
    }
  };
  
  /**
   * Implements a cache eviction strategy (e.g., Least Recently Used).
   * This example clears the cache every hour.
   */
  const oneHour = 60 * 60 * 1000;
  setInterval(() => {
    const now = Date.now();
    for (const url in imageCache) {
      if (now - imageCache[url].timestamp > oneHour) {
        URL.revokeObjectURL(imageCache[url].localUrl);
        delete imageCache[url];
      }
    }
  }, oneHour);
  
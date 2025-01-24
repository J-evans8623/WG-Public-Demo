/**
 * @file imageConversion.ts
 * @description Utilities for handling image conversion between File objects and base64 strings
 */

import { PictureResource } from '../Definitions/Definitions';

export interface ImageConversionResult {
  success: boolean;
  data?: string | File;
  error?: string;
}

/**
 * Converts a File object to a base64 string
 * @param file - The File object to convert
 * @returns Promise<ImageConversionResult>
 */
export const fileToBase64 = async (file: File): Promise<ImageConversionResult> => {
  try {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve({
            success: true,
            data: reader.result
          });
        } else {
          resolve({
            success: false,
            error: 'FileReader result is not a string'
          });
        }
      };

      reader.onerror = () => {
        resolve({
          success: false,
          error: 'Error reading file'
        });
      };

      reader.readAsDataURL(file);
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during file conversion'
    };
  }
};

/**
 * Converts a base64 string to a File object
 * @param base64String - The base64 string to convert
 * @param fileName - The name for the resulting file
 * @returns Promise<ImageConversionResult>
 */
export const base64ToFile = async (
  base64String: string,
  fileName: string
): Promise<ImageConversionResult> => {
  try {
    const res = await fetch(base64String);
    const blob = await res.blob();
    return {
      success: true,
      data: new File([blob], fileName, { type: blob.type })
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during base64 conversion'
    };
  }
};

/**
 * Validates and processes a PictureResource for synchronization
 * @param resource - The PictureResource to process
 * @returns Promise<ProcessedPictureResource>
 */
export const processResourceForSync = async (
  resource: PictureResource
): Promise<PictureResource> => {
  if (resource.image instanceof File) {
    const result = await fileToBase64(resource.image);
    if (result.success && typeof result.data === 'string') {
      return {
        ...resource,
        imageData: result.data,
      };
    }
    // If conversion fails, maintain original resource
    console.error('Failed to process resource for sync:', result.error);
    return resource;
  }
  return resource;
};

/**
 * Prepares a PictureResource for UI rendering
 * @param resource - The PictureResource to process
 * @returns Promise<ProcessedPictureResource>
 */
export const processResourceForUI = async (
  resource: PictureResource
): Promise<PictureResource> => {
  if (resource.imageData && !resource.image) {
    const result = await base64ToFile(
      resource.imageData,
      `image_${resource.id}`
    );
    if (result.success && result.data instanceof File) {
      return {
        ...resource,
        image: result.data
      };
    }
    // If conversion fails, maintain original resource
    console.error('Failed to process resource for UI:', result.error);
    return resource;
  }
  return resource;
};
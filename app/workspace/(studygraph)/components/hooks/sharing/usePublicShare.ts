/**
 * @file app/Library/hooks/usePublicShare.ts
 * @description
 *   React hook that encapsulates all public sharing functionality for the new access control-based
 *   sharing system. This hook replaces the deprecated token-based sharing system by managing
 *   document-level public access flags (publicView and publicEdit) instead of individual share
 *   tokens. It provides a clean interface for React components to configure document sharing
 *   settings, generate QR codes, create flyer PDFs, and manage editor lists. The hook integrates
 *   seamlessly with the existing access control infrastructure and supports both public sharing
 *   modes (anyone with link can view/edit) and private sharing with explicit editor lists.
 *   All operations use direct document URLs that work with the current Yjs collaboration system
 *   and access control layer, eliminating the complexity of token redemption workflows.
 * 
 * Responsibilities:
 *   - Manage loading and error states for sharing operations
 *   - Call the public share API with proper request formatting
 *   - Handle editor list management and validation
 *   - Provide functions for QR code and flyer generation
 *   - Return direct document URLs for immediate use
 *   - Log sharing activities for debugging purposes
 */

import { useState, useCallback } from 'react';

export type ShareMode = 'private' | 'public-view' | 'public-edit';
export type DeliveryMode = 'link' | 'flyer';

export interface PublicSharePayload {
  docId: string;
  mode: ShareMode;
  delivery?: DeliveryMode;
  editors?: string[];
}

export interface PublicShareResult {
  success: boolean;
  url: string;
  qrDataUri?: string;
  flyerUrl?: string;
  mode: ShareMode | "current";
  editorsCount?: number;
}

interface UsePublicShareReturn {
  isLoading: boolean;
  error: string | null;
  configureSharing: (payload: PublicSharePayload) => Promise<PublicShareResult>;
  fetchShareLink: (docId: string) => Promise<PublicShareResult>;
  downloadFlyer: (flyerUrl: string) => void;
  clearError: () => void;
}

/**
 * Hook for managing public document sharing through access control flags rather than tokens.
 * Provides functions to configure sharing modes, generate QR codes, create flyers, and manage
 * editor lists. Integrates with the new access control system to set publicView and publicEdit
 * flags on documents, enabling direct URL sharing without token redemption complexity.
 */
export function usePublicShare(): UsePublicShareReturn {
  console.log('usePublicShare.ts 4001 › Hook initialized');

  // Step 1: Initialize state management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Configures document sharing settings by calling the public share API and updating
   * access control flags. Handles all sharing modes including private, public-view,
   * and public-edit, along with editor list management for restricted access scenarios.
   */
  const configureSharing = useCallback(
    async (payload: PublicSharePayload): Promise<PublicShareResult> => {
      console.log('usePublicShare.ts 4002 › Configure sharing started', {
        docId: payload.docId,
        mode: payload.mode,
        delivery: payload.delivery,
        editorsCount: payload.editors?.length || 0
      });

      // Step 2: Reset error state and set loading
      setError(null);
      setIsLoading(true);

      try {
        // Step 3: Validate payload
        if (!payload.docId || !payload.mode) {
          throw new Error('Document ID and sharing mode are required');
        }

        // Step 4: Call public share API
        const response = await fetch('/api/document/public-share', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        console.log('usePublicShare.ts 4003 › API response received', {
          status: response.status,
          ok: response.ok
        });

        // Step 5: Handle API errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          const errorMessage = errorData.error || `Request failed with status ${response.status}`;
          console.error('usePublicShare.ts 4004 › API request failed', {
            status: response.status,
            error: errorMessage
          });
          throw new Error(errorMessage);
        }

        // Step 6: Parse and validate response
        const result = await response.json() as PublicShareResult;
        
        if (!result.success || !result.url) {
          console.error('usePublicShare.ts 4005 › Invalid API response', result);
          throw new Error('Invalid response from sharing API');
        }

        console.log('usePublicShare.ts 4006 › Sharing configured successfully', {
          docId: payload.docId,
          mode: result.mode,
          url: result.url,
          hasQr: !!result.qrDataUri,
          hasFlyer: !!result.flyerUrl,
          editorsCount: result.editorsCount
        });

        return result;

      } catch (error: any) {
        const errorMessage = error.message || 'Failed to configure sharing settings';
        console.error('usePublicShare.ts 4007 › Configure sharing failed', {
          error: errorMessage,
          docId: payload.docId
        });
        
        setError(errorMessage);
        throw error;

      } finally {
        setIsLoading(false);
      }
    },
    []
  );


  /**
   * update - 3: New method implementation
   * Fetches the current share link and QR code for a document without modifying its
   * access control settings. This allows non-owners (Invitees) to share the document.
   */
  const fetchShareLink = useCallback(async (docId: string): Promise<PublicShareResult> => {
    console.log('usePublicShare.ts 5001 › Fetch share link started', { docId });
    
    // Step 1: State setup
    setError(null);
    setIsLoading(true);

    try {
      // Step 2: Validate input
      if (!docId) throw new Error('Document ID is required');

      // Step 3: Call API with fetchOnly flag
      const response = await fetch('/api/document/public-share', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          docId, 
          fetchOnly: true // Explicitly request read-only access
        }),
      });

      // Step 4: Error handling
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to fetch share link');
      }
      
      // Step 5: Return result
      const result = await response.json() as PublicShareResult;
      console.log('usePublicShare.ts 5002 › Share link fetched successfully', { url: result.url });
      return result;

    } catch (err: any) {
      const msg = err.message || 'Failed to fetch link';
      console.error('usePublicShare.ts 5003 › Fetch share link failed', err);
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Downloads a flyer PDF by opening it in a new browser tab with proper security attributes.
   * Used when users request print-ready promotional materials with embedded QR codes.
   */
  const downloadFlyer = useCallback((flyerUrl: string) => {
    console.log('usePublicShare.ts 4008 › Flyer download initiated', { flyerUrl });
    
    try {
      window.open(flyerUrl, '_blank', 'noopener,noreferrer');
      console.log('usePublicShare.ts 4009 › Flyer download window opened');
    } catch (error) {
      console.error('usePublicShare.ts 4010 › Flyer download failed', error);
      setError('Failed to open flyer download');
    }
  }, []);

  /**
   * Clears the current error state to allow users to retry operations after addressing issues.
   */
  const clearError = useCallback(() => {
    console.log('usePublicShare.ts 4011 › Error state cleared');
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    configureSharing,
    downloadFlyer,
    fetchShareLink,
    clearError,
  };
}
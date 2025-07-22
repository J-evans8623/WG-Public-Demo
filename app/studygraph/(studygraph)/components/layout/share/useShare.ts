/**
 * @file useShare.ts
 * @responsibility
 *   • Encapsulate all Share API calls:
 *       – createShare: POST → /api/share (returns url, flyerUrl, qrDataUri)
 *   • Surface loading / error / result state for frontend consumption.
 *   • Log key events for observability (2101–2105).
 */

import { useState, useCallback } from 'react';

export interface SharePayload {
  resourceId: string;
  mode: 'copy' | 'collab';
  delivery: 'link' | 'email' | 'flyer';
  expiryDays?: number;
  emails?: string[];
  singleUse?: boolean;
}

export interface ShareResult {
  url: string;
  flyerUrl?: string;
  qrDataUri?: string;
}

export function useShare() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  /**
   * Create a new share token by calling POST /api/share
   */
  const createShare = useCallback(
    async (payload: SharePayload): Promise<ShareResult> => {
      console.log('useShare.ts 2101 ○ createShare start, payload=', payload);
      setError(null);
      setLoading(true);

      try {
        const res = await fetch('/api/share', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log('useShare.ts 2102 ○ API responded, status=', res.status);

        if (!res.ok) {
          const text = await res.text();
          console.error('useShare.ts 2103 ✖ createShare failed:', text || res.statusText);
          throw new Error(text || res.statusText);
        }

        const data = await res.json();
        console.log('useShare.ts 2104 ○ createShare success:', {
          url: data.url,
          flyerUrl: data.flyerUrl,
          qrDataUriLength: data.qrDataUri?.length,
        });

        return {
          url: data.url,
          flyerUrl: data.flyerUrl,
          qrDataUri: data.qrDataUri,
        };
      } catch (err: any) {
        console.error('useShare.ts 2105 ✖ createShare exception:', err);
        setError(err.message || 'Unknown error');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Trigger a flyer download by opening it in a new tab/window.
   */
  const downloadFlyer = useCallback((flyerUrl: string) => {
    console.log('useShare.ts 2106 ○ downloadFlyer:', flyerUrl);
    window.open(flyerUrl, '_blank', 'noopener');
  }, []);

  return {
    isLoading,
    error,
    createShare,
    downloadFlyer,
  };
}

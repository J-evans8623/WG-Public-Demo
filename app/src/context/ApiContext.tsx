/**
 * @file ApiContext.tsx (Enhanced with API Service Integration)
 * @description
 *   Enhanced API context provider that integrates with the centralized EnhancedApiService for
 *   consistent error handling and event-driven architecture while maintaining existing data
 *   management responsibilities. This updated context serves as the bridge between the enhanced
 *   API service layer and React components, providing seamless integration with the event system
 *   for API error handling without directly managing modal logic. The context maintains all
 *   existing account status functionality while adding support for centralized API error events
 *   and comprehensive request lifecycle management. The implementation preserves clean separation
 *   of concerns by handling data management and API integration without mixing UI presentation
 *   logic. Event subscription management ensures proper cleanup and memory management while
 *   supporting real-time account status updates based on API responses. The enhanced context
 *   provides debugging capabilities through structured logging and performance monitoring while
 *   maintaining backward compatibility with existing component usage patterns. Integration with
 *   the singleton API service ensures consistent behavior across all application components
 *   while enabling centralized error handling and modal triggering through the event system.
 *
 * Responsibilities:
 *   - Provide centralized account status management and API integration for React components
 *   - Subscribe to API error events from EnhancedApiService for error state management
 *   - Maintain existing account status functionality while adding enhanced API capabilities
 *   - Support request lifecycle management and cancellation for component unmounting
 *   - Enable debugging and monitoring through comprehensive logging and performance tracking
 *   - Preserve clean separation between data management and UI presentation logic
 *   - Provide backward compatibility with existing component usage patterns
 *
 * @author System  
 * @date Current
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { apiService, ApiErrorEvent, ApiResponse, ApiRequestConfig } from '../services/ApiService';
import { UserFileMetadata, UserFilesResponse } from '@/app/src/types/fileTypes';
import { insertDedupSorted, updateByIdSorted,
  removeById,
  resolveBucket, } from '@/app/studygraph/(studygraph)/components/utils/fileListOps';
import { getFileListCache, setFileListCache, clearFileListCache } from '@/app/studygraph/(studygraph)/services/fileListCache';
import { gradebookClient, AssignMetaPatchReq, AssignMetaPatchRes, AssignMetaUpsertReq, AssignMetaUpsertRes, GradebookQueryRes, AttemptStartReq, AttemptStartRes, AttemptSubmitReq, AttemptSubmitRes } from '@/app/studygraph/(studygraph)/services/gradebook/gradebookClient';


type AccessMode = 'edit' | 'readonly'; 
type AccessStatus = 'PENDING' | 'READY';


/**
 * Narrow context carrying `{mode,status,docId}` for consumers that need the snapshot object.
 * We intentionally do not co-mingle this with ApiContext to avoid global re-renders.
 */
//const AccessSnapshotContext = React.createContext<{ mode: AccessMode; status: AccessStatus; docId: string | null } | undefined>(undefined);


/**
 * Tiny boolean context for `editReady`. Keep this separate so a component that only needs the
 * boolean will not re-render when `mode` or `status` changes but `editReady` remains the same.
 */
//const EditReadyContext = React.createContext<boolean | undefined>(undefined);


interface AccountStatus {
  email:string,
  accountType: 'scholar' | 'educator';
  subscriptionTier: 'freemium' | 'premium';
  features: {
    canCreatePublicFiles: boolean;
    canInviteEditors: boolean;
    hasAdvancedFeatures: boolean;
  };
  limits: {
    maxCollaborators: number;
    maxDocuments: number;
    maxStorageGB: number;
  };
}

interface ApiContextType {
  // Step 2: Existing authentication and file operations
  signOut: () => Promise<void>;
  listFiles: (query?: string) => Promise<UserFilesResponse>;
  refreshList: () => Promise<void>; // 
  getWebSocketUrl: (documentId: string) => Promise<string>;
  deleteFile: (fileStorageId: string) => Promise<void>;
  
  addFileMeta: (meta: UserFileMetadata) => void;
  updateFileMeta: (fileId: string, patch: Partial<UserFileMetadata>) => void;
  removeFileMeta: (fileId: string) => void;

  // Step 3: New account status management
  accountStatus: AccountStatus | null;
  isAccountLoading: boolean;
  refreshAccountStatus: () => Promise<void>;
  hasFeature: (feature: keyof AccountStatus['features']) => boolean;
  canUpgrade: () => boolean;

  // Enhanced APi service integration
  error: string | null;
  apiError: ApiErrorEvent | null;
  clearApiError: () => void;
  isApiRequestActive: boolean;
  activeRequestCount: number;
  
  // Enhanced API methods with standardized error handling
  askAssistant: (question: string, textSelection: string, fileID: string, config?: ApiRequestConfig) => Promise<ApiResponse>;
  generateLesson: (file: File, docId: string, options?: { isPublic?: boolean }, config?: ApiRequestConfig) => Promise<ApiResponse>;
  exploreTopic: (userTopicRequest: string, exportData: any, fileID: string, textSelection?: string, config?: ApiRequestConfig) => Promise<ApiResponse>;
  createQuiz: (lessonId:string, quizTypes: string[], fileID: string,  questionCount?:number, exportData?: string, textSelection?: string, config?: ApiRequestConfig) => Promise<ApiResponse>;
  
  // Request management
  cancelRequest: (requestId: string) => boolean;
  cancelAllRequests: () => number;

 // Gradebook client surface (centralized networking for the new feature)
  assignMetaUpsert: (req: AssignMetaUpsertReq) => Promise<AssignMetaUpsertRes>;
  assignMetaPatch: (req: AssignMetaPatchReq) => Promise<AssignMetaPatchRes>;
  getGradebook: (docId: string) => Promise<GradebookQueryRes>;
  startAttempt: (req: AttemptStartReq) => Promise<AttemptStartRes>;
  submitAttempt: (req: AttemptSubmitReq) => Promise<AttemptSubmitRes>;
  userEmail: string;
}

// Step 4: Create context with comprehensive default values
const ApiContext = createContext<ApiContextType | undefined>(undefined);


export const useApiContext = (): ApiContextType => {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApiContext must be used within ResourceProvider');
  return ctx;
};

// Step 5: Hook for easy consumption of account status
export const useAccountStatus = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useAccountStatus must be used within ApiProvider');
  }
  return {
    accountStatus: context.accountStatus,
    isLoading: context.isAccountLoading,
    refresh: context.refreshAccountStatus,
    hasFeature: context.hasFeature,
    canUpgrade: context.canUpgrade,
  };
};

/**
 * @function useAccessSnapshot
 * @description
 *   Read the centralized document access snapshot `{ mode, status, docId }` owned by `ApiProvider`.
 *   This hook is intentionally narrow: it only triggers re-renders for callers that explicitly opt-in
 *   to reading access state. By living in a tiny dedicated context, it avoids invalidating unrelated
 *   `ApiContext` consumers when access changes. O(1) lookups; throws if used outside `ApiProvider`.

// update - 2006
export const useAccessSnapshot = () => {
  const v = React.useContext(AccessSnapshotContext);
  if (v === undefined) {
    throw new Error('useAccessSnapshot must be used within ApiProvider');
  }
  return v;
};
 */


/**
 * @function useEditReady
 * @description
 *   Read the `editReady` boolean derived by the centralized DAM subscription inside `ApiProvider`. This
 *   keeps leaf components simple and efficient: they can guard mutating handlers with a single boolean,
 *   without re-rendering on changes to `mode` or `status` when the boolean didn’t change. The context
 *   is minimal by design to limit fan-out churn. O(1) lookups; throws if used outside `ApiProvider`.

// update - 2007
export const useEditReady = () => {
  const v = React.useContext(EditReadyContext);
  if (v === undefined) {
    throw new Error('useEditReady must be used within ApiProvider');
  }
  return v;
};
 */

/**
 * @function useFileList
 * @description
 *   Returns the canonical file list from ApiContext with SWR-like flags. Consumers should treat
 *   these arrays as read-only and avoid mirroring state locally. The hook is O(1) and avoids
 *   re-renders beyond state changes in the provider. It also provides `refresh()` to force a
 *   foreground revalidation when a user action (like delete) requires it.
 */
export const useFileList = () => { // update - 1
  const ctx = useContext(ApiContext); // update - 2
  if (!ctx) throw new Error('useFileList must be used within ApiProvider'); // update - 3
  // Expose only the read model + flags + refresh; keep mutations centralized in ApiContext // update - 4
  return {
    ownedFiles: (ctx as any)._ownedFiles as UserFileMetadata[] || [], // update - 5
    sharedFiles: (ctx as any)._sharedFiles as UserFileMetadata[] || [], // update - 6
    isHydrated: (ctx as any)._isFileListHydrated as boolean, // update - 7
    isRefreshing: (ctx as any)._isFileListRefreshing as boolean, // update - 8
    lastUpdatedAt: (ctx as any)._fileListUpdatedAt as number | null, // update - 9
    lastError: (ctx as any)._fileListError as string | null, // update - 10
    refresh: ctx.refreshList, // update - 11
  };
};

/**
 * ApiProvider
 * @description
 *   Enhanced API context provider that integrates with the centralized EnhancedApiService while
 *   maintaining all existing account status functionality. This provider subscribes to API error
 *   events for centralized error state management and provides enhanced API methods with
 *   standardized error handling. The implementation ensures proper event cleanup, request
 *   lifecycle management, and backward compatibility with existing components.
 * @param children - React children components to receive context
 * @returns Enhanced API context provider with integrated error handling
 */
export const ApiProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { data: session, status } = useSession();
  const normalizedEmail = useMemo(
    () => (session?.user?.email ? session.user.email.trim().toLowerCase() : ''),
    [session?.user?.email]
  );
  
  const [error, setError] = useState<string | null>(null);
  
  // Step 7: New account status state management
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState<boolean>(true);

  // Step 8: Add new API service integration state
  const [apiError, setApiError] = useState<ApiErrorEvent | null>(null);
  const [isApiRequestActive, setIsApiRequestActive] = useState(false);
  const [activeRequestCount, setActiveRequestCount] = useState(0);
  // File list state and SWR flags (owned by provider; consumed via useFileList)
  const [fileList, setFileList] = useState<{
  ownedFiles: UserFileMetadata[];
  sharedFiles: UserFileMetadata[];
} | null>(null);

  const [isFileListLoading, setIsFileListLoading] = useState(false);
   const [isFileListRefreshing, setIsFileListRefreshing] = useState<boolean>(false); 
  const [isFileListHydrated, setIsFileListHydrated] = useState<boolean>(false); 
  const [fileListUpdatedAt, setFileListUpdatedAt] = useState<number | null>(null); 
  const [fileListError, setFileListError] = useState<string | null>(null); 

  // Step 9: Use refs for cleanup and event handling
  const mountedRef = useRef(true);
  const inflightListPromiseRef = useRef<Promise<UserFilesResponse> | null>(null);
  
  
  /* @function currentUserEmail
   * @description
   *   Returns the normalized session email (trimmed/lowercased). This is the single source
   *   of truth for cache keys and bucket resolution. Throws if session isn’t ready, as the
   *   app must enforce authentication before this provider mounts.
   */
  const currentUserEmail = useCallback((): string => {
    if (status === 'loading') {
      // Guard against premature calls; callers should wait for mount/session readiness.
      throw new Error('SESSION_LOADING');
    }
    if (!normalizedEmail) {
      console.error('[ApiContext.tsx][7001] Missing session email. Auth is required.');
      throw new Error('SESSION_REQUIRED');
    }
    return normalizedEmail;
  }, [normalizedEmail, status]);


  /**
   * handleApiError
   * @description
   *   Event handler for API error events from the EnhancedApiService. This method updates the
   *   context state with the latest API error information while providing comprehensive logging
   *   for debugging. The handler ensures that error state is properly managed and provides
   *   debugging information for error tracking and resolution.
   * @param event - Custom event containing API error details
   * @returns Promise resolving when error handling is complete
   */
  const handleApiError = useCallback(async (event: CustomEvent<ApiErrorEvent>) => {
    if (!mountedRef.current) return;

    const errorEvent = event.detail;
    console.log('[ApiContext.tsx][8002] Handling API error event', {
      type: errorEvent.type,
      service: errorEvent.service,
      requestId: errorEvent.requestId
    });

    setApiError(errorEvent);

    // Step 7: Update account status if error contains user status information
    if (errorEvent.userStatus) {
      setAccountStatus(prev => prev ? {
        ...prev,
        subscriptionTier: errorEvent.userStatus!.subscriptionTier as 'freemium' | 'premium',
        accountType: errorEvent.userStatus!.accountType as 'scholar' | 'educator'
      } : null);
    }
  }, []);


  /**
   * @function fetchAccountStatus
   * @description
   * Fetches current account status from the backend API and updates local state.
   * Implements error handling with graceful fallbacks to scholar/freemium defaults
   * to ensure UI functionality is maintained even during API failures. The function
   * includes comprehensive logging for debugging and observability purposes.
   */
  const fetchAccountStatus = useCallback(async (): Promise<void> => {

    

    console.log('[ApiContext.tsx][1001] Starting account status fetch');
    setIsAccountLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/account/status', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('[ApiContext.tsx][1002] Account status fetch failed:', response.status);
        throw new Error(`Account status fetch failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (mountedRef.current) {
        setAccountStatus(data);
        console.log('[ApiContext.tsx][8004] Account status refreshed successfully', {
          accountType: data.accountType,
          subscriptionTier: data.subscriptionTier
        });
      }

      console.log(' Debug : 8932 [ApiContext.tsx][1003] Account status received:', JSON.stringify(data));
      
    } catch (error) {

      if(mountedRef.current) {
      console.error('[ApiContext.tsx][1005] Account status fetch error:', error);
      
      // Step 8: Graceful fallback to safe defaults
      const fallbackStatus: AccountStatus = {
        email: normalizedEmail || 'unknown',
        accountType: 'scholar',
        subscriptionTier: 'freemium',
        features: {
          canCreatePublicFiles: false,
          canInviteEditors: false,
          hasAdvancedFeatures: false,
        },
        limits: {
          maxCollaborators: 3,
          maxDocuments: 5,
          maxStorageGB: 1,
        },
      };
      
      setAccountStatus(fallbackStatus);
      console.log('[ApiContext.tsx][1006] Applied fallback account status');
    }
    } finally {
      if (mountedRef.current) {
      setIsAccountLoading(false);
      }
    }
  }, [normalizedEmail]);


  /**
   * updateRequestActivityState
   * @description
   *   Updates the API request activity state by checking the current number of active requests
   *   from the EnhancedApiService. This method provides real-time visibility into request
   *   activity for loading states and debugging purposes while ensuring efficient polling
   *   and proper resource management for optimal performance.
   * @returns Promise resolving when activity state update is complete
   */
  const updateRequestActivityState = useCallback(() => {
    if (!mountedRef.current) return;

    const currentCount = apiService.getActiveRequestCount();
    setActiveRequestCount(currentCount);
    setIsApiRequestActive(currentCount > 0);
  }, []);



  /**
   * @function signOut
   * @description
   * Enhanced sign out function that clears both user session and account status.
   * Ensures complete state cleanup during logout operations to prevent stale
   * account data from persisting across sessions.
   */
  const signOut = async () => {
    console.log('[ApiContext.tsx][7008] Sign out initiated');
    try {
      
      const emailKey = normalizedEmail;
      if (emailKey) {
        clearFileListCache(emailKey);
      }
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setAccountStatus(null);
      // Clear file list state on sign out
      setFileList(null);
      setIsFileListHydrated(false);
      setFileListUpdatedAt(null);
      console.log('[ApiContext.tsx][7009] Sign out completed; cache cleared for user', emailKey);
    } catch (err) {
      console.error('[ApiContext.tsx][7010] Logout error', err);
    }
  };

  /**
   * @function fetchFilesFromServer
   * @description
   * Fetches user files from the backend API with proper type safety and error handling.
   * Returns UserFileMetadata objects with complete role information for access control.
   * Includes comprehensive logging for debugging file listing operations.
   */
  const fetchFilesFromServer = async (query?: string): Promise<UserFilesResponse> => {
    console.log('[ApiContext.tsx][1011] Fetching file lists');
    
    const url = new URL('/api/files/list', window.location.origin);
    if (query) url.searchParams.append('query', query);

    const res = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error('[ApiContext.tsx][1012] ListFiles failed:', res.statusText, text);
      throw new Error(`List files failed: ${res.statusText}`);
    }

    const data = await res.json() as UserFilesResponse;
    console.log('[ApiContext.tsx][1013] Files received - owned:', data.ownedFiles.length, 'shared:', data.sharedFiles.length);

    /**
     * @function mapToUserFileMetadata
     * @description
     * Converts raw API response data to properly typed UserFileMetadata objects.
     * Handles timestamp conversion from various formats and ensures all required
     * fields are present with appropriate defaults for missing data.
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
        colorCode: f.colorCode, 
        version: f.version,
        fileStoragePath: f.fileStoragePath || '',
        timestamp: f.timestamp || new Date().toISOString(),
        fileSize: f.fileSize || 0,
        contentType: f.contentType || 'application/octet-stream',
        editors: f.editors || [],
        sharedWith: f.sharedWith || [],
        publicEdit: f.publicEdit || false,
        publicView: f.publicView || false,
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
   * @function listFiles
   * @description
   *   Cached-first, background revalidation strategy:
   *   (1) Serve cached results immediately if present and mark as hydrated;
   *   (2) Always kick a single in-flight network revalidation that updates state and cache;
   *   (3) If no cache exists, await the first network call before resolving. This design
   *   guarantees Homescreen renders instantly when cache exists and still converges to the
   *   authoritative list. Cache/Sync ops are O(1); mapping/merge are O(N).
   */
  const listFiles = async (): Promise<UserFilesResponse> => { 
    const userKey = currentUserEmail(); 
    setFileListError(null); 

    // Step 1 — Try cache (read-through)
    const cached = getFileListCache(userKey);
    if (cached) {
      setFileList(cached);
      setIsFileListHydrated(true); 
      setFileListUpdatedAt(Date.now()); 


      // Step 2 — Kick background revalidation exactly once 
      if (!inflightListPromiseRef.current) {
        console.log('[ApiContext.tsx][7211] revalidate begin (bg)', { userKey }); 
        setIsFileListRefreshing(true); 
        inflightListPromiseRef.current = fetchFilesFromServer()
          .then((data) => {
            if (!mountedRef.current) return data;
            setFileList(data);
            setFileListUpdatedAt(Date.now());
            setFileListCache(userKey, data);
 
            return data;
          })
          .catch((err) => {
            console.error('[ApiContext.tsx][7298] revalidate failed (bg)', err);
            setFileListError(err?.message ?? 'File list refresh failed'); 
            return cached;
          })
          .finally(() => {
            inflightListPromiseRef.current = null; 
          });
      }

      // Return immediately with cached data 
      return Promise.resolve(cached);
    }

    console.log('[ApiContext.tsx][7202] listFiles cache miss → fallback to network', { userKey });
    // Step 3 — No cache, perform network path (write-through) and await once 
    setIsFileListLoading(true);
    setIsFileListRefreshing(true); 
    try {
      const promise = inflightListPromiseRef.current ?? fetchFilesFromServer(); 
      inflightListPromiseRef.current = promise; 
      const data = await promise; 
      if (!mountedRef.current) return data; 

      setFileList(data);
      setIsFileListHydrated(true); 
      setFileListUpdatedAt(Date.now()); 
      setFileListCache(userKey, data);
      return data;
    } catch (err:any) {
      setFileListError(err?.message ?? 'File list load failed'); 
      throw err;
    } finally {
      setIsFileListRefreshing(false);
      setIsFileListLoading(false);
      inflightListPromiseRef.current = null; 
    }
  };


const refreshFileList = async (): Promise<void> => {
    setIsFileListLoading(true);
    const userKey = currentUserEmail();
    setIsFileListRefreshing(true); 
    try {
      const data = await fetchFilesFromServer();
      setFileList(data);
      setFileListUpdatedAt(Date.now()); 
      // Write-through cache
      setFileListCache(userKey, data);
    } catch (e:any) {
      setFileListError(e?.message ?? 'File list refresh failed'); // update - 49
      console.warn('[ApiContext.tsx][7294] refreshList network failed; preserving current state', e);
      // Optional: fallback to cached data if state is empty and cache exists
      if (!fileList) {
        const cached = getFileListCache(userKey);
        if (cached) {
          setFileList(cached);
          setIsFileListHydrated(true); // update - 50
        }
      }
    } finally {
      setIsFileListRefreshing(false); // update - 51
      setIsFileListLoading(false);
    }
  };

/**
   * applyAndSync
   * Responsibility:
   *   Apply a pure transformation to the local fileList (race-safe via functional setState),
   *   then synchronize the combined list with  exactly once. This version
   *   also performs a write-through to the user-scoped file list cache so that local UI changes
   *   remain coherent after navigation and across brief offline windows. Time complexity is O(N)
   *   where N is the number of files touched in a single pass; cache I/O is O(1).
   */
  const applyAndSync = useCallback((
    transform: (prev: { ownedFiles: UserFileMetadata[]; sharedFiles: UserFileMetadata[] } | null) =>
      { ownedFiles: UserFileMetadata[]; sharedFiles: UserFileMetadata[] }
  ) => {
    setFileList(prev => {
      const next = transform(prev);

      // Write-through cache with the new state after transformation
      try {
        const userKey = currentUserEmail();
        setFileListCache(userKey, next);
        setFileListUpdatedAt(Date.now()); 
        setIsFileListHydrated(true); 
        console.log('[ApiContext.tsx][7207] applyAndSync → cache stored', { userKey });
      } catch (e) {
        console.warn('[ApiContext.tsx][7297] applyAndSync cache store failed (non-fatal)', e);
      }
      return next;
    });
  }, [currentUserEmail]);

  /**
   * 
   * @function addFileMeta
   * @description
   *   Synchronously insert/replace a file metadata record in the local cache only (no network).
   *   Decides bucket (owned/shared), de-duplicates by fileId across both buckets, normalizes
   *   updatedAt, and maintains descending order. Calls syncFileList to keep access parity.
   */
  const addFileMeta = useCallback((meta: UserFileMetadata): void => {
    const email = currentUserEmail();
    applyAndSync(prev => {
      const materialized = prev ?? { ownedFiles: [], sharedFiles: [] };
      const next = insertDedupSorted(
        { owned: materialized.ownedFiles, shared: materialized.sharedFiles },
        meta,
        email
      );
      console.log('ApiContext.tsx 4118 › [] addFileMeta', {
        fileId: meta.fileId,
        bucket: resolveBucket(meta, email),
      });
      return { ownedFiles: next.owned, sharedFiles: next.shared };
    });
  }, [applyAndSync, currentUserEmail]);

  /**
   * 
   * @function updateFileMeta
   * @description
   *   Synchronously patch a file metadata record in the local cache (no network). If the role or
   *   ownerId change triggers a bucket flip, this function moves the entry across buckets safely.
   *   Re-sorts the affected bucket after patch.
   */
  const updateFileMeta = useCallback((fileId: string, patch: Partial<UserFileMetadata>): void => {
    const email = currentUserEmail();
    applyAndSync(prev => {
      const materialized = prev ?? { ownedFiles: [], sharedFiles: [] };
      const next = updateByIdSorted(
        { owned: materialized.ownedFiles, shared: materialized.sharedFiles },
        fileId,
        patch,
        email
      );
      console.log('ApiContext.tsx 4119 › [] updateFileMeta', { fileId, patchKeys: Object.keys(patch || {}) });
      return { ownedFiles: next.owned, sharedFiles: next.shared };
    });
  }, [applyAndSync, currentUserEmail]);

  /**
   * 
   * @function removeFileMeta
   * @description
   *   Removes a file metadata record from whichever bucket contains it. Purely local cache
   *   hygiene with no network calls. After removal, syncs access list for parity.
   */
  const removeFileMeta = useCallback((fileId: string): void => {
    applyAndSync(prev => {
      const materialized = prev ?? { ownedFiles: [], sharedFiles: [] };
      const next = removeById(
        { owned: materialized.ownedFiles, shared: materialized.sharedFiles },
        fileId
      );
      console.log('ApiContext.tsx 4120 › [] removeFileMeta', { fileId, removed: next.removed });
      return { ownedFiles: next.owned, sharedFiles: next.shared };
    });
  }, [applyAndSync]);
  
  /**
   * @function getWebSocketUrl
   * @description
   * Generates WebSocket URLs with authentication tokens for real-time collaboration.
   * Includes retry logic with exponential backoff to handle temporary network issues.
   * Essential for maintaining stable collaboration connections in production environments.
   */
  const getWebSocketUrl = async (documentId: string): Promise<string> => {
    console.log('[ApiContext.tsx][1014] Generating WebSocket URL for document:', documentId);
    
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
          
          console.log('[ApiContext.tsx][1015] WebSocket URL generated successfully');
          return wsUrl.toString();
        } catch (error) {
          lastError = error as Error;
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.log('[ApiContext.tsx][1016] WebSocket URL generation retry:', retryCount, 'delay:', delay);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      throw lastError || new Error('Failed to get WebSocket URL after retries');
    } catch (error) {
      console.error('[ApiContext.tsx][1017] WebSocket URL generation failed:', error);
      throw error;
    }
  };

  /**
   * @function deleteFile
   * @description
   * Deletes files from Firebase storage through the secure BFF endpoint.
   * Provides comprehensive error handling and logging for file deletion operations.
   * Ensures proper cleanup of file resources while maintaining security through
   * backend validation of deletion permissions.
   */
  const deleteFile = async (fileStorageId: string): Promise<void> => {
    console.log('[ApiContext.tsx][1018] Deleting file:', fileStorageId);
    
    try {
      const url = new URL('/api/document/delete', window.location.origin);
      url.searchParams.append('fileStorageId', fileStorageId);
      
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ApiContext.tsx][1019] Delete file failed:', response.statusText, errorText);
        throw new Error(`Delete file failed: ${response.statusText}`);
      }

      const current = fileList;
      let removedId: string | null = null;
      if (current) {
        const hit =
          current.ownedFiles.find(f => f.fileStoragePath === fileStorageId) ??
          current.sharedFiles.find(f => f.fileStoragePath === fileStorageId);
        if (hit) {
          removedId = hit.fileId;
          removeFileMeta(hit.fileId);
        }
      }
       await refreshFileList();

      
      console.log('[ApiContext.tsx][1020] File deleted successfully:', fileStorageId);
    } catch (error) {
      console.error('[ApiContext.tsx][1021] Error deleting file:', error);
      throw error;
    }
  };

  /**
   * @function hasFeature
   * @description
   * Utility function to check if the current account has a specific feature enabled.
   * Provides safe feature checking with fallback to false for missing account status.
   * Used throughout the application for conditional feature rendering and access control.
   */
  const hasFeature = useCallback((feature: keyof AccountStatus['features']): boolean => {
    if (!accountStatus) return false;
    return accountStatus.features[feature];
  }, [accountStatus]);

  /**
   * @function canUpgrade
   * @description
   * Determines if the current account is eligible for subscription upgrades.
   * Used to conditionally display upgrade prompts and premium feature teasers
   * throughout the application interface.
   */
  const canUpgrade = useCallback((): boolean => {
    if (!accountStatus) return true;
    return accountStatus.subscriptionTier === 'freemium';
  }, [accountStatus]);


  const clearApiError = useCallback(() => {
    setApiError(null);
  }, []);


  // Step 9: Enhanced API methods with standardized error handling
  const askAssistant = useCallback(async (
    question: string,
    textSelection: string,
    fileID: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse> => {
    console.log('[ApiContext.tsx][8006] Processing ask assistant request through enhanced API service');
    updateRequestActivityState();
    
    try {
      const response = await apiService.askAssistant(question, textSelection, fileID, config);
      return response;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);

  const generateLesson = useCallback(async (
    file: File,
    docId: string,
    options: { isPublic?: boolean } = {},
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse> => {
    console.log('[ApiContext.tsx][8007] Processing lesson generation request through enhanced API service');
    updateRequestActivityState();
    
    try {
      const response = await apiService.generateLesson(file, docId, options, config);
      return response;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);

  const exploreTopic = useCallback(async (
    userTopicRequest: string,
    exportData: any,
    fileID: string,
    textSelection?: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse> => {
    console.log('[ApiContext.tsx][8008] Processing topic exploration request through enhanced API service');
    updateRequestActivityState();
    
    try {
      const response = await apiService.exploreTopic(userTopicRequest, exportData, fileID, textSelection, config);
      return response;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);

  const createQuiz = useCallback(
    async (
      lessonId: string,                  // concept map id (replaces topicIds)
      quizTypes: string[],               // array, first type honored server-side
      fileID: string,                    // document/file id
      questionCount?: number,            // optional: preferred number of questions
      exportData?: string,               // optional: full text export
      textSelection?: string,            // optional: focused selection
      config: ApiRequestConfig = {}
    ): Promise<ApiResponse> => {
      console.log('[ApiContext.tsx][8809] createQuiz begin', {
        lessonId,
        fileID,
        quizTypes,
        questionCount: questionCount ?? null,
        hasExportData: typeof exportData === 'string' && exportData.length > 0,
        hasTextSelection: typeof textSelection === 'string' && textSelection.length > 0,
      });

      updateRequestActivityState();

      try {
        // Shape params for the new EnhancedApiService signature
        const response = await apiService.createQuiz(
          {
            lessonId,          // mapped to topicIds internally by the service
            quizTypes,
            fileID,
            questionCount,
            exportData,
            textSelection,
          },
          config
        );
        return response;
      } finally {
        updateRequestActivityState();
      }
    },
    [updateRequestActivityState]
  );


  const cancelRequest = useCallback((requestId: string): boolean => {
    const result = apiService.cancelRequest(requestId);
    updateRequestActivityState();
    return result;
  }, [updateRequestActivityState]);

  const cancelAllRequests = useCallback((): number => {
    const result = apiService.cancelAllRequests();
    updateRequestActivityState();
    return result;
  }, [updateRequestActivityState]);



  // Gradebook wrappers (centralize logging + request activity state)
  const assignMetaUpsert = useCallback(async (req: AssignMetaUpsertReq): Promise<AssignMetaUpsertRes> => {
    console.log('[ApiContext.tsx][6701] assignMetaUpsert begin', { docId: req.docId, assignmentId: req.assignmentId });
    updateRequestActivityState();
    try {
      const res = await gradebookClient.assignMetaUpsert(req);
      return res;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);

  const assignMetaPatch = useCallback(async (req: AssignMetaPatchReq): Promise<AssignMetaPatchRes> => {
    console.log('[ApiContext.tsx][6702] assignMetaPatch begin', { docId: req.docId, assignmentId: req.assignmentId });
    updateRequestActivityState();
    try {
      const res = await gradebookClient.assignMetaPatch(req);
      return res;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);

  const getGradebook = useCallback(async (docId: string): Promise<GradebookQueryRes> => {
    console.log('[ApiContext.tsx][6703] getGradebook begin', { docId });
    updateRequestActivityState();
    try {
      const res = await gradebookClient.getGradebook(docId);
      return res;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);

  const startAttempt = useCallback(async (req: AttemptStartReq): Promise<AttemptStartRes> => {
    console.log('[ApiContext.tsx][6704] startAttempt begin', { docId: req.docId, assignmentId: req.assignmentId });
    updateRequestActivityState();
    try {
      const res = await gradebookClient.startAttempt(req);
      return res;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);

  const submitAttempt = useCallback(async (req: AttemptSubmitReq): Promise<AttemptSubmitRes> => {
    console.log('[ApiContext.tsx][6705] submitAttempt begin', { docId: req.docId, attemptId: req.attemptId });
    updateRequestActivityState();
    try {
      const res = await gradebookClient.submitAttempt(req);
      return res;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);



    // Step 9: Auto-fetch account status on mount
useEffect(() => {
  if (status === 'loading') return; // wait until session resolves
    if (status !== 'authenticated' || !normalizedEmail) {
      console.error('[ApiContext.tsx][7020] ApiProvider mounted without authenticated session');
      setIsAccountLoading(false);
      return;
    }
    
  const ac = new AbortController();
  setIsAccountLoading(true);

  (async () => {
    try {
      const res = await fetch('/api/account/status', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setAccountStatus(data); // safe: only runs if not aborted
    } catch (e) {
      if ((e as any)?.name === 'AbortError') return; // expected on cleanup/supersede
      // apply fallback / log real error here
    } finally {
      setIsAccountLoading(false);
    }
  })();

  return () => ac.abort(); // cancels on unmount or effect re-run
}, [normalizedEmail, status]); // deps as needed



useEffect(() => { // update - 57
    if (status !== 'authenticated' || !normalizedEmail) return;
    // Call listFiles which will hydrate from cache and revalidate in background 
    listFiles().catch((e) => {
      console.warn('[ApiContext.tsx][7299] initial listFiles failed', e); 
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, normalizedEmail]);


  // Step 10: Expose comprehensive API context value
  const contextValue: ApiContextType = {
    signOut,
    listFiles,
    refreshList: refreshFileList,
    getWebSocketUrl,
    deleteFile,
    accountStatus,
    isAccountLoading,
    refreshAccountStatus: fetchAccountStatus,
    hasFeature,
    canUpgrade,
    apiError,
    clearApiError,
    isApiRequestActive,
    activeRequestCount,

    // Enhanced API methods
    askAssistant,
    generateLesson,
    exploreTopic,
    createQuiz,

    // Request management
    cancelRequest,
    cancelAllRequests,
    error,
    addFileMeta,        
    updateFileMeta,    
    removeFileMeta,   
    
    // Gradebook methods (now available app-wide)
    assignMetaUpsert,
    assignMetaPatch,
    getGradebook,
    startAttempt,
    submitAttempt,
    userEmail: normalizedEmail
  };

  // Expose read-only file list state to useFileList via non-API properties (internal surface) 
  return (

        <ApiContext.Provider value={Object.assign(contextValue, { 
      _ownedFiles: fileList?.ownedFiles ?? [],
      _sharedFiles: fileList?.sharedFiles ?? [], 
      _isFileListHydrated: isFileListHydrated,
      _isFileListRefreshing: isFileListRefreshing,
      _fileListUpdatedAt: fileListUpdatedAt,
      _fileListError: fileListError,
    })}>

      {children}
    </ApiContext.Provider>

  );
};

export default ApiProvider;
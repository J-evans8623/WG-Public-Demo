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

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { apiService, ApiErrorEvent, ApiResponse, ApiRequestConfig } from '../services/ApiService';
import { UserFileMetadata, UserFilesResponse } from '@/app/src/types/fileTypes';

// Step 1: Define enhanced interfaces for account management
interface User {
  email: string;
  accountType: 'free' | 'premium';
}

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
  getWebSocketUrl: (documentId: string) => Promise<string>;
  deleteFile: (fileStorageId: string) => Promise<void>;
  
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
  createQuiz: (topicIds: string[], quizTypes: string[], fileID: string, exportData: string, textSelection?: string, config?: ApiRequestConfig) => Promise<ApiResponse>;
  
  // Request management
  cancelRequest: (requestId: string) => boolean;
  cancelAllRequests: () => number;
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
  // Step 6: Traditional state management
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Step 7: New account status state management
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [isAccountLoading, setIsAccountLoading] = useState<boolean>(true);

  // Step 8: Add new API service integration state
  const [apiError, setApiError] = useState<ApiErrorEvent | null>(null);
  const [isApiRequestActive, setIsApiRequestActive] = useState(false);
  const [activeRequestCount, setActiveRequestCount] = useState(0);

  // Step 9: Use refs for cleanup and event handling
  const mountedRef = useRef(true);
  const requestCountIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

    if (!mountedRef.current) return;

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
        email: 'unknown',
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
  }, []);


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
    console.log('[ApiContext.tsx][1008] Sign out initiated');
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      setIsGuest(false);
      setAccountStatus(null);
      console.log('[ApiContext.tsx][1009] Sign out completed, state cleared');
    } catch (error) {
      console.error('[ApiContext.tsx][1010] Logout error:', error);
    }
  };

  /**
   * @function listFiles
   * @description
   * Fetches user files from the backend API with proper type safety and error handling.
   * Returns UserFileMetadata objects with complete role information for access control.
   * Includes comprehensive logging for debugging file listing operations.
   */
  const listFiles = async (query?: string): Promise<UserFilesResponse> => {
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

  const createQuiz = useCallback(async (
    topicIds: string[],
    quizTypes: string[],
    fileID: string,
    exportData: string,
    textSelection?: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse> => {
    console.log('[ApiContext.tsx][8009] Processing quiz creation request through enhanced API service');
    updateRequestActivityState();
    
    try {
      const response = await apiService.createQuiz(topicIds, quizTypes, fileID, exportData, textSelection, config);
      return response;
    } finally {
      updateRequestActivityState();
    }
  }, [updateRequestActivityState]);

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


    // Step 9: Auto-fetch account status on mount
  useEffect(() => {
    console.log('[ApiContext.tsx][1007] ApiProvider mounted, fetching account status');
    fetchAccountStatus();// Subscribe to API error events
    const errorHandler: EventListener = (e: Event) => {
    const ce = e as CustomEvent<ApiErrorEvent>;
    if (!('detail' in ce)) {
      console.warn('[ApiContext.tsx][8012] api-error received without CustomEvent detail');
      return;
    }
    // Ignore returned promise to satisfy void listener contract
    void handleApiError(ce);
  };
    apiService.addEventListener('api-error', errorHandler);

    // Set up request count polling for real-time activity monitoring
    requestCountIntervalRef.current = setInterval(updateRequestActivityState, 1000);

    // Cleanup function
    return () => {
      console.log('[ApiContext.tsx][8011] Cleaning up enhanced API context subscriptions');
      mountedRef.current = false;
      
      // Remove event listeners
      apiService.removeEventListener('api-error', errorHandler);
      
      // Clear polling interval
      if (requestCountIntervalRef.current) {
        clearInterval(requestCountIntervalRef.current);
      }
      
      // Cancel any active requests
      apiService.cancelAllRequests();
    };
  }, [fetchAccountStatus, handleApiError, updateRequestActivityState]);

  // Step 10: Expose comprehensive API context value
  const contextValue: ApiContextType = {
    signOut,
    listFiles,
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
    error
  };

  return (
    <ApiContext.Provider value={contextValue}>
      {children}
    </ApiContext.Provider>
  );
};

export default ApiProvider;
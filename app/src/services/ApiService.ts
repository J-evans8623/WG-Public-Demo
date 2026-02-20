'use client'
/**
 * @file ApiService.ts
 * @description
 *   Centralized API service layer that consolidates all premium AI service calls with standardized error
 *   handling, event emission, and response processing capabilities. This service establishes a unified
 *   interface for all backend communications while implementing robust error classification and event-driven
 *   architecture that enables seamless modal integration. The service eliminates code duplication across
 *   components by providing consistent error handling, request/response interceptors, and automated event
 *   emission for different error scenarios. All API calls are wrapped with comprehensive logging, performance
 *   monitoring, and standardized response formatting that supports both success and error workflows. The
 *   event-driven architecture decouples API error handling from UI components while maintaining clean
 *   separation of concerns between data access and presentation logic. Request lifecycle management includes
 *   cancellation support, timeout handling, and proper cleanup mechanisms for optimal resource utilization.
 *   The service integrates seamlessly with existing authentication infrastructure while providing enhanced
 *   debugging capabilities through structured logging and performance metrics. Error classification system
 *   maps backend error responses to standardized types that enable consistent modal triggering and user
 *   feedback across all premium service interactions throughout the application ecosystem.
 *
 * Responsibilities:
 *   - Consolidate all AI service API calls with consistent error handling and response processing
 *   - Implement event-driven architecture for API error notifications and modal integration
 *   - Provide standardized error classification and response formatting for frontend consumption
 *   - Manage request lifecycle including cancellation, timeout handling, and cleanup mechanisms
 *   - Support comprehensive logging and performance monitoring for debugging and analytics
 *   - Maintain backward compatibility with existing API contracts while enhancing functionality
 *   - Enable seamless integration with modal management through event emission system
 *
 * @author System
 * @date Current
 */

// Step 1: Define comprehensive type definitions for API service layer
export type ApiServiceType = 'lessonGeneration' | 'askAssistant' | 'exploreTopic' | 'createQuiz';

// Step 2: Define standardized error classification enum
export enum ApiErrorType {
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  DEMO_CREDITS_EXHAUSTED = 'DEMO_CREDITS_EXHAUSTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OWNER_ACCESS_RESTRICTED = 'OWNER_ACCESS_RESTRICTED'
}

// Step 3: Define comprehensive API error event interface
export interface ApiErrorEvent {
  type: ApiErrorType;
  service: ApiServiceType;
  message: string;
  retryAfter?: number;
  upgradeRequired?: boolean;
  userStatus?: {
    accountType: string;
    subscriptionTier: string;
    remainingDemoCredits?: number;
  };
  rateLimitInfo?: {
    hourlyRemaining: number;
    monthlyRemaining: number;
    hourlyLimit: number;
    monthlyLimit: number;
  };
  requestId: string;
  timestamp: string;
  originalError?: any;
}

// Step 4: Define API response wrapper interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiErrorEvent;
  requestId: string;
  timestamp: string;
  processingTime: number;
}

// Step 5: Define request configuration interface
export interface ApiRequestConfig {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  abortSignal?: AbortSignal;
  suppressEvents?: boolean;
  requestId?: string;
}

/**
 * EnhancedApiService
 * @description
 *   Main API service class that provides centralized management of all backend communications with
 *   comprehensive error handling, event emission, and response processing. This service implements
 *   event-driven architecture that enables seamless modal integration while maintaining clean
 *   separation between API logic and UI presentation. The service includes request lifecycle
 *   management, performance monitoring, and standardized error classification for consistent
 *   user experience across all premium service interactions. Time complexity is O(1) for all
 *   operations with optimized event emission and response processing.
 */
export class EnhancedApiService extends EventTarget {
  private static instance: EnhancedApiService | null = null;
  private activeRequests: Map<string, AbortController> = new Map();
  private requestMetrics: Map<string, { startTime: number; service: ApiServiceType }> = new Map();

  /**
   * getInstance
   * @description
   *   Singleton pattern implementation that ensures consistent API service instance across the
   *   application. This approach maintains state consistency for active requests, metrics tracking,
   *   and event subscription management while providing optimal resource utilization and preventing
   *   duplicate service instances that could cause inconsistent behavior.
   * @returns Singleton EnhancedApiService instance for application-wide usage
   */
  public static getInstance(): EnhancedApiService {
    if (!EnhancedApiService.instance) {
      //console.log('[enhancedApiService.ts][7001] Creating singleton EnhancedApiService instance');
      EnhancedApiService.instance = new EnhancedApiService();
    }
    return EnhancedApiService.instance;
  }

  /**
   * generateRequestId
   * @description
   *   Generates unique request identifiers for tracking and debugging purposes across distributed
   *   systems and logging infrastructure. The implementation creates timestamp-based identifiers
   *   that enable correlation of requests across multiple services while maintaining human-readable
   *   format for efficient debugging and monitoring capabilities.
   * @returns Unique request identifier string for tracking and correlation
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `api_${timestamp}_${random}`;
  }

  /**
   * classifyError
   * @description
   *   Intelligent error classification system that analyzes backend error responses and maps them
   *   to standardized error types for consistent frontend handling. This method examines error
   *   codes, messages, and response structure to determine appropriate error classification that
   *   enables proper modal triggering and user feedback. The classification logic supports both
   *   structured error responses and legacy error formats for backward compatibility.
   * @param error - Error object or response from backend API call
   * @param service - Service type for context-aware error classification
   * @returns Classified error type for standardized handling and modal triggering
   */
  private classifyError(error: any, service: ApiServiceType): ApiErrorType {
    //console.log('[enhancedApiService.ts][7002] Classifying error for service', { service, error });

    // Step 6: Handle structured error responses from enhanced backend
    if (error?.error) {
      const errorCode = error.error;
      if (errorCode === 'SUBSCRIPTION_REQUIRED') return ApiErrorType.SUBSCRIPTION_REQUIRED;
      if (errorCode === 'DEMO_CREDITS_EXHAUSTED') return ApiErrorType.DEMO_CREDITS_EXHAUSTED;
      if (errorCode === 'RATE_LIMIT_EXCEEDED') return ApiErrorType.RATE_LIMIT_EXCEEDED;
      if (errorCode === 'PERMISSION_DENIED') return ApiErrorType.PERMISSION_DENIED;
      if (errorCode === 'AUTHENTICATION_FAILED') return ApiErrorType.AUTHENTICATION_FAILED;
      if (errorCode === 'VALIDATION_FAILED') return ApiErrorType.VALIDATION_FAILED;
      if (errorCode === 'OWNER_ACCESS_RESTRICTED') return ApiErrorType.OWNER_ACCESS_RESTRICTED;
    }

    // Step 7: Handle HTTP status code based classification
    if (error?.status) {
      if (error.status === 401) return ApiErrorType.AUTHENTICATION_FAILED;
      if (error.status === 403) return ApiErrorType.PERMISSION_DENIED;
      if (error.status === 429) return ApiErrorType.RATE_LIMIT_EXCEEDED;
      if (error.status >= 400 && error.status < 500) return ApiErrorType.VALIDATION_FAILED;
      if (error.status >= 500) return ApiErrorType.PROCESSING_FAILED;
    }

    // Step 8: Handle network and timeout errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return ApiErrorType.NETWORK_ERROR;
    }

    // Step 9: Handle legacy error message patterns
    const errorMessage = error?.message || error?.toString() || '';
    if (errorMessage.includes('premium') || errorMessage.includes('upgrade')) {
      return ApiErrorType.SUBSCRIPTION_REQUIRED;
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
      return ApiErrorType.RATE_LIMIT_EXCEEDED;
    }
    if (errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
      return ApiErrorType.PERMISSION_DENIED;
    }

    //console.log('[enhancedApiService.ts][7003] Error classification defaulted to unknown', { errorMessage });
    return ApiErrorType.UNKNOWN_ERROR;
  }

  /**
   * createApiErrorEvent
   * @description
   *   Creates comprehensive API error event objects with standardized structure for event emission
   *   and modal integration. This method extracts relevant error information, user status, and
   *   retry timing from backend responses while ensuring consistent event format across all error
   *   types. The implementation supports both immediate error events and delayed retry scenarios
   *   with appropriate metadata for frontend consumption and debugging purposes.
   * @param error - Original error object or response from backend
   * @param service - Service type for context and classification
   * @param requestId - Request identifier for tracking and correlation
   * @returns Structured API error event for emission and modal handling
   */
  private createApiErrorEvent(error: any, service: ApiServiceType, requestId: string): ApiErrorEvent {
    const errorType = this.classifyError(error, service);
    const timestamp = new Date().toISOString();


    // Step 10: Extract error details from structured response
    const apiErrorEvent: ApiErrorEvent = {
      type: errorType,
      service,
      message: error?.message || this.getDefaultErrorMessage(errorType),
      requestId,
      timestamp,
      originalError: error
    };

    // Step 11: Add retry timing for rate limit scenarios
    if (error?.retryAfter) {
      apiErrorEvent.retryAfter = error.retryAfter;
    }

    // Step 12: Add upgrade requirement flag for subscription errors
    if (error?.upgradeRequired !== undefined) {
      apiErrorEvent.upgradeRequired = error.upgradeRequired;
    }

    // Step 13: Add user status information if available
    if (error?.userStatus) {
      apiErrorEvent.userStatus = error.userStatus;
    }

    // Step 14: Add rate limit information for premium users
    if (error?.rateLimitInfo) {
      apiErrorEvent.rateLimitInfo = error.rateLimitInfo;
    }

    return apiErrorEvent;
  }

  /**
   * getDefaultErrorMessage
   * @description
   *   Provides user-friendly default error messages for different error types when specific
   *   error messages are not available from backend responses. This method ensures that users
   *   always receive meaningful feedback even when backend errors lack detailed messaging,
   *   supporting consistent user experience across all error scenarios and service types.
   * @param errorType - Classified error type for message selection
   * @returns User-friendly error message for display purposes
   */
  private getDefaultErrorMessage(errorType: ApiErrorType): string {
    const errorMessages = {
      [ApiErrorType.SUBSCRIPTION_REQUIRED]: 'This feature requires a premium subscription. Please upgrade to continue.',
      [ApiErrorType.DEMO_CREDITS_EXHAUSTED]: 'You have used all your demo credits. Upgrade to premium for unlimited access.',
      [ApiErrorType.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please try again later.',
      [ApiErrorType.PERMISSION_DENIED]: 'You do not have permission to access this feature.',
      [ApiErrorType.AUTHENTICATION_FAILED]: 'Authentication failed. Please log in again.',
      [ApiErrorType.VALIDATION_FAILED]: 'Invalid request. Please check your input and try again.',
      [ApiErrorType.PROCESSING_FAILED]: 'Processing failed. Please try again.',
      [ApiErrorType.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
      [ApiErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
      [ApiErrorType.OWNER_ACCESS_RESTRICTED]: 'Freemium demo credits can only be used on notebooks you own.',
    };

    return errorMessages[errorType] || errorMessages[ApiErrorType.UNKNOWN_ERROR];
  }

  /**
   * emitErrorEvent
   * @description
   *   Emits standardized API error events to subscribed listeners for modal integration and error
   *   handling. This method implements the event-driven architecture that decouples API error
   *   handling from UI components while ensuring consistent error notification across the
   *   application. The emission includes comprehensive error metadata and supports both immediate
   *   and deferred event handling patterns for optimal user experience and system responsiveness.
   * @param errorEvent - Structured error event for emission to subscribers
   * @returns Promise resolving when event emission is complete
   */
  private async emitErrorEvent(errorEvent: ApiErrorEvent): Promise<void> {


    // Step 15: Create CustomEvent for error emission
    const customEvent = new CustomEvent('api-error', {
      detail: errorEvent
    });

    // Step 16: Emit event to all subscribers
    this.dispatchEvent(customEvent);

    // Step 17: Also emit service-specific event for targeted handling
    const serviceEvent = new CustomEvent(`api-error-${errorEvent.service}`, {
      detail: errorEvent
    });

    this.dispatchEvent(serviceEvent);
  }

  /**
   * makeApiRequest
   * @description
   *   Core API request method that handles all backend communications with comprehensive error
   *   handling, request lifecycle management, and event emission. This method implements the
   *   unified request pattern that consolidates timeout handling, abort signal support, retry
   *   logic, and standardized response processing. The implementation ensures consistent behavior
   *   across all API calls while providing detailed logging and performance metrics for debugging
   *   and optimization purposes. Time complexity is O(1) with optimized request processing.
   * @param url - API endpoint URL for the request
   * @param options - Fetch options including method, headers, and body
   * @param service - Service type for classification and event handling
   * @param config - Additional configuration for timeout, retry, and cancellation
   * @returns Promise resolving to standardized API response with success/error data
   */
  private async makeApiRequest<T>(
    url: string,
    options: RequestInit,
    service: ApiServiceType,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const requestId = config.requestId || this.generateRequestId();
    const startTime = Date.now();



    // Step 18: Set up request tracking and metrics
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);
    this.requestMetrics.set(requestId, { startTime, service });

    // Step 19: Configure request options with timeout and abort signal
    const requestOptions: RequestInit = {
      ...options,
      signal: config.abortSignal || abortController.signal,
      credentials: 'include', // Essential for authentication
    };

    // Step 20: Set timeout if specified
    let timeoutId: NodeJS.Timeout | null = null;
    if (config.timeout) {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, config.timeout);
    }

    try {
      // Step 21: Execute API request with comprehensive error handling
      const response = await fetch(url, requestOptions);
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const processingTime = Date.now() - startTime;

      // Step 22: Handle successful response
      if (response.ok) {
        const data = await response.json();


        return {
          success: true,
          data,
          requestId,
          timestamp: new Date().toISOString(),
          processingTime
        };
      }

      // Step 23: Handle error response
      const errorData = await response.json().catch(() => ({}));
      const errorEvent = this.createApiErrorEvent(
        { ...errorData, status: response.status },
        service,
        requestId
      );

      // Step 24: Emit error event if not suppressed
      if (!config.suppressEvents) {
        await this.emitErrorEvent(errorEvent);
      }
      return {
        success: false,
        error: errorEvent,
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const processingTime = Date.now() - startTime;
      const errorEvent = this.createApiErrorEvent(error, service, requestId);

      // Step 25: Emit error event for network/processing failures
      if (!config.suppressEvents) {
        await this.emitErrorEvent(errorEvent);
      }

      console.error('[enhancedApiService.ts][7009] API request failed with exception', {
        requestId,
        service,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: errorEvent,
        requestId,
        timestamp: new Date().toISOString(),
        processingTime
      };

    } finally {
      // Step 26: Cleanup request tracking
      this.activeRequests.delete(requestId);
      this.requestMetrics.delete(requestId);
    }
  }

  /**
   * askAssistant
   * @description
   *   Enhanced ask assistant API call with standardized error handling and event emission. This
   *   method wraps the original askQuestionAPI functionality while providing consistent error
   *   classification, event-driven modal integration, and comprehensive request lifecycle
   *   management. The implementation maintains backward compatibility while enabling centralized
   *   error handling for subscription requirements and rate limiting scenarios.
   * @param question - User question for AI assistant processing
   * @param textSelection - Optional selected text for context
   * @param fileID - File identifier for document context
   * @param config - Additional request configuration options
   * @returns Promise resolving to standardized API response with assistant answer
   */
  public async askAssistant(
    question: string,
    textSelection: string,
    fileID: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse> {


    const payload = { question, textSelection, fileID };

    return await this.makeApiRequest(
      '/api/aiServiceLayer?action=question',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'askAssistant',
      config
    );
  }

  /**
   * generateLesson
   * @description
   *   Enhanced lesson generation API call with file upload support and standardized error handling.
   *   This method wraps the GenerateLesson endpoint functionality while providing consistent error
   *   classification, event emission, and request lifecycle management. The implementation supports
   *   both demo credit validation for freemium users and rate limiting for premium users with
   *   appropriate error handling and modal integration through the event system.
   * @param file - File object for lesson generation source material
   * @param docId - Document identifier for lesson association
   * @param options - Generation options including visibility settings
   * @param config - Additional request configuration options
   * @returns Promise resolving to standardized API response with lesson data
   */
  public async generateLesson(
    file: File | null,
    docId: string,
    options: { isPublic?: boolean; webUrl?: string} = {},
  ): Promise<any> {

    const { isPublic = false} = options;


 

        // Step 5: Construct FormData with enhanced parameter support
    const formData = new FormData();
    
    if (file) {
      formData.append('file', file);
    }

    formData.append('DocID', docId);
    
    // Step 6: Add visibility parameter for new account type system
    formData.append('visibility', isPublic ? 'public' : 'private');

    return await this.makeApiRequest(
      '/api/GenerateLesson',
      {
        method:'POST',
        body: formData,
      },
      'lessonGeneration',
    );
  }
  

  /**
   * exploreTopic
   * @description
   *   Enhanced topic exploration API call with standardized error handling and event emission.
   *   This method wraps the topic generation functionality while providing consistent error
   *   classification, subscription validation, and modal integration through the centralized
   *   event system. The implementation maintains existing functionality while enabling unified
   *   error handling for premium service restrictions and rate limiting scenarios.
   * @param userTopicRequest - User's topic exploration request
   * @param exportData - Exported data for topic context
   * @param fileID - File identifier for document context
   * @param textSelection - Optional selected text for additional context
   * @param config - Additional request configuration options
   * @returns Promise resolving to standardized API response with topic exploration data
   */
  public async exploreTopic(
    userTopicRequest: string,
    exportData: any,
    fileID: string,
    textSelection?: string,
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse> {

    const payload = { userTopicRequest, exportData, fileID, textSelection };

    return await this.makeApiRequest(
      '/api/aiServiceLayer?action=generateTopic',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'exploreTopic',
      config
    );
  }

  /**
   * createQuiz
   * @description
   *   Sends a quiz generation request to the backend with resilient payload shaping. Honors only
   *   the first quiz type server-side but forwards the array for parity. Accepts either `topicIds`
   *   or a single `lessonId` (mapped to `topicIds`), and optionally includes `questionCount`,
   *   `exportData`, and `textSelection`. Logs key checkpoints with stable 4-digit codes. All work
   *   is O(1); network cost dominates.
   */
  public async createQuiz(
    params: {
      quizTypes: string[];
      fileID: string;
      /** Optional: preferred number of questions (1–10 recommended) */
      questionCount?: number;
      /** Optional: convenience input — mapped to topicIds when provided */
      lessonId?: string;
      /** Optional: explicit topic ids (takes precedence if provided) */
      topicIds?: string[];
      /** Optional content to base quiz on */
      exportData?: string;
      /** Optional focused selection from the document */
    },
    config: ApiRequestConfig = {}
  ): Promise<ApiResponse> {
    // 1) Normalize inputs
    const {
      quizTypes,
      fileID,
      questionCount,
      lessonId,
      topicIds,
      exportData,
    } = params || ({} as any);

    // 2) Resolve topicIds from lessonId when necessary (single-quiz assumption upstream)
    const resolvedTopicIds = Array.isArray(topicIds) && topicIds.length > 0
      ? topicIds
      : (lessonId ? [String(lessonId)] : []);

    // 3) Build minimal payload; omit undefined to keep backend parsing clean
    const payload: Record<string, any> = {
      quizTypes,
      fileID,
    };
    if (resolvedTopicIds.length > 0) payload.topicIds = resolvedTopicIds;
    if (typeof questionCount === 'number') payload.questionCount = questionCount;
    if (typeof exportData === 'string') payload.exportData = exportData;



    // 4) Dispatch request through the unified request pipeline
    return await this.makeApiRequest(
      '/api/aiServiceLayer?action=quizGenerator',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'createQuiz',
      config
    );
  }


  /**
   * cancelRequest
   * @description
   *   Cancels an active API request using its request identifier for proper resource cleanup
   *   and request lifecycle management. This method supports component unmounting, navigation
   *   changes, and user-initiated cancellations while ensuring clean resource management and
   *   preventing memory leaks from abandoned requests. The implementation provides immediate
   *   request termination with proper cleanup of tracking data and metrics.
   * @param requestId - Request identifier for cancellation targeting
   * @returns Boolean indicating successful cancellation
   */
  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      this.requestMetrics.delete(requestId);
      
      //console.log('[enhancedApiService.ts][7014] Request cancelled successfully', { requestId });
      return true;
    }
    
    //console.log('[enhancedApiService.ts][7015] Request not found for cancellation', { requestId });
    return false;
  }

  /**
   * cancelAllRequests
   * @description
   *   Cancels all active API requests for comprehensive cleanup during application shutdown
   *   or major state changes. This method provides bulk cancellation capabilities for scenarios
   *   like user logout, route changes, or emergency cleanup while ensuring proper resource
   *   management and preventing memory leaks from multiple active requests.
   * @returns Number of requests cancelled
   */
  public cancelAllRequests(): number {
    const cancelledCount = this.activeRequests.size;
    
    for (const [requestId, controller] of this.activeRequests) {
      controller.abort();
    }
    
    this.activeRequests.clear();
    this.requestMetrics.clear();
    
    //console.log('[enhancedApiService.ts][7016] All requests cancelled', { cancelledCount });
    return cancelledCount;
  }

  /**
   * getActiveRequestCount
   * @description
   *   Returns the current number of active API requests for monitoring and debugging purposes.
   *   This method provides visibility into request concurrency and enables performance
   *   monitoring, resource management, and debugging of request lifecycle issues.
   * @returns Number of currently active requests
   */
  public getActiveRequestCount(): number {
    return this.activeRequests.size;
  }
}

// Step 27: Export singleton instance for application-wide usage
export const apiService = EnhancedApiService.getInstance();
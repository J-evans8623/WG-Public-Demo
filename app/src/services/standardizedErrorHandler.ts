/**
 * @file standardizedErrorHandler.ts
 * @description
 *   Centralized error handling utility that provides consistent error response formatting across all API
 *   endpoints for seamless frontend modal integration. This module standardizes error responses from
 *   premium access validation, rate limiting enforcement, and general API processing to ensure that
 *   the frontend can reliably trigger appropriate modals for subscription upgrades, rate limit notifications,
 *   and general error handling. The implementation supports the enhanced ApiService layer strategy by
 *   providing a unified interface for error classification and response formatting that enables the
 *   centralized modal system to display contextually appropriate messages to users. All error responses
 *   include comprehensive metadata for debugging and user feedback while maintaining consistent structure
 *   across different service types and failure scenarios. The handler supports both validation errors
 *   from the validatePremiumAccess system and processing errors from individual AI services with
 *   appropriate error code mapping and user-friendly messaging. Time complexity is O(1) for all error
 *   processing operations with optimized response formatting that minimizes latency during error scenarios.
 *   The module integrates seamlessly with existing error handling patterns while providing enhanced
 *   consistency and frontend integration capabilities for the centralized modal management system.
 *
 * Responsibilities:
 *   - Standardize error response formats across all API endpoints for consistent frontend handling
 *   - Map validation errors to appropriate error codes and user-friendly messages
 *   - Provide metadata for frontend modal triggering and user feedback systems
 *   - Support debugging through comprehensive error logging and request context tracking
 *   - Maintain backward compatibility with existing error handling patterns
 *   - Enable centralized modal integration through consistent error classification
 *   - Optimize error response performance with efficient formatting and minimal processing
 *
 * @author System
 * @date Current
 */

import { NextApiResponse } from 'next';
import { ValidationResult, ServiceType } from './validatePremiumAccess';

// Step 1: Define standardized error response interface
export interface StandardizedErrorResponse {
  error: string;
  message: string;
  service: ServiceType | string;
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
  debugInfo?: {
    timestamp: string;
    requestId?: string;
    endpoint?: string;
  };
}

// Step 2: Define error classification enum for consistent handling
export enum ErrorClassification {
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  DEMO_CREDITS_EXHAUSTED = 'DEMO_CREDITS_EXHAUSTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

// Step 3: Define HTTP status code mapping for consistent responses
const HTTP_STATUS_MAPPING: Record<ErrorClassification, number> = {
  [ErrorClassification.SUBSCRIPTION_REQUIRED]: 403,
  [ErrorClassification.DEMO_CREDITS_EXHAUSTED]: 403,
  [ErrorClassification.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorClassification.PERMISSION_DENIED]: 403,
  [ErrorClassification.VALIDATION_FAILED]: 400,
  [ErrorClassification.PROCESSING_FAILED]: 500,
  [ErrorClassification.AUTHENTICATION_FAILED]: 401,
  [ErrorClassification.INVALID_REQUEST]: 400,
  [ErrorClassification.INTERNAL_SERVER_ERROR]: 500,
};

/**
 * StandardizedErrorHandler
 * @description
 *   Main error handling class that provides consistent error response formatting and classification
 *   across all API endpoints. This class implements standardized error processing that enables
 *   seamless frontend modal integration while maintaining comprehensive debugging information and
 *   user-friendly messaging. The implementation ensures that all errors are properly classified
 *   and formatted according to their type and context, providing the frontend with sufficient
 *   information to trigger appropriate user interactions and feedback mechanisms.
 */
export class StandardizedErrorHandler {
  
  /**
   * handleValidationError
   * @description
   *   Processes validation errors from the validatePremiumAccess system and formats them into
   *   standardized responses for frontend consumption. This method ensures that subscription
   *   tier restrictions, rate limit violations, and permission denials are consistently
   *   formatted with appropriate metadata for modal triggering and user feedback. The
   *   implementation maintains all context from the validation result while providing
   *   optimized response formatting for minimal latency during error scenarios.
   * @param res - NextJS API response object for sending formatted error responses
   * @param validation - Validation result from validatePremiumAccess containing error details
   * @param serviceType - Service type for context and debugging information
   * @param requestId - Optional request ID for debugging and tracking purposes
   * @returns Promise resolving when error response has been sent
   */
  static async handleValidationError(
    res: NextApiResponse,
    validation: ValidationResult,
    serviceType: ServiceType,
    requestId?: string
  ): Promise<void> {
    console.log('[standardizedErrorHandler.ts][6001] Processing validation error', {
      errorCode: validation.errorCode,
      serviceType,
      requestId
    });

    // Step 4: Map validation error codes to standardized classifications
    let errorClassification: ErrorClassification;
    switch (validation.errorCode) {
      case 'SUBSCRIPTION_REQUIRED':
        errorClassification = ErrorClassification.SUBSCRIPTION_REQUIRED;
        break;
      case 'DEMO_CREDITS_EXHAUSTED':
        errorClassification = ErrorClassification.DEMO_CREDITS_EXHAUSTED;
        break;
      case 'RATE_LIMIT_EXCEEDED':
        errorClassification = ErrorClassification.RATE_LIMIT_EXCEEDED;
        break;
      case 'PERMISSION_DENIED':
        errorClassification = ErrorClassification.PERMISSION_DENIED;
        break;
      default:
        errorClassification = ErrorClassification.VALIDATION_FAILED;
    }

    // Step 5: Construct standardized error response with comprehensive metadata
    const errorResponse: StandardizedErrorResponse = {
      error: errorClassification,
      message: validation.errorMessage || 'Access validation failed',
      service: serviceType,
      upgradeRequired: validation.upgradeRequired || false,
      userStatus: {
        accountType: validation.userStatus.profile.accountType,
        subscriptionTier: validation.userStatus.profile.subscriptionTier,
        remainingDemoCredits: validation.userStatus.usage.demoCredits.remaining
      },
      debugInfo: {
        timestamp: new Date().toISOString(),
        requestId,
        endpoint: `${serviceType}_validation`
      }
    };

    // Step 6: Add retry timing for rate limit scenarios
    if (validation.retryAfter) {
      errorResponse.retryAfter = validation.retryAfter;
    }

    // Step 7: Add rate limit details for premium users with proper formatting
    if (validation.userStatus.usage.rateLimits.lessonGeneration && serviceType === 'lessonGeneration') {
      const lessonLimits = validation.userStatus.usage.rateLimits.lessonGeneration;
      const accountType = validation.userStatus.profile.accountType;
      
      // Get limit values based on account type
      const hourlyLimit = accountType === 'scholar' ? 8 : 15;
      const monthlyLimit = accountType === 'scholar' ? 100 : 200;
      
      errorResponse.rateLimitInfo = {
        hourlyRemaining: lessonLimits.hourlyRemaining,
        monthlyRemaining: lessonLimits.monthlyRemaining,
        hourlyLimit: hourlyLimit,
        monthlyLimit: monthlyLimit
      };
      
      console.log('[standardizedErrorHandler.ts][6010] Rate limit info added for lesson generation', {
        accountType,
        hourlyLimit,
        monthlyLimit,
        hourlyRemaining: lessonLimits.hourlyRemaining,
        monthlyRemaining: lessonLimits.monthlyRemaining
      });
    }

    const statusCode = HTTP_STATUS_MAPPING[errorClassification];
    console.log('[standardizedErrorHandler.ts][6002] Sending standardized validation error response', {
      statusCode,
      errorClassification,
      upgradeRequired: errorResponse.upgradeRequired
    });

    res.status(statusCode).json(errorResponse);
  }

  /**
   * handleProcessingError
   * @description
   *   Processes general processing errors from AI services and API endpoints, providing standardized
   *   error responses with appropriate classification and user messaging. This method handles errors
   *   that occur during AI processing, file operations, database interactions, and other service
   *   operations while maintaining consistent response formatting for frontend modal integration.
   *   The implementation includes comprehensive error logging and debugging information for
   *   production monitoring and troubleshooting capabilities.
   * @param res - NextJS API response object for sending formatted error responses
   * @param error - Error object or message from failed processing operation
   * @param serviceType - Service type for context and debugging information
   * @param requestId - Optional request ID for debugging and tracking purposes
   * @param customMessage - Optional custom message for user-facing error display
   * @returns Promise resolving when error response has been sent
   */
  static async handleProcessingError(
    res: NextApiResponse,
    error: Error | string | unknown,
    serviceType: ServiceType | string,
    requestId?: string,
    customMessage?: string
  ): Promise<void> {
    console.log('[standardizedErrorHandler.ts][6003] Processing general processing error', {
      serviceType,
      requestId,
      errorType: typeof error
    });

    // Step 8: Classify error based on type and content
    let errorClassification: ErrorClassification = ErrorClassification.PROCESSING_FAILED;
    let errorMessage: string = customMessage || 'Processing failed';
    let statusCode: number = 500;

    if (error instanceof Error) {
      errorMessage = customMessage || error.message;
      
      // Step 9: Classify specific error types for appropriate handling
      if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        errorClassification = ErrorClassification.AUTHENTICATION_FAILED;
        statusCode = 401;
      } else if (error.message.includes('validation') || error.message.includes('invalid')) {
        errorClassification = ErrorClassification.VALIDATION_FAILED;
        statusCode = 400;
      } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
        errorClassification = ErrorClassification.PERMISSION_DENIED;
        statusCode = 403;
      }
    } else if (typeof error === 'string') {
      errorMessage = customMessage || error;
    } else {
      errorMessage = customMessage || 'An unknown error occurred';
      errorClassification = ErrorClassification.INTERNAL_SERVER_ERROR;
    }

    // Step 10: Construct standardized error response for processing failures
    const errorResponse: StandardizedErrorResponse = {
      error: errorClassification,
      message: errorMessage,
      service: serviceType,
      upgradeRequired: false, // Processing errors don't require upgrades
      debugInfo: {
        timestamp: new Date().toISOString(),
        requestId,
        endpoint: `${serviceType}_processing`
      }
    };

    console.log('[standardizedErrorHandler.ts][6004] Sending standardized processing error response', {
      statusCode,
      errorClassification,
      serviceType
    });

    res.status(statusCode).json(errorResponse);
  }

  /**
   * handleAuthenticationError
   * @description
   *   Processes authentication failures with standardized response formatting for consistent
   *   frontend handling. This method handles scenarios where user sessions are invalid,
   *   expired, or missing while providing appropriate error messages and status codes.
   *   The implementation supports the centralized authentication system by ensuring that
   *   authentication failures are consistently formatted across all API endpoints.
   * @param res - NextJS API response object for sending formatted error responses
   * @param requestId - Optional request ID for debugging and tracking purposes
   * @param customMessage - Optional custom message for authentication failure context
   * @returns Promise resolving when error response has been sent
   */
  static async handleAuthenticationError(
    res: NextApiResponse,
    requestId?: string,
    customMessage?: string
  ): Promise<void> {
    console.log('[standardizedErrorHandler.ts][6005] Processing authentication error', { requestId });

    const errorResponse: StandardizedErrorResponse = {
      error: ErrorClassification.AUTHENTICATION_FAILED,
      message: customMessage || 'Authentication required',
      service: 'authentication',
      upgradeRequired: false,
      debugInfo: {
        timestamp: new Date().toISOString(),
        requestId,
        endpoint: 'authentication'
      }
    };

    console.log('[standardizedErrorHandler.ts][6006] Sending authentication error response');
    res.status(401).json(errorResponse);
  }

  /**
   * handleInvalidRequest
   * @description
   *   Processes invalid request errors with standardized formatting for consistent parameter
   *   validation and request structure errors. This method handles scenarios where required
   *   parameters are missing, invalid request methods are used, or request body structure
   *   is incorrect while providing clear user feedback and debugging information for
   *   developers and system administrators.
   * @param res - NextJS API response object for sending formatted error responses
   * @param message - Specific message describing the invalid request details
   * @param serviceType - Service type for context and debugging information
   * @param requestId - Optional request ID for debugging and tracking purposes
   * @returns Promise resolving when error response has been sent
   */
  static async handleInvalidRequest(
    res: NextApiResponse,
    message: string,
    serviceType: ServiceType | string,
    requestId?: string
  ): Promise<void> {
    console.log('[standardizedErrorHandler.ts][6007] Processing invalid request error', {
      message,
      serviceType,
      requestId
    });

    const errorResponse: StandardizedErrorResponse = {
      error: ErrorClassification.INVALID_REQUEST,
      message,
      service: serviceType,
      upgradeRequired: false,
      debugInfo: {
        timestamp: new Date().toISOString(),
        requestId,
        endpoint: `${serviceType}_validation`
      }
    };

    console.log('[standardizedErrorHandler.ts][6008] Sending invalid request error response');
    res.status(400).json(errorResponse);
  }

  /**
   * generateRequestId
   * @description
   *   Generates a unique request identifier for tracking and debugging purposes across
   *   distributed systems and logging infrastructure. This utility method creates
   *   timestamp-based identifiers that enable correlation of requests across multiple
   *   services and provide efficient debugging capabilities for production monitoring.
   *   The implementation ensures uniqueness while maintaining human-readable format.
   * @returns Unique request identifier string for tracking and debugging
   */
  static generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`;
  }

  /**
   * logErrorContext
   * @description
   *   Comprehensive error logging utility that captures request context, user information,
   *   and error details for debugging and monitoring purposes. This method provides
   *   structured logging that enables efficient troubleshooting and system monitoring
   *   while maintaining user privacy and security. The implementation supports both
   *   development debugging and production monitoring with appropriate log levels.
   * @param error - Error object or message for logging and analysis
   * @param context - Request context including user, service, and request details
   * @returns Promise resolving when logging is complete
   */
  static async logErrorContext(
    error: Error | string | unknown,
    context: {
      serviceType: ServiceType | string;
      userEmail?: string;
      requestId?: string;
      endpoint?: string;
      additionalData?: any;
    }
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: context.serviceType,
      requestId: context.requestId,
      endpoint: context.endpoint,
      userEmail: context.userEmail,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      additionalData: context.additionalData
    };

    console.error('[standardizedErrorHandler.ts][6009] Error context logged', logEntry);
    
    // Future: Integration with external logging services (DataDog, CloudWatch, etc.)
    // await externalLoggingService.log(logEntry);
  }
}
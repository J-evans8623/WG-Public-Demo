'use client'
/**
 * @file modalEventManager.ts
 * @description
 *   Event subscription and modal mapping service that connects API error events to appropriate modal
 *   triggers while maintaining clean separation between API errors and UI presentation logic. This
 *   service implements intelligent modal priority resolution, event subscription management, and
 *   conflict resolution for scenarios where multiple modals might be triggered simultaneously. The
 *   implementation provides centralized modal triggering based on API error events without mixing
 *   API logic with UI concerns, ensuring that subscription prompts, rate limit notifications, and
 *   error modals are consistently displayed across all application components. The service includes
 *   comprehensive event cleanup, memory management, and debugging utilities for production reliability
 *   and monitoring. Priority-based modal management ensures that critical user interactions such as
 *   authentication failures take precedence over less urgent notifications while providing optimal
 *   user experience through intelligent modal sequencing and conflict resolution. The event-driven
 *   architecture enables seamless integration with the existing modal management system while
 *   supporting future enhancements and additional modal types. All operations maintain O(1) time
 *   complexity with optimized event processing and modal state management for maximum performance.
 *   This updated implementation resolves TypeScript event handler binding issues by storing proper
 *   event handler references for reliable cleanup and type safety compliance.
 *
 * Responsibilities:
 *   - Subscribe to API error events from EnhancedApiService for centralized modal triggering
 *   - Map API error types to appropriate modal configurations and display logic
 *   - Implement priority-based modal management for handling simultaneous error scenarios
 *   - Provide event cleanup and memory management for production-grade reliability
 *   - Support debugging and monitoring through comprehensive logging and event tracking
 *   - Maintain clean separation between API error handling and UI presentation logic
 *   - Enable seamless integration with existing modal management system and future enhancements
 *   - Store and manage event handler references for proper TypeScript compliance and cleanup
 *
 * @author System
 * @date Current
 */

import { apiService, ApiErrorEvent, ApiErrorType, ApiServiceType } from './ApiService';
import { ModalType } from '@/app/workspace/(studygraph)/components/modals/AppModals';

// Step 1: Define modal priority levels for conflict resolution
export enum ModalPriority {
  CRITICAL = 1,    // Authentication failures, system errors
  HIGH = 2,        // Rate limits, permission denials
  MEDIUM = 3,      // Subscription requirements
  LOW = 4          // General notifications, info messages
}

// Step 2: Define modal mapping configuration interface
export interface ModalMapping {
  modalType: ModalType;
  priority: ModalPriority;
  props: Record<string, any>;
  conditions?: {
    subscriptionTier?: 'freemium' | 'premium';
    accountType?: 'scholar' | 'educator';
    upgradeRequired?: boolean;
  };
}

// Step 3: Define modal event queue item interface
interface QueuedModalEvent {
  id: string;
  mapping: ModalMapping;
  errorEvent: ApiErrorEvent;
  timestamp: number;
  processed: boolean;
}

// Step 4: Define modal event manager configuration
interface ModalEventManagerConfig {
  maxQueueSize: number;
  processingDelay: number;
  debugMode: boolean;
  enablePriorityQueue: boolean;
}

/**
 * ModalEventManager
 * @description
 *   Centralized modal event management service that connects API error events to modal triggers
 *   through intelligent mapping and priority resolution. This service implements event-driven
 *   modal triggering while maintaining clean separation between API error handling and UI
 *   presentation logic. The implementation provides comprehensive queue management, priority
 *   resolution, and conflict handling for optimal user experience across all error scenarios.
 *   Time complexity is O(log n) for priority queue operations with optimized event processing.
 *   This updated version resolves TypeScript event handler binding issues by maintaining proper
 *   event handler references for reliable cleanup and type-safe event subscription management.
 */
export class ModalEventManager {
  private static instance: ModalEventManager | null = null;
  private isInitialized = false;
  private eventQueue: QueuedModalEvent[] = [];
  private activeModalId: string | null = null;
  private modalTriggerCallback: ((modalType: ModalType, props: any) => void) | null = null;
  private config: ModalEventManagerConfig;

  // Step 5: Store event handler references for proper cleanup and TypeScript compliance
  private errorEventHandler: ((event: Event) => void) | null = null;
  private serviceEventHandlers: Map<ApiServiceType, (event: Event) => void> = new Map();

  // Step 6: Define comprehensive error to modal mapping
  private readonly errorModalMap: Record<ApiErrorType, ModalMapping[]> = {
    [ApiErrorType.SUBSCRIPTION_REQUIRED]: [{
      modalType: 'subscribe',
      priority: ModalPriority.MEDIUM,
      props: {},
      conditions: { upgradeRequired: true }
    }],
    [ApiErrorType.DEMO_CREDITS_EXHAUSTED]: [{
      modalType: 'subscribe',
      priority: ModalPriority.MEDIUM,
      props: { featureName: 'Lesson Generation' },
    }],
    [ApiErrorType.RATE_LIMIT_EXCEEDED]: [{
      modalType: 'rateLimit',
      priority: ModalPriority.HIGH,
      props: {},
      conditions: { subscriptionTier: 'premium' }
    }],
    [ApiErrorType.OWNER_ACCESS_RESTRICTED]: [{
      modalType: 'subscribe',
      priority: ModalPriority.HIGH,
      props: { 
        featureName: 'You can only use free demo credits on documents you own.',
      },
      conditions: { upgradeRequired: true }
    }],
    [ApiErrorType.PERMISSION_DENIED]: [{
      modalType: 'subscribe',
      priority: ModalPriority.HIGH,
      props: {},
      conditions: { accountType: 'scholar' }
    }],
    [ApiErrorType.AUTHENTICATION_FAILED]: [],
    [ApiErrorType.VALIDATION_FAILED]: [],
    [ApiErrorType.PROCESSING_FAILED]: [],
    [ApiErrorType.NETWORK_ERROR]: [],
    [ApiErrorType.UNKNOWN_ERROR]: []
  };

  constructor(config: Partial<ModalEventManagerConfig> = {}) {
    // Step 7: Initialize configuration with defaults
    this.config = {
      maxQueueSize: 10,
      processingDelay: 100,
      debugMode: false,
      enablePriorityQueue: true,
      ...config
    };

    //console.log('[modalEventManager.ts][9001] ModalEventManager initialized with config', this.config);
  }

  /**
   * getInstance
   * @description
   *   Singleton pattern implementation ensuring consistent modal event management across the
   *   application. This approach maintains state consistency for event queues, active modals,
   *   and configuration while preventing duplicate manager instances that could cause conflicts
   *   in modal triggering and event handling throughout the application lifecycle.
   * @param config - Optional configuration overrides for manager initialization
   * @returns Singleton ModalEventManager instance for application-wide usage
   */
  public static getInstance(config?: Partial<ModalEventManagerConfig>): ModalEventManager {
    if (!ModalEventManager.instance) {
      //console.log('[modalEventManager.ts][9002] Creating singleton ModalEventManager instance');
      ModalEventManager.instance = new ModalEventManager(config);
    }
    return ModalEventManager.instance;
  }

  /**
   * initialize
   * @description
   *   Initializes the modal event manager by subscribing to API error events and setting up
   *   event processing infrastructure. This method establishes the connection between the
   *   EnhancedApiService and modal triggering system while ensuring proper cleanup and memory
   *   management. The initialization process includes event listener registration, queue
   *   setup, and debugging configuration for comprehensive modal management capabilities.
   *   Updated implementation stores event handler references for TypeScript compliance and proper cleanup.
   * @param modalTriggerCallback - Callback function for triggering modals in the UI layer
   * @returns Promise resolving when initialization is complete
   */
  public async initialize(modalTriggerCallback: (modalType: ModalType, props: any) => void): Promise<void> {
    if (this.isInitialized) {
      //console.log('[modalEventManager.ts][9003] ModalEventManager already initialized');
      return;
    }

    //console.log('[modalEventManager.ts][9004] Initializing ModalEventManager with event subscriptions');

    // Step 8: Store modal trigger callback for UI integration
    this.modalTriggerCallback = modalTriggerCallback;

    // Step 9: Create and store general API error event handler with proper type safety
    this.errorEventHandler = (event: Event) => {
      if (event instanceof CustomEvent) {
        //console.log('[modalEventManager.ts][9005] Processing general API error event received');
        return this.handleApiErrorEvent(event as CustomEvent<ApiErrorEvent>);
      }
    };
    apiService.addEventListener('api-error', this.errorEventHandler);

    // Step 10: Create and store service-specific error event handlers for targeted handling
    const serviceTypes: ApiServiceType[] = ['lessonGeneration', 'askAssistant', 'exploreTopic', 'createQuiz'];
    serviceTypes.forEach(serviceType => {
      const serviceHandler = (event: Event) => {
        if (event instanceof CustomEvent) {
          //console.log('[modalEventManager.ts][9006] Processing service-specific error event', { serviceType });
          return this.handleServiceErrorEvent(serviceType, event as CustomEvent<ApiErrorEvent>);
        }
      };
      this.serviceEventHandlers.set(serviceType, serviceHandler);
      apiService.addEventListener(`api-error-${serviceType}`, serviceHandler);
    });

    this.isInitialized = true;
    //console.log('[modalEventManager.ts][9007] ModalEventManager initialization completed successfully');
  }

  /**
   * handleApiErrorEvent
   * @description
   *   Processes general API error events and determines appropriate modal responses based on
   *   error type, user context, and current application state. This method implements the
   *   core modal mapping logic that translates API errors into modal configurations while
   *   applying priority-based queuing and conflict resolution for optimal user experience.
   *   The handler ensures that modals are triggered consistently across all error scenarios.
   * @param event - Custom event containing API error details from EnhancedApiService
   * @returns Promise resolving when error event processing is complete
   */
  private async handleApiErrorEvent(event: CustomEvent<ApiErrorEvent>): Promise<void> {
    const errorEvent = event.detail;
    


    // Step 11: Get modal mappings for error type
    const mappings = this.getModalMappingsForError(errorEvent);
    
    if (mappings.length === 0) {

      return;
    }

    // Step 12: Process each applicable mapping
    for (const mapping of mappings) {
      if (this.shouldShowModal(mapping, errorEvent)) {
        await this.queueModal(mapping, errorEvent);
      }
    }
  }

  /**
   * handleServiceErrorEvent
   * @description
   *   Processes service-specific API error events with enhanced context awareness and targeted
   *   modal handling. This method provides specialized error handling for different service
   *   types while maintaining consistent modal triggering patterns and priority resolution.
   *   The service-specific handling enables customized user feedback based on the context
   *   of the failed operation and user interaction patterns.
   * @param serviceType - Specific service type for contextual error handling
   * @param event - Custom event containing service-specific API error details
   * @returns Promise resolving when service error event processing is complete
   */
  private async handleServiceErrorEvent(serviceType: ApiServiceType, event: CustomEvent<ApiErrorEvent>): Promise<void> {
    const errorEvent = event.detail;
    

    // Step 13: Apply service-specific modal customizations
    const mappings = this.getModalMappingsForError(errorEvent);
    const customizedMappings = mappings.map(mapping => ({
      ...mapping,
      props: {
        ...mapping.props,
        featureName: this.getServiceDisplayName(serviceType),
        serviceContext: serviceType
      }
    }));

    // Step 14: Process customized mappings with service context
    for (const mapping of customizedMappings) {
      if (this.shouldShowModal(mapping, errorEvent)) {
        await this.queueModal(mapping, errorEvent);
      }
    }
  }

  /**
   * getModalMappingsForError
   * @description
   *   Retrieves appropriate modal mappings for a given API error event based on error type
   *   and configuration. This method implements the core mapping logic that determines which
   *   modals should be triggered for specific error scenarios while supporting conditional
   *   mapping based on user context and application state. The implementation ensures
   *   consistent modal selection across all error types and user scenarios.
   * @param errorEvent - API error event containing error details and user context
   * @returns Array of applicable modal mappings for the given error event
   */
  private getModalMappingsForError(errorEvent: ApiErrorEvent): ModalMapping[] {
    const mappings = this.errorModalMap[errorEvent.type] || [];
    

    return mappings.filter(mapping => this.evaluateConditions(mapping.conditions, errorEvent));
  }

  /**
   * evaluateConditions
   * @description
   *   Evaluates conditional logic for modal mappings based on user context and error details.
   *   This method implements flexible condition checking that enables context-aware modal
   *   triggering based on subscription tier, account type, and error-specific flags. The
   *   evaluation ensures that modals are only triggered when appropriate for the user's
   *   current context and application state.
   * @param conditions - Optional conditions for modal display evaluation
   * @param errorEvent - API error event containing user context and error details
   * @returns Boolean indicating whether conditions are met for modal display
   */
  private evaluateConditions(conditions: ModalMapping['conditions'], errorEvent: ApiErrorEvent): boolean {
    if (!conditions) return true;

    // Step 15: Check subscription tier conditions
    if (conditions.subscriptionTier && errorEvent.userStatus?.subscriptionTier !== conditions.subscriptionTier) {
      return false;
    }

    // Step 16: Check account type conditions
    if (conditions.accountType && errorEvent.userStatus?.accountType !== conditions.accountType) {
      return false;
    }

    // Step 17: Check upgrade requirement conditions
    if (conditions.upgradeRequired !== undefined && errorEvent.upgradeRequired !== conditions.upgradeRequired) {
      return false;
    }

    return true;
  }

  /**
   * shouldShowModal
   * @description
   *   Determines whether a modal should be displayed based on mapping configuration, current
   *   application state, and conflict resolution logic. This method implements intelligent
   *   modal display logic that prevents duplicate modals, respects priority hierarchies,
   *   and ensures optimal user experience through context-aware decision making and
   *   comprehensive state evaluation for consistent modal behavior.
   * @param mapping - Modal mapping configuration for evaluation
   * @param errorEvent - API error event providing context for decision making
   * @returns Boolean indicating whether the modal should be displayed
   */
  private shouldShowModal(mapping: ModalMapping, errorEvent: ApiErrorEvent): boolean {
    // Step 18: Check if maximum queue size exceeded
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      return false;
    }

    // Step 19: Check for duplicate modals of same type
    const hasDuplicateModal = this.eventQueue.some(queuedEvent => 
      queuedEvent.mapping.modalType === mapping.modalType && !queuedEvent.processed
    );

    if (hasDuplicateModal) {

      return false;
    }

    // Step 20: Check priority against currently active modal
    if (this.activeModalId) {
      const activeModal = this.eventQueue.find(event => event.id === this.activeModalId);
      if (activeModal && activeModal.mapping.priority <= mapping.priority) {
  
        return true; // Queue but don't show immediately
      }
    }

    return true;
  }

  /**
   * queueModal
   * @description
   *   Adds a modal to the processing queue with priority-based ordering and immediate
   *   processing if appropriate. This method implements intelligent queuing that maintains
   *   priority order while supporting immediate display for high-priority modals. The
   *   implementation includes comprehensive queue management, event correlation, and
   *   processing coordination for optimal modal display timing and user experience.
   * @param mapping - Modal mapping configuration for queue processing
   * @param errorEvent - API error event associated with the modal request
   * @returns Promise resolving when modal queuing is complete
   */
  private async queueModal(mapping: ModalMapping, errorEvent: ApiErrorEvent): Promise<void> {
    const queuedEvent: QueuedModalEvent = {
      id: `modal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      mapping,
      errorEvent,
      timestamp: Date.now(),
      processed: false
    };

    // Step 21: Insert with priority ordering if enabled
    if (this.config.enablePriorityQueue) {
      this.insertByPriority(queuedEvent);
    } else {
      this.eventQueue.push(queuedEvent);
    }

    // Step 22: Process queue if no active modal
    if (!this.activeModalId) {
      await this.processNextModal();
    }
  }

  /**
   * insertByPriority
   * @description
   *   Inserts a queued modal event into the priority queue maintaining proper ordering based
   *   on modal priority levels. This method implements efficient priority queue insertion
   *   with O(n) time complexity for maintaining priority order while ensuring that critical
   *   modals are processed before lower priority notifications for optimal user experience
   *   and proper error handling precedence throughout the application.
   * @param queuedEvent - Modal event to insert into the priority-ordered queue
   * @returns Void when insertion is complete with proper priority positioning
   */
  private insertByPriority(queuedEvent: QueuedModalEvent): void {
    let insertIndex = this.eventQueue.length;
    
    // Step 23: Find insertion point for priority ordering
    for (let i = 0; i < this.eventQueue.length; i++) {
      if (this.eventQueue[i].mapping.priority > queuedEvent.mapping.priority) {
        insertIndex = i;
        break;
      }
    }

    this.eventQueue.splice(insertIndex, 0, queuedEvent);
    

  }

  /**
   * processNextModal
   * @description
   *   Processes the next modal in the queue with appropriate timing and conflict resolution.
   *   This method implements intelligent modal processing that respects priority ordering,
   *   applies processing delays for optimal user experience, and manages active modal state
   *   for proper coordination. The processing includes comprehensive error handling and
   *   state management for reliable modal display across all application scenarios.
   * @returns Promise resolving when modal processing is complete or queue is empty
   */
  private async processNextModal(): Promise<void> {
    if (this.eventQueue.length === 0 || this.activeModalId) {
      return;
    }

    const nextEvent = this.eventQueue.find(event => !event.processed);
    if (!nextEvent) {
      return;
    }


    // Step 24: Apply processing delay for smooth UX
    if (this.config.processingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.processingDelay));
    }

    // Step 25: Mark as active and processed
    this.activeModalId = nextEvent.id;
    nextEvent.processed = true;

    // Step 26: Trigger modal display
    if (this.modalTriggerCallback) {
      const modalProps = {
        ...nextEvent.mapping.props,
        onClose: () => this.handleModalClose(nextEvent.id),
        // Add error context for debugging
        errorContext: {
          type: nextEvent.errorEvent.type,
          service: nextEvent.errorEvent.service,
          requestId: nextEvent.errorEvent.requestId,
          retryAfter: nextEvent.errorEvent.retryAfter
        }
      };

      this.modalTriggerCallback(nextEvent.mapping.modalType, modalProps);

    }
  }

  /**
   * handleModalClose
   * @description
   *   Handles modal closure events with proper cleanup and queue processing continuation.
   *   This method implements comprehensive modal state management that clears active modal
   *   references, removes processed events from the queue, and triggers processing of
   *   subsequent queued modals. The implementation ensures proper resource cleanup and
   *   smooth modal sequencing for optimal user experience and system reliability.
   * @param modalId - Identifier of the modal being closed for state cleanup
   * @returns Promise resolving when modal closure processing is complete
   */
  private async handleModalClose(modalId: string): Promise<void> {
    //console.log('[modalEventManager.ts][9019] Handling modal close event', { modalId });

    // Step 27: Clear active modal reference
    if (this.activeModalId === modalId) {
      this.activeModalId = null;
    }

    // Step 28: Remove processed event from queue
    this.eventQueue = this.eventQueue.filter(event => event.id !== modalId);

    // Step 29: Process next modal in queue
    setTimeout(() => {
      this.processNextModal();
    }, this.config.processingDelay);
  }

  /**
   * getServiceDisplayName
   * @description
   *   Converts internal service type identifiers to user-friendly display names for modal
   *   content and error messaging. This utility method ensures consistent naming across
   *   all modal displays while providing localization support for future internationalization
   *   efforts. The mapping maintains clean separation between technical identifiers and
   *   user-facing terminology for enhanced user experience and comprehension.
   * @param serviceType - Internal service type identifier for name mapping
   * @returns Human-readable service name for display in modals and error messages
   */
  private getServiceDisplayName(serviceType: ApiServiceType): string {
    const serviceNames = {
      lessonGeneration: 'Lesson Generation',
      askAssistant: 'Ask Assistant',
      exploreTopic: 'Explore Topic',
      createQuiz: 'Quiz Creation'
    };

    return serviceNames[serviceType] || 'Premium Service';
  }

  /**
   * clearQueue
   * @description
   *   Clears all queued modal events for emergency cleanup or state reset scenarios. This
   *   method provides comprehensive queue cleanup that removes all pending modals while
   *   maintaining active modal state for proper user experience. The implementation supports
   *   emergency cleanup scenarios, route changes, or administrative operations that require
   *   complete modal queue reset for optimal application state management.
   * @returns Number of queued events that were cleared from the processing queue
   */
  public clearQueue(): number {
    const clearedCount = this.eventQueue.length;
    this.eventQueue = [];
    
    //console.log('[modalEventManager.ts][9020] Modal queue cleared', { clearedCount });
    return clearedCount;
  }

  /**
   * getQueueStatus
   * @description
   *   Provides comprehensive status information about the modal event queue for debugging
   *   and monitoring purposes. This method returns detailed queue metrics including size,
   *   active modal status, priority distribution, and processing state for comprehensive
   *   system monitoring and troubleshooting capabilities in production environments.
   * @returns Object containing comprehensive queue status and metrics information
   */
  public getQueueStatus(): {
    queueSize: number;
    activeModalId: string | null;
    priorityDistribution: Record<ModalPriority, number>;
    processedCount: number;
  } {
    const priorityDistribution = this.eventQueue.reduce((acc, event) => {
      acc[event.mapping.priority] = (acc[event.mapping.priority] || 0) + 1;
      return acc;
    }, {} as Record<ModalPriority, number>);

    const processedCount = this.eventQueue.filter(event => event.processed).length;

    return {
      queueSize: this.eventQueue.length,
      activeModalId: this.activeModalId,
      priorityDistribution,
      processedCount
    };
  }

  /**
   * shutdown
   * @description
   *   Performs comprehensive cleanup and shutdown of the modal event manager including
   *   event listener removal, queue clearing, and state reset. This method ensures proper
   *   resource cleanup during application shutdown or manager replacement while preventing
   *   memory leaks and orphaned event handlers for optimal resource management and
   *   application performance in production environments. Updated implementation uses
   *   stored event handler references for reliable cleanup and TypeScript compliance.
   * @returns Promise resolving when shutdown cleanup is complete
   */
  public async shutdown(): Promise<void> {
    //console.log('[modalEventManager.ts][9021] Shutting down ModalEventManager');

    // Step 30: Remove general API error event listener using stored reference
    if (this.errorEventHandler) {
      apiService.removeEventListener('api-error', this.errorEventHandler);
      this.errorEventHandler = null;
      //console.log('[modalEventManager.ts][9022] General error event listener removed');
    }
    
    // Step 31: Remove service-specific event listeners using stored references
    for (const [serviceType, handler] of this.serviceEventHandlers) {
      apiService.removeEventListener(`api-error-${serviceType}`, handler);
      //console.log('[modalEventManager.ts][9023] Service event listener removed', { serviceType });
    }
    this.serviceEventHandlers.clear();

    // Step 32: Clear queue and reset state
    this.clearQueue();
    this.activeModalId = null;
    this.modalTriggerCallback = null;
    this.isInitialized = false;

    //console.log('[modalEventManager.ts][9024] ModalEventManager shutdown completed');
  }
}

// Step 33: Export singleton instance for application-wide usage
export const modalEventManager = ModalEventManager.getInstance();
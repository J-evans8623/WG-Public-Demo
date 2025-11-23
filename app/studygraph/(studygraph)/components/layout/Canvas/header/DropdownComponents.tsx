/**
 * @file DropdownComponents.tsx (Enhanced with Centralized Modal Integration)
 * @description
 * Production-ready dropdown components for the editable CanvasHeader that handle lesson workflows
 * (generate, create, select) and file workflows (upload, select) with complete integration to the
 * centralized modal system. This updated implementation eliminates direct API calls and individual
 * error handling in favor of the unified modal system that provides consistent account-aware
 * functionality, subscription tier checking, and comprehensive error handling across all navigation
 * components. The dropdowns maintain their existing visual design, accessibility features, and
 * interaction patterns while routing all premium service operations through the centralized API
 * service and modal management system. This ensures uniform user experience between NavigationPanel
 * and DropdownComponents while providing proper permission enforcement, rate limiting, and upgrade
 * prompts based on user account status. All file uploads and lesson generation operations now use
 * the same modal workflows established in the NavigationPanel, creating consistency across the
 * application's navigation components and eliminating code duplication for error handling scenarios.
 * 
 * Responsibilities:
 * - Provide accessible dropdown menus for Lessons and Uploads with centralized modal integration
 * - Eliminate direct API calls in favor of centralized modal system for consistency
 * - Integrate with account status management for permission-aware feature rendering
 * - Maintain existing visual design, accessibility, and interaction patterns
 * - Ensure exclusive visual selection highlighting through activeView gating
 * - Handle lesson generation and file uploads through unified modal workflows
 * - Provide consistent error handling and user feedback across all dropdown operations
 * - Support comprehensive logging for debugging and observability during critical operations
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Sparkles, FolderOpen, FileText } from 'lucide-react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useViewSwitch } from '@/app/Library/Context/pdf/ViewSwitchContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import { useLessonData } from '@/app/Library/Context/LessonDataContext';
import { useGlobalModal } from '@/app/studygraph/(studygraph)/components/modals/GlobalModalProvider';
import { useAccountStatus } from '@/app/src/context/ApiContext';
import './DropdownComponents.css';

/**
 * useClickOutside
 * @description
 * Hook that detects clicks outside of a referenced element and invokes a callback to enable reliable
 * dropdown dismissal. This centralizes event wiring and cleanup to prevent memory leaks and ensure
 * proper dropdown behavior during rapid toggles or long user sessions.
 * @param ref React ref pointing to the element to monitor for outside clicks
 * @param onOutside Callback function executed when outside click is detected
 */
function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        console.log('[DropdownComponents.tsx][3001] Click outside detected, closing dropdown');
        onOutside();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, onOutside]);
}

/**
 * LessonsDropdownProps
 * @description Props interface for the LessonsDropdown component
 */
interface LessonsDropdownProps {
  /** Callback triggered when a lesson generation request is successful */
  onLessonGenerated?: (responseData: any) => void;
}

/**
 * LessonsDropdown
 * @description
 * Enhanced editable lessons dropdown that integrates with the centralized modal system for AI lesson
 * generation, blank lesson creation, and navigation among existing lessons. This updated implementation
 * follows the backend-driven error handling approach where the lesson generation modal is opened first,
 * and subscription validation occurs at the API level, triggering appropriate modals through the event
 * system when users lack permissions or hit rate limits.
 * @param onLessonGenerated Optional callback triggered when lesson generation succeeds
 * @returns Enhanced lessons dropdown component with centralized modal integration
 */
export const LessonsDropdown: React.FC<LessonsDropdownProps> = ({ onLessonGenerated }) => {
  // Step 1: Local UI state management
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Step 2: Context hooks for existing functionality
  const {
    getLessonModule,
    addConceptMap,
    activeConceptMapId,
    setActiveConceptMapId,
    isGeneratingLesson,
  } = useLessonModule();
  const { activeView, setActiveView } = useViewSwitch();
  const { docFileID } = useYDoc();
  const { addLessonModule } = useLessonData();

  // Step 3: Centralized modal integration
  const { showModal } = useGlobalModal ();

  // Step 4: Click-outside dismissal setup
  useClickOutside(dropdownRef, () => setIsOpen(false));

  // Step 5: Retrieve lesson data
  const lessons = getLessonModule().conceptMaps || [];
  console.log('[DropdownComponents.tsx][3002] LessonsDropdown render - Count:', lessons.length, 'ActiveView:', activeView, 'ActiveLessonId:', activeConceptMapId);

  /**
   * handleGenerateLessonSuccess
   * @description
   * Processes successful lesson generation response by updating lesson data context and triggering
   * external success callbacks. This function maintains the existing lesson generation workflow
   * while providing comprehensive logging and error handling for production reliability.
   * @param responseData Response data from successful lesson generation API call
   * @returns Promise resolving when lesson generation response processing is complete
   */
  const handleGenerateLessonSuccess = useCallback((responseData: any) => {
    console.log('[DropdownComponents.tsx][3003] Processing lesson generation success response:', responseData);
    
    try {
      // Step 6: Update lesson data context if lesson modules are provided
      if (responseData?.id && responseData?.lessonModules) {
        addLessonModule(responseData.id, { lessonModules: responseData.lessonModules });
        console.log('[DropdownComponents.tsx][3004] Lesson modules added to data context successfully');
      }
      
      // Step 7: Trigger external callback if provided
      onLessonGenerated?.(responseData);
      console.log('[DropdownComponents.tsx][3005] External lesson generation callback executed');
    } catch (error) {
      console.error('[DropdownComponents.tsx][3006] Error processing lesson generation response:', error);
    }
  }, [addLessonModule, onLessonGenerated]);

  /**
   * handleGenerateLesson
   * @description
   * Backend-driven lesson generation handler that opens the lesson generation modal directly,
   * allowing the backend to handle subscription validation and trigger appropriate error modals
   * through the event system. This approach follows the specified workflow where the modal opens
   * first and subscription checking occurs at the API level.
   * @returns Promise resolving when lesson generation modal is opened
   */
  const handleGenerateLesson = useCallback(() => {
    console.log('[DropdownComponents.tsx][3007] Lesson generation requested - Opening modal directly');
    setIsOpen(false);
    
    // Step 8: Open lesson generation modal directly - backend will handle subscription validation
    showModal('lessonGeneration', {
      docFileId: docFileID,
      onSuccess: (responseData: any) => {
        console.log('[DropdownComponents.tsx][3008] Lesson generation completed successfully from dropdown');
        handleGenerateLessonSuccess(responseData);
      }
    });
  }, [showModal, docFileID, handleGenerateLessonSuccess]);

  /**
   * handleCreateLesson
   * @description
   * Creates a new blank lesson using the existing lesson module system and navigates to it.
   * This function maintains the original lesson creation workflow while providing enhanced
   * logging for debugging and observability purposes.
   * @returns Promise resolving when blank lesson creation is complete
   */
  const handleCreateLesson = useCallback(() => {
    console.log('[DropdownComponents.tsx][3009] Creating blank lesson from dropdown');
    const { id } = addConceptMap('Untitled Lesson');
    setActiveConceptMapId(id);
    setActiveView('conceptMap');
    setIsOpen(false);
    console.log('[DropdownComponents.tsx][3010] Blank lesson created successfully - ID:', id);
  }, [addConceptMap, setActiveConceptMapId, setActiveView]);

  /**
   * handleLessonSelect
   * @description
   * Handles selection of existing lessons from the dropdown menu and navigates to the selected
   * lesson view. This function maintains the original lesson navigation workflow while providing
   * comprehensive logging for user interaction tracking and debugging purposes.
   * @param lessonId Unique identifier of the lesson to select and navigate to
   * @returns Promise resolving when lesson selection and navigation is complete
   */
  const handleLessonSelect = useCallback((lessonId: string) => {
    console.log('[DropdownComponents.tsx][3011] Lesson selected from dropdown - ID:', lessonId);
    setActiveConceptMapId(lessonId);
    setActiveView('conceptMap');
    setIsOpen(false);
  }, [setActiveConceptMapId, setActiveView]);

  /**
   * handleKeyDown
   * @description
   * Handles keyboard interactions for dropdown accessibility, specifically escape key presses
   * to close the dropdown. This maintains existing accessibility features while providing
   * proper keyboard navigation support for enhanced user experience.
   * @param event React keyboard event containing key press information
   * @returns Promise resolving when keyboard event processing is complete
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      console.log('[DropdownComponents.tsx][3012] Escape key pressed - Closing lessons dropdown');
      setIsOpen(false);
    }
  }, []);

  return (
    <div className="ch-nav__item" ref={dropdownRef}>
      {/* Step 9: Dropdown trigger button */}
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          console.log('[DropdownComponents.tsx][3013] Lessons dropdown toggled - Open:', next);
        }}
        onKeyDown={handleKeyDown}
        disabled={isGeneratingLesson}
      >
        <span>Lessons</span>
      </button>

      {/* Step 10: Dropdown menu content */}
      {isOpen && (
        <div
          role="menu"
          className="ch-menu"
          aria-label="Lessons menu"
          onKeyDown={handleKeyDown}
        >
          {/* Generate AI Lesson - preserved original styling */}
          <button
            role="menuitem"
            className="ch-menu__item ch-menu__item--primary"
            onClick={handleGenerateLesson}
            disabled={!docFileID}
            title="Generate AI-powered lesson"
          >
            <Sparkles size={16} />
            <span>Generate Lesson</span>
          </button>

          {/* Create Blank Lesson */}
          <button
            role="menuitem"
            className="ch-menu__item"
            onClick={handleCreateLesson}
          >
            <Plus size={16} />
            <span>Create Lesson</span>
          </button>

          {/* Divider */}
          {lessons.length > 0 && <div className="ch-menu__divider" />}

          {/* Existing Lessons with exclusive selection highlighting */}
          {lessons.map((lesson) => {
            const isActiveForView = activeView !== 'pdf' && lesson.id === activeConceptMapId;
            if (isActiveForView) {
              console.log('[DropdownComponents.tsx][3014] Lesson highlighted exclusively - ID:', lesson.id);
            }
            return (
              <button
                key={lesson.id}
                role="menuitem"
                className={`ch-menu__item ${isActiveForView ? 'ch-menu__item--active' : ''}`}
                onClick={() => handleLessonSelect(lesson.id)}
              >
                {/* Selection indicator: green dot when active, icon when not */}
                {isActiveForView ? (
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#5B8C5A',
                      borderRadius: '50%',
                      marginRight: '4px',
                    }}
                    aria-label="Currently selected lesson"
                  />
                ) : (
                  <FileText size={16} />
                )}
                <span>{lesson.title}</span>
              </button>
            );
          })}

          {/* Generating state indicator */}
          {isGeneratingLesson && (
            <div className="ch-menu__item ch-menu__item--disabled">
              <div className="ch-menu__loading">Generating lesson...</div>
            </div>
          )}
        </div>
      )}

      {/* Step 11: CRITICAL - Render centralized modal system */}
    
    </div>
  );
};

/**
 * UploadsDropdownProps
 * @description Props interface for the UploadsDropdown component
 */
interface UploadsDropdownProps {
  /** Optional callback triggered when file upload is successful */
  onFileUploaded?: (file: TextFileMessage) => void;
}

/**
 * UploadsDropdown
 * @description
 * Enhanced editable uploads dropdown that integrates with the centralized modal system for document
 * uploads, progress tracking, and navigation to the PDF viewer. This updated implementation replaces
 * direct file upload processing with centralized modal integration, ensuring consistent permission
 * checking, visibility controls, and error handling while maintaining existing visual design and
 * accessibility features.
 * @param onFileUploaded Optional callback triggered when file upload succeeds
 * @returns Enhanced uploads dropdown component with centralized modal integration
 */
export const UploadsDropdown: React.FC<UploadsDropdownProps> = ({ onFileUploaded }) => {
  // Step 1: Local UI state management
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Step 2: Context hooks for existing functionality
  const { getAllFiles } = useFileAsset();
  const { activeView, setSelectedPdfUrl, setActiveView } = useViewSwitch();

  // Step 3: Centralized modal integration
  const { showModal} = useGlobalModal();
  const { accountStatus } = useAccountStatus();

  // Step 4: Click-outside dismissal setup
  useClickOutside(dropdownRef, () => setIsOpen(false));

  // Step 5: Retrieve uploaded files data
  const uploadedFiles = getAllFiles();
  console.log('[DropdownComponents.tsx][3015] UploadsDropdown render - Count:', uploadedFiles.length, 'ActiveView:', activeView, 'SelectedFileId:', selectedFileId);

  /**
   * handleUploadClick
   * @description
   * Enhanced file upload handler that uses the centralized modal system with comprehensive
   * account-aware functionality. This function replaces direct file upload processing with
   * integration to the unified modal system, ensuring consistent permission checking, visibility
   * controls, and error handling that matches the NavigationPanel implementation.
   * @returns Promise resolving when file upload modal integration is complete
   */
  const handleUploadClick = useCallback(() => {
    console.log('[DropdownComponents.tsx][3016] File upload requested from dropdown - Opening centralized modal');
    setIsOpen(false);
    
    showModal('fileUpload', {
      onUploadSuccess: (file: File, isPublic: boolean) => {
        console.log('[DropdownComponents.tsx][3017] Upload successful via dropdown modal - File:', file.name, 'Public:', isPublic);
        
        // Step 6: Create file message for callback
        const fileMessage: TextFileMessage = {
          id: crypto.randomUUID(),
          type: file.type === 'application/pdf' ? 'pdf' : 'txt',
          title: file.name,
          serverUrl: '', // Will be populated by the modal system
          uploadDate: new Date(),
          size: file.size,
          accountType: accountStatus?.accountType || 'scholar',
        };
        
        // Step 7: Trigger external callback if provided
        onFileUploaded?.(fileMessage);
        console.log('[DropdownComponents.tsx][3018] File upload callback executed from dropdown');
      }
    });
  }, [showModal, accountStatus?.accountType, onFileUploaded]);

  /**
   * handleFileSelect
   * @description
   * Handles file selection from the dropdown menu and navigates to the PDF viewer. This function
   * maintains the original file navigation workflow while providing comprehensive logging for
   * user interaction tracking and debugging purposes.
   * @param file File object containing metadata for the selected file
   * @returns Promise resolving when file selection and navigation is complete
   */
  const handleFileSelect = useCallback((file: TextFileMessage) => {
    console.log('[DropdownComponents.tsx][3019] File selected from dropdown - Title:', file.title, 'Switching to PDF view');
    setSelectedPdfUrl(file.serverUrl);
    setSelectedFileId(file.id);
    setActiveView('pdf');
    setIsOpen(false);
  }, [setSelectedPdfUrl, setActiveView]);

  /**
   * handleKeyDown
   * @description
   * Handles keyboard interactions for dropdown accessibility, specifically escape key presses
   * to close the dropdown. This maintains existing accessibility features while providing
   * proper keyboard navigation support for enhanced user experience.
   * @param event React keyboard event containing key press information
   * @returns Promise resolving when keyboard event processing is complete
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      console.log('[DropdownComponents.tsx][3020] Escape key pressed - Closing uploads dropdown');
      setIsOpen(false);
    }
  }, []);

  return (
    <div className="ch-nav__item" ref={dropdownRef}>
      {/* Step 8: Dropdown trigger button */}
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          console.log('[DropdownComponents.tsx][3021] Uploads dropdown toggled - Open:', next);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>Uploads</span>
      </button>

      {/* Step 9: Dropdown menu content */}
      {isOpen && (
        <div
          role="menu"
          className="ch-menu"
          aria-label="Uploads menu"
          onKeyDown={handleKeyDown}
        >
          {/* Upload action with centralized modal integration */}
          <button
            role="menuitem"
            className="ch-menu__item ch-menu__item--primary"
            onClick={handleUploadClick}
          >
            <FolderOpen size={16} />
            <span>Upload Document</span>
          </button>

          {/* Divider */}
          {uploadedFiles.length > 0 && <div className="ch-menu__divider" />}

          {/* Empty state */}
          {uploadedFiles.length === 0 && (
            <div className="ch-menu__item ch-menu__item--disabled">
              <span className="ch-menu__empty">No files uploaded yet</span>
            </div>
          )}

          {/* File list with exclusive highlight gated by activeView */}
          {uploadedFiles.map((file) => {
            const isSelectedAndActive = activeView === 'pdf' && file.id === selectedFileId;
            if (isSelectedAndActive) {
              console.log('[DropdownComponents.tsx][3022] File highlighted exclusively - ID:', file.id);
            }
            return (
              <button
                key={file.id}
                role="menuitem"
                className={`ch-menu__item ${isSelectedAndActive ? 'ch-menu__item--active' : ''}`}
                onClick={() => handleFileSelect(file)}
              >
                {/* Selection indicator: green dot when active, icon when not */}
                {isSelectedAndActive ? (
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: '#5B8C5A',
                      borderRadius: '50%',
                      marginRight: '4px',
                    }}
                    aria-label="Currently selected file"
                  />
                ) : (
                  <FileText size={16} />
                )}
                <span>{file.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 10: CRITICAL - Render centralized modal system */}
    </div>
  );
};
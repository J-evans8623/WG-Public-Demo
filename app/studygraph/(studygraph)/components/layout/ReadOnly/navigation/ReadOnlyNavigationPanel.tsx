/***************************************************************************************
 * @file ReadOnlyNavigationPanel.tsx (Enhanced with Centralized Modals)
 * @description
 *   Enhanced read-only navigation panel that integrates with the centralized modal
 *   system for file upload capabilities while maintaining read-only constraints.
 *   This updated implementation preserves all existing visual design and interaction
 *   patterns while adding private file upload functionality through the unified
 *   modal system. The component allows users to upload private files (not counting
 *   as a write operation since only the user can see their own private uploads)
 *   but prevents lesson generation and content modification operations. The enhancement
 *   maintains the existing hover-based expansion, lesson viewing, and file navigation
 *   functionality while adding intelligent permission handling that only allows
 *   private file uploads. All modal interactions are handled through the centralized
 *   system with comprehensive error handling and user feedback. The component ensures
 *   consistent user experience while enforcing appropriate access restrictions for
 *   read-only document viewing scenarios.
 *
 * Responsibilities:
 *   - Maintain existing hover-based panel expansion and visual design
 *   - Handle private file uploads through centralized modal system
 *   - Display lessons and uploaded files in read-only mode
 *   - Enable navigation between lessons and PDF viewing
 *   - Prevent lesson generation and content editing operations
 *   - Support top-level view switching (home, map, user)
 *   - Provide seamless integration with centralized modal management system
 *   - Maintain comprehensive logging for debugging and user interaction tracking
 *
 * @author System
 * @date Current
 ***************************************************************************************/

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import { useModalManager } from '@/app/studygraph/(studygraph)/components/modals/AppModals';

/**
 * The top-level view types that can be displayed.
 */
type TopLevelView = 'home' | 'map' | 'user';

/**
 * @interface ReadOnlyNavigationPanelProps
 * @description Props for the ReadOnlyNavigationPanel component.
 * @property {boolean} [isManuallyOpen] - If true, the panel is forced open by manual toggle.
 * @property {TopLevelView} currentView - The currently active top-level view.
 * @property {(view: TopLevelView) => void} onSetView - Callback to set the top-level view.
 * @property {(expanded: boolean) => void} [onExpandedChange] - Optional callback to inform
 *           parent components of the panel's expanded/collapsed state.
 */
interface ReadOnlyNavigationPanelProps {
  isManuallyOpen?: boolean;
  currentView: TopLevelView;
  onSetView: (view: TopLevelView) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * @function ReadOnlyNavigationPanel
 * @description
 * Enhanced read-only navigation panel that integrates private file upload capabilities
 * through the centralized modal system while maintaining all read-only constraints.
 * The component allows users to upload private files (considered a safe operation
 * since only the uploader can view their private files) but prevents lesson generation
 * and any content modification operations. All file uploads are forced to private
 * visibility to maintain read-only document integrity.
 *
 * Steps:
 *   1. Initialize modal management system for private file uploads
 *   2. Preserve existing hover state and panel expansion logic
 *   3. Handle private file uploads through centralized modal with restricted visibility
 *   4. Maintain all existing lesson viewing and file navigation capabilities
 *   5. Prevent lesson generation and content editing operations
 *   6. Provide comprehensive logging for debugging and observability
 */
const ReadOnlyNavigationPanel: React.FC<ReadOnlyNavigationPanelProps> = ({
  isManuallyOpen = false,
  currentView,
  onSetView,
  onExpandedChange,
}) => {
  console.log('[ReadOnlyNavigationPanel.tsx][2001] ReadOnlyNavigationPanel rendering with centralized modal integration');

  // Step 1: Initialize modal management system for private uploads only
  const { showModal, ModalRenderer } = useModalManager();

  // Step 2: State management for panel expansion
  const [isHoveredOpen, setIsHoveredOpen] = useState(false);
  const isExpanded = isHoveredOpen || isManuallyOpen;

  // Step 3: Context hooks for existing functionality
  const { setActiveView, setSelectedPdfUrl } = useViewSwitch();
  const {
    getLessonModule,
    activeConceptMapId,
    setActiveConceptMapId,
  } = useLessonModule();
  
  const lessons = getLessonModule().conceptMaps || [];
  const { getAllFiles, addFile } = useFileAsset();
  const { clearSelection } = useNodeSelection();
  const { getFileName, docFileID } = useYDoc();
  const ydocFileName = getFileName();

  // Step 4: Notify parent of expansion state changes
  useEffect(() => {
    if (onExpandedChange) {
      onExpandedChange(isExpanded);
      console.log('[ReadOnlyNavigationPanel.tsx][2002] Expansion state changed:', isExpanded);
    }
  }, [isExpanded, onExpandedChange]);

  // Step 5: Auto-select first lesson on document load
  useEffect(() => {
    if (!docFileID) return;
    if (lessons.length === 0) return;
    
    setActiveConceptMapId(lessons[0].id);
    console.log('[ReadOnlyNavigationPanel.tsx][2003] Auto-selected first lesson:', lessons[0].id);
  }, [docFileID, lessons, setActiveConceptMapId]);

  /**
   * @function handleMouseEnter
   * @description
   * Set hover state to open panel and log interaction for debugging purposes.
   * Maintains existing behavior while adding observability for user interactions.
   */
  const handleMouseEnter = useCallback(() => {
    setIsHoveredOpen(true);
    console.log('[ReadOnlyNavigationPanel.tsx][2004] Panel hover expansion triggered');
  }, []);

  /**
   * @function handleMouseLeave
   * @description
   * Clear hover state to collapse panel when user moves mouse away.
   * Preserves existing behavior with enhanced state cleanup for better UX.
   */
  const handleMouseLeave = useCallback(() => {
    setIsHoveredOpen(false);
    console.log('[ReadOnlyNavigationPanel.tsx][2005] Panel hover collapse triggered');
  }, []);

  /**
   * @function handleHomeClick
   * @description
   * Navigate to home view with logging for user journey tracking.
   * Maintains existing navigation behavior with enhanced observability.
   */
  const handleHomeClick = useCallback(() => {
    onSetView('home');
    console.log('[ReadOnlyNavigationPanel.tsx][2006] Navigation to home view requested');
  }, [onSetView]);

  /**
   * @function handleProfileClick
   * @description
   * Navigate to user profile view with comprehensive interaction logging.
   * Preserves existing functionality while adding debugging capabilities.
   */
  const handleProfileClick = useCallback(() => {
    onSetView('user');
    console.log('[ReadOnlyNavigationPanel.tsx][2007] Navigation to user profile requested');
  }, [onSetView]);

  /**
   * @function handleLessonClick
   * @description
   * Handle lesson selection with view switching and selection management.
   * Preserves existing lesson navigation behavior with comprehensive state coordination.
   */
  const handleLessonClick = useCallback((lessonId: string) => {
    onSetView('map');
    setActiveView('conceptMap');
    if (activeConceptMapId !== lessonId) {
      clearSelection();
    }
    setActiveConceptMapId(lessonId);
    console.log('[ReadOnlyNavigationPanel.tsx][2008] Lesson selected:', lessonId);
  }, [onSetView, setActiveView, activeConceptMapId, clearSelection, setActiveConceptMapId]);

  /**
   * @function handleFileEntryClick
   * @description
   * Handle file selection with automatic PDF viewer navigation and state management.
   * Maintains existing file interaction behavior with enhanced view coordination.
   */
  const handleFileEntryClick = useCallback((file: TextFileMessage) => {
    onSetView('map');
    setSelectedPdfUrl(file.serverUrl);
    setActiveView('pdf');
    console.log('[ReadOnlyNavigationPanel.tsx][2009] File selected for PDF view:', file.title);
  }, [onSetView, setActiveView, setSelectedPdfUrl]);

  /**
   * @function handlePrivateUploadClick
   * @description
   * Enhanced private file upload handler that uses centralized modal system with
   * read-only appropriate restrictions. Forces all uploads to private visibility
   * to maintain document integrity while allowing users to upload files for their
   * own viewing. Provides comprehensive error handling and user feedback through
   * the centralized modal system.
   */
  const handlePrivateUploadClick = useCallback(() => {
    console.log('[ReadOnlyNavigationPanel.tsx][2010] Private file upload requested, opening centralized modal');
    
    showModal('fileUpload', {
      onUploadSuccess: (file: File, isPublic: boolean) => {
        console.log('[ReadOnlyNavigationPanel.tsx][2011] Private upload successful via modal:', file.name);
        
        // Step 6: Process upload through existing file asset system (forced private)
        addFile(file, { visibility: isPublic ? 'public' : 'private' }).then(() => {
          console.log('[ReadOnlyNavigationPanel.tsx][2012] Private file added to asset context successfully');
        }).catch((error) => {
          console.error('[ReadOnlyNavigationPanel.tsx][2013] Private file upload processing failed:', error);
        });
      }
    });
  }, [showModal, addFile]);

  return (
    <div className="relative">
      {/* Step 7: Hover trigger strip for panel expansion */}
      <div
        className="fixed left-0 top-0 w-4 h-screen z-50 bg-transparent"
        onMouseEnter={handleMouseEnter}
      />

      {/* Step 8: Main navigation panel container with enhanced functionality */}
      <div
        className={`
          fixed
          left-0
          top-1/2
          -translate-y-1/2
          bg-white
          shadow-lg
          transition-all
          duration-300
          ease-in-out
          z-50
        `}
        onMouseLeave={handleMouseLeave}
        style={{
          width: isExpanded ? '20rem' : '0',
          height: 'auto',
          maxHeight: '80vh',
          overflow: 'hidden',
          border: '1px solid #E8E7E5'
        }}
      >
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex items-center p-4 border-b">
            <div className="w-8 h-8 flex items-center justify-center bg-orange-500 text-white rounded mr-3">
              <span className="font-bold">B</span>
            </div>
            <span className="font-semibold text-gray-800">BloomMap</span>
            <span className="text-xs text-blue-600 ml-2">Read-Only</span>
          </div>

          {/* Primary navigation */}
          <nav className="py-2">
            {/* Home navigation */}
            <div
              className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 cursor-pointer"
              onClick={handleHomeClick}
            >
              <div className="w-6 h-6 mr-3 flex items-center justify-center text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
              <span>Home</span>
            </div>

            {/* Workspace Section with read-only constraints */}
            <div>
              <div className="flex items-center px-4 py-3 text-gray-700">
                <div className="flex items-center">
                  <div className="w-6 h-6 mr-3 flex items-center justify-center text-gray-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                  </div>
                  <span>Workspace</span>
                </div>
              </div>

              <div className="bg-gray-50 py-1">
                {/* File name display (read-only) */}
                <div className="px-4 py-2 border-b border-gray-200">
                  <div className="flex items-center text-blue-800">
                    <div className="flex justify-center w-full">
                      <span className="font-medium" title="Document name (read-only)">
                        {ydocFileName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lessons Section (read-only viewing) */}
                <div className="mt-2">
                  <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-700 font-medium">
                    <span>Lessons</span>
                    {/* No lesson generation in read-only mode */}
                  </div>

                  {/* Scrollable lessons list */}
                  <div className="max-h-20 overflow-y-auto scrollbar-thin">
                    {lessons.map((lesson) => {
                      const isSelected = activeConceptMapId === lesson.id;
                      return (
                        <div
                          key={lesson.id}
                          className={`pl-4 pr-2 py-2 hover:bg-gray-200 cursor-pointer ${
                            isSelected ? 'bg-gray-200' : ''
                          }`}
                          onClick={() => handleLessonClick(lesson.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 mr-2 text-gray-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                              </svg>
                              <span className="text-sm">{lesson.title}</span>
                            </div>
                            {/* No edit/delete buttons in read-only mode */}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Enhanced Uploads Section with private upload capability */}
                <div className="mt-2">
                  <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-700 font-medium">
                    <span>Uploads</span>
                    <button
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500"
                      title="Upload private file"
                      onClick={handlePrivateUploadClick}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Scrollable uploads list */}
                  <div className="max-h-20 overflow-y-auto scrollbar-thin">
                    {getAllFiles().length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500">
                        Upload private files: PDF, PPTX, DOCX, or TXT files.
                      </div>
                    ) : (
                      getAllFiles().map((file) => (
                        <div
                          key={file.id}
                          className="pl-4 pr-2 py-2 hover:bg-gray-200 cursor-pointer flex items-center"
                          onClick={() => handleFileEntryClick(file)}
                        >
                          <FileText className="w-4 h-4 text-red-500 mr-2" />
                          <span className="text-sm truncate flex-1">{file.title}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-2" />
                </div>
              </div>
            </div>

            {/* Profile navigation */}
            <div
              className="flex items-center px-4 py-1 text-gray-700 hover:bg-gray-100 cursor-pointer"
              onClick={handleProfileClick}
            >
              <div className="w-6 h-6 mr-3 flex items-center justify-center text-gray-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span>Profile</span>
            </div>
          </nav>
        </div>
      </div>

      {/* Step 9: Render centralized modal system */}
      <ModalRenderer />
    </div>
  );
};

export default ReadOnlyNavigationPanel;
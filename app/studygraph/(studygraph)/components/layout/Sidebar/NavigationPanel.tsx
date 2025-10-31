/***************************************************************************************
 * @file NavigationPanel.tsx (Enhanced with Centralized Modals)
 * @description
 *   Enhanced left-aligned navigation panel that integrates with the centralized modal
 *   system for premium feature management and account-aware functionality. This updated
 *   implementation maintains all existing visual design and interaction patterns while
 *   adding sophisticated account status integration that conditionally renders features
 *   based on user subscription tiers and account types. The panel now uses the unified
 *   modal system for file uploads, lesson generation, and subscription prompts, ensuring
 *   consistent user experience and proper permission enforcement throughout the application.
 *   The enhancement preserves the existing hover-based expansion, file name editing,
 *   lesson management, and upload functionality while implementing backend-driven error
 *   handling that allows the modal to open first and subscription validation to occur
 *   at the API level through the event-driven error handling system.
 *
 * Responsibilities:
 *   - Maintain existing hover-based panel expansion and visual design
 *   - Handle file uploads through centralized modal system with visibility controls
 *   - Manage lesson generation with backend-driven subscription validation
 *   - Display subscription upgrade prompts through event-driven error handling
 *   - Preserve all existing lesson management and file interaction functionality
 *   - Provide seamless integration with centralized modal management system
 *   - Maintain comprehensive logging for debugging and user interaction tracking
 *
 * @author System
 * @date Current
 ***************************************************************************************/

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Pencil, Trash2, FolderOpen, FileText, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLessonData } from '@/app/Library/Context/LessonDataContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useViewSwitch } from '@/app/Library/Context/pdf/ViewSwitchContext';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import { useGlobalModal } from '@/app/studygraph/(studygraph)/components/modals/GlobalModalProvider'
import { useAccountStatus } from '@/app/src/context/ApiContext';

/**
 * The top-level view types that can be displayed.
 */
type TopLevelView = 'home' | 'map' | 'user';

/**
 * @interface NavigationPanelProps
 * @description Props for the NavigationPanel component.
 * @property {boolean} [isManuallyOpen] - If true, the panel is forced open by manual toggle.
 * @property {TopLevelView} currentView - The currently active top-level view.
 * @property {(view: TopLevelView) => void} onSetView - Callback to set the top-level view.
 * @property {(expanded: boolean) => void} [onExpandedChange] - Optional callback to inform
 *           parent components of the panel's expanded/collapsed state.
 */
interface NavigationPanelProps {
  isManuallyOpen?: boolean;
  currentView: TopLevelView;
  onSetView: (view: TopLevelView) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * @function NavigationPanel
 * @description
 * Enhanced navigation panel that integrates account status management with centralized
 * modal system for sophisticated feature gating and user experience optimization. The
 * component maintains all existing functionality while implementing backend-driven
 * subscription validation where modals open first and subscription checking occurs
 * at the API level through the event-driven error handling system.
 *
 * Steps:
 *   1. Initialize account status and modal management systems
 *   2. Preserve existing hover state and panel expansion logic
 *   3. Handle file uploads through centralized modal with permission validation
 *   4. Manage lesson generation with backend-driven subscription validation
 *   5. Maintain all existing lesson management and file interaction capabilities
 */
const NavigationPanel: React.FC<NavigationPanelProps> = ({
  isManuallyOpen = false,
  currentView,
  onSetView,
  onExpandedChange,
}) => {
  console.log('[NavigationPanel.tsx][9001] NavigationPanel rendering with enhanced modal integration');

  // Step 1: Initialize account status and modal management
  const { accountStatus } = useAccountStatus();
  const { showModal} = useGlobalModal ();

  // Step 2: State management for panel expansion and interactions
  const [isHoveredOpen, setIsHoveredOpen] = useState(false);
  const isExpanded = isHoveredOpen || isManuallyOpen;

  // Step 3: Context hooks for existing functionality
  const { setActiveView, setSelectedPdfUrl } = useViewSwitch();
  const {
    getLessonModule,
    addConceptMap,
    deleteConceptMap,
    activeConceptMapId,
    setActiveConceptMapId,
    updateConceptMapTitle,
    isGeneratingLesson,
  } = useLessonModule();
  
  const lessons = useMemo(
  () => getLessonModule().conceptMaps ?? [],
  [getLessonModule]
);
  const { getAllFiles, addFile, addGeneratedLessonFile } = useFileAsset();
  const { clearSelection } = useNodeSelection();
  const { getFileName, updateFileName, docFileID } = useYDoc();
  const ydocFileName = getFileName();
  const { addLessonModule } = useLessonData();

  // Step 4: Local state for existing functionality
  const [editingFileName, setEditingFileName] = useState(false);
  const [fileNameDraft, setFileNameDraft] = useState(ydocFileName);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lesson: any } | null>(null);

  // Step 5: Notify parent of expansion state changes
  useEffect(() => {
    if (onExpandedChange) {
      onExpandedChange(isExpanded);
    }
  }, [isExpanded, onExpandedChange]);

  // Step 6: Sync file name draft with global document name
  useEffect(() => {
    setFileNameDraft(ydocFileName);
  }, [ydocFileName]);

  // Step 7: Auto-select first lesson on document load
  useEffect(() => {
    if (!docFileID) return;
    if (lessons.length === 0) return;
    
    setActiveConceptMapId(lessons[0].id);
    console.log('[NavigationPanel.tsx][9002] Auto-selected first lesson:', lessons[0].id);
  }, [docFileID, lessons, setActiveConceptMapId]);

  // Step 8: Handle global clicks to close context menu
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);

  /**
   * @function handleMouseEnter
   * @description
   * Set hover state to open panel and log interaction for debugging purposes.
   * Maintains existing behavior while adding observability for user interactions.
   */
  const handleMouseEnter = useCallback(() => {
    setIsHoveredOpen(true);
    console.log('[NavigationPanel.tsx][9003] Panel hover expansion triggered');
  }, []);

  /**
   * @function handleMouseLeave
   * @description
   * Clear hover state and any active lesson editing state to maintain clean UI.
   * Preserves existing behavior with enhanced state cleanup for better UX.
   */
  const handleMouseLeave = useCallback(() => {
    setIsHoveredOpen(false);
    setEditingLessonId(null);
    console.log('[NavigationPanel.tsx][9004] Panel hover collapse triggered');
  }, []);

  /**
   * @function handleHomeClick
   * @description
   * Navigate to home view with logging for user journey tracking.
   * Maintains existing navigation behavior with enhanced observability.
   */
  const handleHomeClick = useCallback(() => {
    onSetView('home');
    console.log('[NavigationPanel.tsx][9005] Navigation to home view requested');
  }, [onSetView]);

  /**
   * @function handleProfileClick
   * @description
   * Navigate to user profile view with comprehensive interaction logging.
   * Preserves existing functionality while adding debugging capabilities.
   */
  const handleProfileClick = useCallback(() => {
    onSetView('user');
    console.log('[NavigationPanel.tsx][9006] Navigation to user profile requested');
  }, [onSetView]);

  /**
   * @function handleFileNameSave
   * @description
   * Persist updated file name to YDoc context and exit editing mode.
   * Maintains existing file name editing functionality with enhanced logging.
   */
  const handleFileNameSave = useCallback(() => {
    updateFileName(fileNameDraft);
    setEditingFileName(false);
    console.log('[NavigationPanel.tsx][9007] File name updated to:', fileNameDraft);
  }, [fileNameDraft, updateFileName]);

  /**
   * @function handleAddLesson
   * @description
   * Add new concept map lesson with default title using existing lesson module system.
   * Preserves original functionality while providing comprehensive interaction logging.
   */
  const handleAddLesson = useCallback(() => {
    addConceptMap('Untitled Lesson');
    console.log('[NavigationPanel.tsx][9008] New lesson created with default title');
  }, [addConceptMap]);

  /**
   * @function startEditingLesson
   * @description
   * Initialize lesson title editing mode with proper state management and logging.
   * Maintains existing lesson editing capabilities with enhanced user interaction tracking.
   */
  const startEditingLesson = useCallback((lesson: any) => {
    setEditingLessonId(lesson.id);
    setEditingTitle(lesson.title);
    console.log('[NavigationPanel.tsx][9009] Lesson editing initiated for:', lesson.id);
  }, []);

  /**
   * @function handleLessonTitleSave
   * @description
   * Save edited lesson title to lesson module context with validation and cleanup.
   * Preserves existing title editing functionality with comprehensive state management.
   */
  const handleLessonTitleSave = useCallback(() => {
    if (editingLessonId && editingTitle.trim()) {
      updateConceptMapTitle(editingLessonId, editingTitle);
      setEditingLessonId(null);
      setEditingTitle('');
      console.log('[NavigationPanel.tsx][9010] Lesson title saved:', editingTitle);
    }
  }, [editingLessonId, editingTitle, updateConceptMapTitle]);

  /**
   * @function handleDeleteLesson
   * @description
   * Delete lesson from lesson module context with proper cleanup and logging.
   * Maintains existing lesson deletion capabilities with enhanced error tracking.
   */
  const handleDeleteLesson = useCallback((lessonId: string) => {
    deleteConceptMap(lessonId);
    console.log('[NavigationPanel.tsx][9011] Lesson deleted:', lessonId);
  }, [deleteConceptMap]);

  /**
   * @function handleLessonClick
   * @description
   * Handle lesson selection with view switching and selection management.
   * Preserves existing lesson navigation behavior with comprehensive state coordination.
   */
  const handleLessonClick = useCallback((lessonId: string) => {
    onSetView('map');
    setActiveView('conceptMap');
    if (!editingLessonId) {
      if (activeConceptMapId !== lessonId) {
        clearSelection();
      }
      setActiveConceptMapId(lessonId);
    }
    console.log('[NavigationPanel.tsx][9012] Lesson selected:', lessonId);
  }, [onSetView, setActiveView, editingLessonId, activeConceptMapId, clearSelection, setActiveConceptMapId]);

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
    console.log('[NavigationPanel.tsx][9013] File selected for PDF view:', file.title);
  }, [onSetView, setActiveView, setSelectedPdfUrl]);

  /**
   * @function handleUploadClick
   * @description
   * Enhanced file upload handler that uses centralized modal system with account-aware
   * functionality. Provides proper permission checking and upgrade prompts for restricted
   * features while maintaining seamless user experience through comprehensive error handling.
   */
  const handleUploadClick = useCallback(() => {
    console.log('[NavigationPanel.tsx][9014] File upload requested, opening centralized modal');
    
    showModal('fileUpload',
       {
      onUploadSuccess: (file: File, isPublic: boolean) => {
        console.log('[NavigationPanel.tsx][9015] Upload successful via modal:', file.name, 'public:', isPublic);
        
        // Step 9: Process upload through existing file asset system
        addFile(file, { visibility: isPublic ? 'public' : 'private' }).then(() => {
          console.log('[NavigationPanel.tsx][9016] File added to asset context successfully');
        }).catch((error) => {
          console.error('[NavigationPanel.tsx][9017] File upload processing failed:', error);
        });
      }
    });
  }, [showModal, addFile]);

  /**
   * @function handleGenerateLessonSuccess
   * @description
   * Process successful lesson generation response by updating file asset and lesson
   * data contexts. Maintains existing lesson generation workflow while providing
   * comprehensive logging and error handling for production reliability.
   */
  const handleGenerateLessonSuccess = useCallback((responseData: any) => {
    console.log('[NavigationPanel.tsx][9018] Processing lesson generation response:', responseData);

    try {
      // Step 10: Convert response to TextFileMessage format
      const generatedFileMessage: TextFileMessage = {
        id: responseData.id,
        type: 'pdf',
        title: responseData.title,
        serverUrl: responseData.url,
        uploadDate: new Date(),
        size: responseData.size,
        visibility: responseData.visibility || 'private',
        ownerId: responseData.owner,
        accountType: accountStatus?.accountType || 'scholar',
      };

      // Step 11: Update file asset context
      addGeneratedLessonFile(generatedFileMessage);
      console.log('[NavigationPanel.tsx][9019] Generated file added to asset context');

      // Step 12: Update lesson data context if lesson modules provided
      if (responseData.id && responseData.lessonModules) {
        addLessonModule(responseData.id, { lessonModules: responseData.lessonModules });
        console.log('[NavigationPanel.tsx][9020] Lesson modules added to data context');
      }
    } catch (error) {
      console.error('[NavigationPanel.tsx][9021] Error processing lesson generation response:', error);
    }
  }, [accountStatus?.accountType, addGeneratedLessonFile, addLessonModule]);

  /**
   * @function handleGenerateLessonClick
   * @description
   * Backend-driven lesson generation handler that opens the lesson generation modal directly,
   * allowing the backend to handle subscription validation and trigger appropriate error modals
   * through the event system. This follows the specified workflow where the modal opens first
   * and subscription checking occurs at the API level.
   */
  const handleGenerateLessonClick = useCallback(() => {
    console.log('[NavigationPanel.tsx][9022] Lesson generation requested - Opening modal directly');
    
    // Step 13: Open lesson generation modal directly - backend will handle subscription validation
    showModal('lessonGeneration', {
      docFileId: docFileID,
      onSuccess: (responseData: any) => {
        console.log('[NavigationPanel.tsx][9023] Lesson generation completed successfully');
        handleGenerateLessonSuccess(responseData);
      }
    });
  }, [showModal, docFileID, handleGenerateLessonSuccess]);


  return (
    <div className="relative">
      {/* Step 14: Hover trigger strip for panel expansion */}
      <div
        className="fixed left-0 top-0 w-4 h-screen z-50 bg-transparent"
        onMouseEnter={handleMouseEnter}
      />

      {/* Step 15: Main navigation panel container with enhanced functionality */}
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
              <span className="font-bold">W</span>
            </div>
            <span className="font-semibold text-gray-800">Wisegraph</span>
           
          </div>

          {/* Primary navigation with enhanced functionality */}
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

            {/* Workspace Section with enhanced features */}
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
                {/* File name editing section */}
                <div className="px-4 py-2 border-b border-gray-200">
                  <div className="flex items-center text-blue-800">
                    {editingFileName ? (
                      <Input
                        value={fileNameDraft}
                        onChange={(e) => setFileNameDraft(e.target.value)}
                        onBlur={handleFileNameSave}
                        onKeyPress={(e) => e.key === 'Enter' && handleFileNameSave()}
                        className="text-sm h-6 py-1 flex-1"
                        autoFocus
                      />
                    ) : (
                      <div className="flex justify-center w-full">
                        <span
                          className="font-medium cursor-text"
                          title="Click to edit file name"
                          onClick={() => setEditingFileName(true)}
                        >
                          {ydocFileName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Enhanced Lessons Section with original button design */}
                <div className="mt-2">
                  <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-700 font-medium">
                    <span>Lessons</span>
                    <div className="flex items-center space-x-2">
                      <button
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500"
                        title="Add new lesson"
                        onClick={handleAddLesson}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      {/* Original lesson generation button design - no premium indicators */}
                      <button
                        className="p-1 rounded hover:bg-gray-200 text-gray-500"
                        title="Generate Lesson"
                        onClick={handleGenerateLessonClick}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {isGeneratingLesson && (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      Generating lesson module...
                    </div>
                  )}

                  {/* Scrollable lessons list */}
                  <div className="max-h-20 overflow-y-auto scrollbar-thin">
                    {lessons.map((lesson) => {
                      const isSelected = activeConceptMapId === lesson.id;
                      return (
                        <div
                          key={lesson.id}
                          className={`pl-4 pr-2 py-2 hover:bg-gray-200 cursor-pointer group ${
                            isSelected ? 'bg-gray-200' : ''
                          }`}
                          onClick={() => handleLessonClick(lesson.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, lesson });
                          }}
                        >
                          {editingLessonId === lesson.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleLessonTitleSave();
                              }}
                              className="flex items-center"
                            >
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(ev) => setEditingTitle(ev.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="ml-1 text-green-600 hover:text-green-800"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </form>
                          ) : (
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
                              <div className="hidden group-hover:flex items-center">
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    startEditingLesson(lesson);
                                  }}
                                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-300 text-gray-500"
                                  title="Edit lesson"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    handleDeleteLesson(lesson.id);
                                  }}
                                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-300 text-gray-500 ml-1"
                                  title="Delete lesson"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Enhanced Uploads Section with centralized modal integration */}
                <div className="mt-2">
                  <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-700 font-medium">
                    <span>Uploads</span>
                    <button
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500"
                      title="Upload new file"
                      onClick={handleUploadClick}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Scrollable uploads list */}
                  <div className="max-h-20 overflow-y-auto scrollbar-thin">
                    {getAllFiles().length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500">
                        Supported file types: PDF, PPTX, DOCX, or TXT files.
                      </div>
                    ) : (
                      getAllFiles().map((file) => (
                        <div
                          key={file.id}
                          className="pl-4 pr-2 py-2 hover:bg-gray-200 cursor-pointer flex items-center group"
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

{/* Context Menu for lesson actions */}
      {contextMenu && (
        <div
          className="absolute bg-white border border-gray-200 shadow-md z-50"
          style={{ top: contextMenu.y, left: contextMenu.x, width: '8rem' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="py-1">
            <button
              className="flex items-center w-full px-2 py-1 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                startEditingLesson(contextMenu.lesson);
                setContextMenu(null);
              }}
            >
              <Pencil className="w-3 h-3 mr-2" />
              Edit
            </button>
            <button
              className="flex items-center w-full px-2 py-1 hover:bg-gray-100 text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteLesson(contextMenu.lesson.id);
                setContextMenu(null);
              }}
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavigationPanel;
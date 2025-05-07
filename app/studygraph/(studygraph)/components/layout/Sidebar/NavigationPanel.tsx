/***************************************************************************************
 * @file NavigationPanel.tsx
 * @description
 *   A left-aligned navigation panel, now truly centered in the browser viewport using
 *   fixed positioning. We removed the fixed height in favor of a flexible auto height
 *   plus max-height: 80vh. This ensures:
 *     - The panel can grow to display content.
 *     - It's centered vertically (top: 50%, transform: translateY(-50%)) in the viewport.
 *
 *   CHANGE: We now remove the outer scrollbar from the entire panel by setting
 *   overflow to hidden, and instead assign individual scrollbars to the lesson and PDF
 *   upload sections. In this design the following three sections nested in the workspace
 *   are always visible:
 *      - File name editing
 *      - Lessons section
 *      - PDF Uploads section
 *
 *   Additionally, the workspace is no longer collapsible and is always expanded.
 *
 *   In addition, this panel controls both top-level view switching (home, map, user)
 *   and canvas-level modes (conceptMap, pdf). When a lesson is clicked, we set the app
 *   view to 'map' and the canvas to 'conceptMap'. When a PDF file is clicked, we set
 *   the app view to 'map' and the canvas to 'pdf'.
 *
 *   FINAL CHANGE:
 *   ------------------------------------------------------------------
 *   1. Removed the dashed box under the PDF Uploads section.
 *   2. Added a concise professional message (only shown when no files have been uploaded).
 *   3. Preserved the max-h-20 change from the previously large 40px.
 *
 * @author
 * @date
 ***************************************************************************************/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Trash2, FolderOpen, FileText, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLessonData } from '@/app/Library/Context/LessonDataContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import GenerateLessonModal from '@/app/studygraph/(studygraph)/components/layout/ResourcePanel/GenerateLessonModal';

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
 *   Renders the collapsible/hover-expandable navigation panel on the left side of the screen.
 *   Also handles file name editing, lesson creation/deletion, PDF uploads, and generating
 *   lesson data. Notifies the parent component about its expanded state via `onExpandedChange`.
 *
 * Steps:
 *   1. Manage hover state to show/hide the panel.
 *   2. Manage lesson creation, editing, and deletion.
 *   3. Manage file uploads and display of existing files.
 *   4. Optionally generate lessons via the GenerateLessonModal.
 *   5. Provide context menu actions for lessons (edit, delete).
 *   6. Invoke `onExpandedChange` whenever the panel's expanded state changes.
 */
const NavigationPanel: React.FC<NavigationPanelProps> = ({
  isManuallyOpen = false,
  currentView,
  onSetView,
  onExpandedChange,
}) => {
  // State to track hover-based expansion.
  const [isHoveredOpen, setIsHoveredOpen] = useState(false);

  /**
   * Derive the final expansion state from hover + manual toggle.
   */
  const isExpanded = isHoveredOpen || isManuallyOpen;

  // Provide expansion state back to the parent if needed.
  useEffect(() => {
    if (onExpandedChange) {
      onExpandedChange(isExpanded);
    }
  }, [isExpanded, onExpandedChange]);

  // Hooks and contexts.
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
  
  const lessons = getLessonModule().conceptMaps || [];

  const { getAllFiles, addFile, addGeneratedLessonFile } = useFileAsset();
  const { clearSelection } = useNodeSelection();
  const { getFileName, updateFileName, docFileID } = useYDoc();
  const ydocFileName = getFileName();
  const { addLessonModule } = useLessonData();

  // Local states for editing file names and lessons.
  const [editingFileName, setEditingFileName] = useState(false);
  const [fileNameDraft, setFileNameDraft] = useState(ydocFileName);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal for lesson generation
  const [showGenerateLessonModal, setShowGenerateLessonModal] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lesson: any } | null>(
    null
  );

  /**
   * Keep the fileNameDraft in sync with the global doc name.
   */
  useEffect(() => {
    setFileNameDraft(ydocFileName);
  }, [ydocFileName]);

  useEffect(() => {
    if (!docFileID) return;            // only run after a real load
    if (lessons.length === 0) return;  // no lessons, nothing to select
    
    // Pick the first lesson in this document
    setActiveConceptMapId(lessons[0].id);
  }, [docFileID, lessons, setActiveConceptMapId]);

  /**
   * Simulate upload progress while uploading.
   */
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isUploading && uploadProgress < 100) {
      timer = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.floor(Math.random() * 10 + 5), 95));
      }, 300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isUploading, uploadProgress]);

  /**
   * Close any open context menu if a global click occurs outside.
   */
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
   * @description Set hover state to open panel.
   */
  const handleMouseEnter = useCallback(() => {
    setIsHoveredOpen(true);
  }, []);

  /**
   * @function handleMouseLeave
   * @description Clear hover state and any lesson editing state.
   */
  const handleMouseLeave = useCallback(() => {
    setIsHoveredOpen(false);
    setEditingLessonId(null);
  }, []);

  /**
   * @function handleHomeClick
   * @description Switch top-level view to 'home'.
   */
  const handleHomeClick = useCallback(() => {
    onSetView('home');
  }, [onSetView]);

  /**
   * @function handleProfileClick
   * @description Switch top-level view to 'user'.
   */
  const handleProfileClick = useCallback(() => {
    onSetView('user');
  }, [onSetView]);

  /**
   * @function handleFileNameSave
   * @description Persist the updated file name to YDoc.
   */
  const handleFileNameSave = useCallback(() => {
    updateFileName(fileNameDraft);
    setEditingFileName(false);
  }, [fileNameDraft, updateFileName]);

  /**
   * @function handleAddLesson
   * @description Add a new concept map lesson with a default title.
   */
  const handleAddLesson = useCallback(() => {
    addConceptMap('Untitled Lesson');
  }, [addConceptMap]);

  /**
   * @function startEditingLesson
   * @description Enable edit mode for a specific lesson, populating draft title.
   */
  const startEditingLesson = useCallback((lesson: any) => {
    setEditingLessonId(lesson.id);
    setEditingTitle(lesson.title);
  }, []);

  /**
   * @function handleLessonTitleSave
   * @description Save the edited lesson title to the LessonModule context.
   */
  const handleLessonTitleSave = useCallback(() => {
    if (editingLessonId && editingTitle.trim()) {
      updateConceptMapTitle(editingLessonId, editingTitle);
      setEditingLessonId(null);
      setEditingTitle('');
    }
  }, [editingLessonId, editingTitle, updateConceptMapTitle]);

  /**
   * @function handleDeleteLesson
   * @description Delete a lesson from the LessonModule context.
   */
  const handleDeleteLesson = useCallback(
    (lessonId: string) => {
      deleteConceptMap(lessonId);
    },
    [deleteConceptMap]
  );

  /**
   * @function handleLessonClick
   * @description Switch view to 'map', ensure the correct concept map is active,
   *              and clear node selection if switching to a different lesson.
   */
  const handleLessonClick = useCallback(
    (lessonId: string) => {
      onSetView('map');
      setActiveView('conceptMap');
      if (!editingLessonId) {
        if (activeConceptMapId !== lessonId) {
          clearSelection();
        }
        setActiveConceptMapId(lessonId);
      }
    },
    [onSetView, setActiveView, editingLessonId, activeConceptMapId, clearSelection, setActiveConceptMapId]
  );

  /**
   * @function handleFileUpload
   * @description Handle the user uploading PDF/DOCX/TXT files, add them to FileAssetContext.
   */
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);
        setCurrentFileName(files[0].name);

        try {
          // Upload all files asynchronously.
          await Promise.all(Array.from(files).map((file) => addFile(file)));
          setUploadProgress(100);
          setTimeout(() => {
            setIsUploading(false);
            event.target.value = '';
          }, 1000);
        } catch (error) {
          console.error('File upload failed:', error);
          setIsUploading(false);
        }
      }
    },
    [addFile]
  );

  /**
   * @function handleFileEntryClick
   * @description Switch to 'map' view and show the clicked PDF in the PDF canvas.
   */
  const handleFileEntryClick = useCallback(
    (file: TextFileMessage) => {
      onSetView('map');
      setSelectedPdfUrl(file.serverUrl);
      setActiveView('pdf');
    },
    [onSetView, setActiveView, setSelectedPdfUrl]
  );

  /**
   * @function handleGenerateLessonSuccess
   * @description
   *   Callback invoked when GenerateLessonModal successfully generates lesson data.
   *   Updates FileAssetContext with the returned file info and updates LessonDataContext
   *   with the lesson module list data.
   */
  const handleGenerateLessonSuccess = useCallback(
    (responseData: any) => {
      console.log('[ResourcePanel] handleGenerateLessonSuccess - Response data received:', responseData);

      // Convert the backend response into a valid TextFileMessage.
      const generatedFileMessage: TextFileMessage = {
        id: responseData.id,
        type: 'pdf', // The backend always returns the file as a PDF.
        title: responseData.title,
        serverUrl: responseData.url,
        uploadDate: new Date(),
        size: responseData.size,
      };
      console.log('[ResourcePanel] Creating TextFileMessage from responseData:', generatedFileMessage);

      // Update FileAssetContext with the generated file message.
      addGeneratedLessonFile(generatedFileMessage);
      console.log('[ResourcePanel] addGeneratedLessonFile called. FileAssetContext updated.');

      // Update LessonDataContext with the lesson modules.
      if (responseData.id && responseData.lessonModules) {
        console.log(
          '[ResourcePanel] Updating LessonDataContext with fileId:',
          responseData.id,
          'lessonModules:',
          responseData.lessonModules
        );
        addLessonModule(responseData.id, { lessonModules: responseData.lessonModules });
      }
    },
    [addGeneratedLessonFile, addLessonModule]
  );

  /**
   * @function openGenerateLessonModal
   * @description Show the modal that allows generating new lesson content.
   */
  const openGenerateLessonModal = useCallback(() => {
    setShowGenerateLessonModal(true);
  }, []);

  return (
    <div className="relative">
      {/** 
       * Hover trigger strip to open the panel on mouse enter. 
       * Step 1: This narrow div at the far left of the screen captures hover
       *         and sets isHoveredOpen to true, expanding the panel.
       */}
      <div
        className="fixed left-0 top-0 w-4 h-screen z-50 bg-transparent"
        onMouseEnter={handleMouseEnter}
      />

      {/**
       * The main navigation panel container.
       * Step 2: This uses a combination of hover state and manual toggle to set the width.
       */}
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
          {/* Header/logo */}
          <div className="flex items-center p-4 border-b">
            <div className="w-8 h-8 flex items-center justify-center bg-orange-500 text-white rounded mr-3">
              <span className="font-bold">B</span>
            </div>
            <span className="font-semibold text-gray-800">BloomMap</span>
          </div>

          {/* Primary navigation */}
          <nav className="py-2">
            {/* Home */}
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

            {/* Workspace Section - Always expanded */}
            <div>
              {/* Workspace header (non-collapsible) */}
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

              {/* Workspace content is always visible */}
              <div className="bg-gray-50 py-1">
                {/* File name editing */}
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

                {/* Lessons Section */}
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
                      <button
                        className="p-1 rounded hover:bg-gray-200 text-gray-500"
                        title="Generate Lesson"
                        onClick={openGenerateLessonModal}
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

                  {/* Scrollable Lessons list */}
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

                {/* PDF Uploads Section */}
                <div className="mt-2">
                  <div className="px-4 py-2 flex items-center justify-between text-sm text-gray-700 font-medium">
                    <span>Uploads</span>
                    <button
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500"
                      title="Upload new PDF"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FolderOpen className="h-4 w-4" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".pdf,.docx,.txt,.doc,.pptx"
                      multiple
                      onChange={handleFileUpload}
                    />
                  </div>

                  {/* Scrollable PDF uploads list */}
                  <div className="max-h-20 overflow-y-auto scrollbar-thin">
                    {isUploading ? (
                      <div className="p-4 rounded-lg bg-gray-100">
                        <div className="mb-2 text-sm text-gray-700 truncate">{currentFileName}</div>
                        <div className="rounded-full h-2 bg-gray-300 w-24">
                          <div
                            className="h-2 rounded-full transition-all duration-300 bg-gray-600"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {uploadProgress < 100 ? 'Uploading...' : 'Upload complete!'}
                        </div>
                      </div>
                    ) : getAllFiles().length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500">
                        Supported file types : PDF, PPTX, DOCX, or TXT files.
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

            {/* Profile */}
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

      {/* Generate Lesson Modal */}
      {showGenerateLessonModal && (
        <GenerateLessonModal
        docFileId={docFileID as string}
          onClose={() => setShowGenerateLessonModal(false)}
          onSuccess={handleGenerateLessonSuccess}
        />
      )}
    </div>
  );
};

export default NavigationPanel;

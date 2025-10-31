/***************************************************************************************
 * @file NavigationPanel.tsx — Unified (Read-Only + Read/Write) Panel
 * @description
 *   A single navigation panel that dynamically gates features by the current edit capability.
 *   It replaces the former split components (read-only vs read/write) and removes the need
 *   for NavigationController. The panel reads `editReady` via `useAccessEditSnapshot()` and
 *   derives `canEdit`. When `canEdit` is false, write affordances are hidden/disabled and
 *   uploads are forced to private, mirroring prior read-only behavior.
 *
 * Responsibilities:
 *   - Maintain hover-based expansion, manual open state, and top-level navigation (home/map/user)
 *   - List lessons and uploads; allow navigation to concept maps and PDFs
 *   - Gate write features (file name edit, lesson CRUD, lesson generation, public uploads) by `canEdit`
 *   - Allow uploads in read-only mode but force private visibility
 *   - Integrate centralized modal flows (fileUpload, lessonGeneration) with robust logging
 *   - Preserve layout/DOM structure used by callers (props contract unchanged)
 *
 * Performance:
 *   - O(1) UI logic; list rendering proportional to lessons/files already present in context
 *   - Effects are narrowly gated; no redundant subscriptions
 ***************************************************************************************/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, Trash2, FolderOpen, FileText, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLessonData } from '@/app/Library/Context/LessonDataContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useViewSwitch } from '@/app/Library/Context/pdf/ViewSwitchContext';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import { useGlobalModal } from '@/app/studygraph/(studygraph)/components/modals/GlobalModalProvider';
import { useAccountStatus } from '@/app/src/context/ApiContext';
import { useAccessEditSnapshot } from '@/app/Library/Context/AccessLayer/selectors';
import './NavigationPanel.css';

/** Top-level view types */
type TopLevelView = 'home' | 'map' | 'user';

/** Props (unchanged) */
interface NavigationPanelProps {
  isManuallyOpen?: boolean;
  currentView: TopLevelView;
  onSetView: (view: TopLevelView) => void;
  onExpandedChange?: (expanded: boolean) => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  isManuallyOpen = false,
  currentView,
  onSetView,
  onExpandedChange,
}) => {
  // console.log('[NavigationPanel.tsx][7001] unified panel render', { currentView, isManuallyOpen });

  // ---------------------------
  // [1] Capability snapshot
  // ---------------------------
  // update - 2: compute canEdit from centralized snapshot (no duplication)
  const { editReady } = useAccessEditSnapshot();
  const canEdit = editReady;

  // ---------------------------
  // [2] Shared contexts
  // ---------------------------
  const { accountStatus } = useAccountStatus();
  const { showModal } = useGlobalModal();

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

  const lessons = useMemo(() => getLessonModule().conceptMaps ?? [], [getLessonModule]);

  const { getAllFiles, addFile, addGeneratedLessonFile } = useFileAsset();
  const { clearSelection } = useNodeSelection();

  const { getFileName, updateFileName, docFileID } = useYDoc();
  const ydocFileName = getFileName();

  const { addLessonModule } = useLessonData();

  // ---------------------------
  // [3] Local UI state
  // ---------------------------
  const [isHoveredOpen, setIsHoveredOpen] = useState(false);
  const isExpanded = isHoveredOpen || isManuallyOpen;

  const [editingFileName, setEditingFileName] = useState(false);
  const [fileNameDraft, setFileNameDraft] = useState(ydocFileName);

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lesson: any } | null>(null);

  // ---------------------------
  // [4] Notify parent on expand
  // ---------------------------
  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  // ---------------------------
  // [5] Sync the file name draft
  // ---------------------------
  useEffect(() => {
    setFileNameDraft(ydocFileName);
  }, [ydocFileName]);

  // ---------------------------
  // [6] Auto-select first lesson
  // ---------------------------
  useEffect(() => {
    if (!docFileID || lessons.length === 0) return;
    setActiveConceptMapId(lessons[0].id);
    // console.log('[NavigationPanel.tsx][7002] auto-selected first lesson', lessons[0].id);
  }, [docFileID, lessons, setActiveConceptMapId]);

  // ---------------------------
  // [7] Global click closes context menu
  // ---------------------------
  useEffect(() => {
    const close = () => contextMenu && setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);


    /**
   * @function handleMouseEnter
   * @description
   * Set hover state to open panel and log interaction for debugging purposes.
   * Maintains existing behavior while adding observability for user interactions.
   */
  const handleMouseEnter = useCallback(() => setIsHoveredOpen(true), []);

  
  /**
   * @function handleMouseLeave
   * @description
   * Clear hover state and any active lesson editing state to maintain clean UI.
   * Preserves existing behavior with enhanced state cleanup for better UX.
   */
  const handleMouseLeave = useCallback(() => {
    setIsHoveredOpen(false);
    setEditingLessonId(null);
    setContextMenu(null);
  }, []);

  const handleHomeClick = useCallback(() => onSetView('home'), [onSetView]);
  const handleProfileClick = useCallback(() => onSetView('user'), [onSetView]);

   /**
   * @function handleLessonClick
   * @description
   * Handle lesson selection with view switching and selection management.
   * Preserves existing lesson navigation behavior with comprehensive state coordination.
   */
  const handleLessonClick = useCallback(
    (lessonId: string) => {
      onSetView('map');
      setActiveView('conceptMap');
      // Only clear selection when switching lessons
      if (activeConceptMapId !== lessonId) clearSelection();
      setActiveConceptMapId(lessonId);
      // console.log('[NavigationPanel.tsx][7003] lesson selected', { lessonId });
    },
    [onSetView, setActiveView, activeConceptMapId, clearSelection, setActiveConceptMapId]
  );

  
    /**
   * @function handleFileEntryClick
   * @description
   * Handle file selection with automatic PDF viewer navigation and state management.
   * Maintains existing file interaction behavior with enhanced view coordination.
   */
  const handleFileEntryClick = useCallback(
    (file: TextFileMessage) => {
      onSetView('map');
      setSelectedPdfUrl(file.serverUrl);
      setActiveView('pdf');
      // console.log('[NavigationPanel.tsx][7004] file selected', { file: file.title });
    },
    [onSetView, setActiveView, setSelectedPdfUrl]
  );

  /**
   * @function handleUploadClick
   * @description
   * Enhanced file upload handler that uses centralized modal system with account-aware
   * functionality. Provides proper permission checking and upgrade prompts for restricted
   * features while maintaining seamless user experience through comprehensive error handling.
   */
  const handleUploadClick = useCallback(() => {
    // console.log('[NavigationPanel.tsx][7005] upload requested (canEdit=%s)', canEdit);

    showModal('fileUpload', {
      onUploadSuccess: (file: File, isPublic: boolean) => {
        const visibility = canEdit ? (isPublic ? 'public' : 'private') : 'private'; // RO → force private
        addFile(file, { visibility })
          .catch((err: unknown) => console.error('[NavigationPanel.tsx][7007] upload failed', err));
      },
      // Optional: you can pass a flag to the modal to hide public toggle when !canEdit
      disablePublicOption: !canEdit,
    });
  }, [showModal, addFile, canEdit]);

    /**
   * @function handleFileNameSave
   * @description
   * Persist updated file name to YDoc context and exit editing mode.
   * Maintains existing file name editing functionality with enhanced logging.
   */
  const handleFileNameSave = useCallback(() => {
    if (!canEdit) return; // guard
    updateFileName(fileNameDraft);
    setEditingFileName(false);
    // console.log('[NavigationPanel.tsx][7008] file name updated', { name: fileNameDraft });
  }, [canEdit, fileNameDraft, updateFileName]);

    /**
   * @function handleAddLesson
   * @description
   * Add new concept map lesson with default title using existing lesson module system.
   * Preserves original functionality while providing comprehensive interaction logging.
   */
  const handleAddLesson = useCallback(() => {
    if (!canEdit) return; // guard
    addConceptMap('Untitled Lesson');
    // console.log('[NavigationPanel.tsx][7009] lesson added');
  }, [canEdit, addConceptMap]);


    /**
   * @function startEditingLesson
   * @description
   * Initialize lesson title editing mode with proper state management and logging.
   * Maintains existing lesson editing capabilities with enhanced user interaction tracking.
   */
  const startEditingLesson = useCallback((lesson: any) => {
    if (!canEdit) return; // guard
    setEditingLessonId(lesson.id);
    setEditingTitle(lesson.title);
  }, [canEdit]);


    /**
   * @function handleLessonTitleSave
   * @description
   * Save edited lesson title to lesson module context with validation and cleanup.
   * Preserves existing title editing functionality with comprehensive state management.
   */
  const handleLessonTitleSave = useCallback(() => {
    if (!canEdit || !editingLessonId || !editingTitle.trim()) return;
    updateConceptMapTitle(editingLessonId, editingTitle);
    setEditingLessonId(null);
    setEditingTitle('');
    // console.log('[NavigationPanel.tsx][7010] lesson title saved', { id: editingLessonId });
  }, [canEdit, editingLessonId, editingTitle, updateConceptMapTitle]);


    /**
   * @function handleDeleteLesson
   * @description
   * Delete lesson from lesson module context with proper cleanup and logging.
   * Maintains existing lesson deletion capabilities with enhanced error tracking.
   */
  const handleDeleteLesson = useCallback((lessonId: string) => {
    if (!canEdit) return; // guard
    deleteConceptMap(lessonId);
    // console.log('[NavigationPanel.tsx][7011] lesson deleted', { lessonId });
  }, [canEdit, deleteConceptMap]);

   /**
   * @function handleGenerateLessonSuccess
   * @description
   * Process successful lesson generation response by updating file asset and lesson
   * data contexts. Maintains existing lesson generation workflow while providing
   * comprehensive logging and error handling for production reliability.
   */
  const handleGenerateLessonSuccess = useCallback(
    (responseData: any) => {
      // console.log('[NavigationPanel.tsx][7012] generate success', responseData);
      try {
        const generated: TextFileMessage = {
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
        addGeneratedLessonFile(generated);
        if (responseData.id && responseData.lessonModules) {
          addLessonModule(responseData.id, { lessonModules: responseData.lessonModules });
        }
      } catch (e) {
        console.error('[NavigationPanel.tsx][7013] generate payload error', e);
      }
    },
    [accountStatus?.accountType, addGeneratedLessonFile, addLessonModule]
  );

    /**
   * @function handleGenerateLessonClick
   * @description
   * Backend-driven lesson generation handler that opens the lesson generation modal directly,
   * allowing the backend to handle subscription validation and trigger appropriate error modals
   * through the event system. This follows the specified workflow where the modal opens first
   * and subscription checking occurs at the API level.
   */
  const handleGenerateLessonClick = useCallback(() => {
    if (!canEdit) return; // guard
    // console.log('[NavigationPanel.tsx][7014] open lessonGeneration modal');
    showModal('lessonGeneration', {
      docFileId: docFileID,
      onSuccess: handleGenerateLessonSuccess,
    });
  }, [canEdit, showModal, docFileID, handleGenerateLessonSuccess]);

  // ------------------------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------------------------
return (
    <div className="nav-panel-wrapper">
      {/* Hover trigger */}
      <div className="nav-panel-trigger" onMouseEnter={handleMouseEnter} />

      {/* Main panel with three-region layout */}
      <div
        className={`nav-panel ${isExpanded ? 'nav-panel--expanded' : ''}`}
        onMouseLeave={handleMouseLeave}
      >
        {/* HEADER - Fixed */}
        <div className="nav-panel__header">
          <div className="nav-panel__brand">
            <div className="nav-panel__logo">W</div>
            <span className="nav-panel__brand-text">Wisegraph</span>
            {!canEdit && <span className="nav-panel__badge">Read-Only</span>}
          </div>
        </div>

        {/* CONTENT - Scrollable */}
        <div className="nav-panel__content">
          {/* Home Navigation */}
          <button
            className={`nav-panel__nav-item ${currentView === 'home' ? 'nav-panel__nav-item--active' : ''}`}
            onClick={handleHomeClick}
          >
            <svg className="nav-panel__icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span>Home</span>
          </button>

          {/* Workspace Section */}
          <div className="nav-panel__section">
            <div className="nav-panel__section-header">
              <svg className="nav-panel__icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
              <span>Workspace</span>
            </div>

            {/* Document Title */}
            <div className="nav-panel__doc-title">
              {canEdit && editingFileName ? (
                <Input
                  value={fileNameDraft}
                  onChange={(e) => setFileNameDraft(e.target.value)}
                  onBlur={handleFileNameSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleFileNameSave()}
                  className="nav-panel__title-input"
                  autoFocus
                />
              ) : (
                <span
                  className={`nav-panel__title-text ${canEdit ? 'nav-panel__title-text--editable' : ''}`}
                  onClick={() => canEdit && setEditingFileName(true)}
                  title={canEdit ? 'Click to edit' : ydocFileName}
                >
                  {ydocFileName}
                </span>
              )}
            </div>

            {/* Lessons */}
            <div className="nav-panel__subsection">
              <div className="nav-panel__subsection-header">
                <span className="nav-panel__subsection-title">Lessons</span>
                <div className="nav-panel__subsection-actions">
                  {canEdit && (
                    <>
                      <button
                        className="nav-panel__icon-btn"
                        title="Add lesson"
                        onClick={handleAddLesson}
                      >
                        <Plus className="nav-panel__icon--sm" />
                      </button>
                      <button
                        className="nav-panel__icon-btn"
                        title="Generate lesson"
                        onClick={handleGenerateLessonClick}
                      >
                        <svg
                          className="nav-panel__icon--sm"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isGeneratingLesson && (
                <div className="nav-panel__hint">Generating lesson...</div>
              )}

              <div className="nav-panel__list">
                {lessons.length === 0 ? (
                  <div className="nav-panel__empty">
                    <div className="nav-panel__empty-text">No lessons yet.</div>
                    {canEdit && (
                      <div className="nav-panel__empty-hint">Create or Generate to get started.</div>
                    )}
                  </div>
                ) : (
                  lessons.map((lesson) => {
                    const isSelected = activeConceptMapId === lesson.id;
                    return (
                      <div
                        key={lesson.id}
                        className={`nav-panel__list-item ${
                          isSelected ? 'nav-panel__list-item--active' : ''
                        }`}
                        onClick={() => handleLessonClick(lesson.id)}
                        onContextMenu={(e) => {
                          if (!canEdit) return;
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, lesson });
                        }}
                      >
                        {canEdit && editingLessonId === lesson.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleLessonTitleSave();
                            }}
                            className="nav-panel__edit-form"
                          >
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(ev) => setEditingTitle(ev.target.value)}
                              className="nav-panel__edit-input"
                              autoFocus
                            />
                            <button type="submit" className="nav-panel__edit-submit">
                              <svg viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </button>
                          </form>
                        ) : (
                          <>
                            <svg className="nav-panel__list-icon" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                            </svg>
                            <span className="nav-panel__list-text">{lesson.title}</span>
                            {canEdit && (
                              <div className="nav-panel__list-actions">
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    startEditingLesson(lesson);
                                  }}
                                  className="nav-panel__action-btn"
                                  title="Edit"
                                >
                                  <Pencil className="nav-panel__icon--xs" />
                                </button>
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    handleDeleteLesson(lesson.id);
                                  }}
                                  className="nav-panel__action-btn"
                                  title="Delete"
                                >
                                  <Trash2 className="nav-panel__icon--xs" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Uploads */}
            <div className="nav-panel__subsection">
              <div className="nav-panel__subsection-header">
                <span className="nav-panel__subsection-title">Uploads</span>
                <button
                  className="nav-panel__icon-btn"
                  title={canEdit ? 'Upload file' : 'Upload private file'}
                  onClick={handleUploadClick}
                >
                  <FolderOpen className="nav-panel__icon--sm" />
                </button>
              </div>

              <div className="nav-panel__list">
                {getAllFiles().length === 0 ? (
                  <div className="nav-panel__empty">
                    <div className="nav-panel__empty-text">No uploads yet.</div>
                    <div className="nav-panel__empty-hint">
                      {canEdit ? 'PDF, PPTX, DOCX, TXT supported.' : 'Upload private files only.'}
                    </div>
                  </div>
                ) : (
                  getAllFiles().map((file) => (
                    <div
                      key={file.id}
                      className="nav-panel__list-item"
                      onClick={() => handleFileEntryClick(file)}
                    >
                      <FileText className="nav-panel__list-icon nav-panel__list-icon--file" />
                      <span className="nav-panel__list-text">{file.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER - Sticky */}
        <div className="nav-panel__footer">
          <button
            className={`nav-panel__nav-item ${currentView === 'user' ? 'nav-panel__nav-item--active' : ''}`}
            onClick={handleProfileClick}
          >
            <svg className="nav-panel__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span>Profile</span>
          </button>
        </div>
      </div>

      {/* Context menu */}
      {canEdit && contextMenu && (
        <div
          className="nav-panel__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="nav-panel__context-item"
            onClick={(e) => {
              e.stopPropagation();
              startEditingLesson(contextMenu.lesson);
              setContextMenu(null);
            }}
          >
            <Pencil className="nav-panel__icon--xs" />
            Edit
          </button>
          <button
            className="nav-panel__context-item nav-panel__context-item--danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteLesson(contextMenu.lesson.id);
              setContextMenu(null);
            }}
          >
            <Trash2 className="nav-panel__icon--xs" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default NavigationPanel;

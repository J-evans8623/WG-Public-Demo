/**
 * @file DropdownComponents.tsx (read/write)
 * @description
 * Production-ready dropdown components for the editable CanvasHeader that handle lesson workflows
 * (generate, create, select) and file workflows (upload, select) with clear, observable state flows.
 * This update aligns the editable dropdowns with the read-only dropdown’s selection-highlighting rules,
 * ensuring that the currently selected item is visually emphasized using the shared Prototype 2 design.
 * The implementation applies the `ch-menu__item--active` class to exactly one item at a time across
 * both dropdowns by gating highlight display through the current application view (`activeView`):
 * when the user is in the concept map view, lesson selection is highlighted; when in the PDF view,
 * the uploaded file selection is highlighted. This preserves mutual exclusivity of the visual “selected”
 * state. The file preserves existing accessibility affordances (ARIA, keyboard Escape handling, and 
 * click-outside dismissal). Logging statements are intentionally minimal but precise, denoting success
 * or failure at key steps and marked with unique 4-digit codes for quick grep-driven debugging.
 * 
 * Responsibilities:
 * - Provide accessible, editable dropdown menus for Lessons and Uploads
 * - Integrate with LessonModule, FileAsset, ViewSwitch, YDoc, and LessonData contexts
 * - Apply the shared `ch-menu__item--active` selection style consistent with read-only dropdowns
 * - Ensure exclusive visual selection between lessons and uploads via `activeView` gating
 * - Maintain existing behaviors: AI generation modal, lesson creation, file uploads, and navigation
 * - Offer purposeful, low-noise console logging for observability during critical operations
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Sparkles, FolderOpen, FileText } from 'lucide-react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import GenerateLessonModal from '@/app/studygraph/(studygraph)/components/layout/ResourcePanel/GenerateLessonModal';
import { useLessonData } from '@/app/Library/Context/LessonDataContext';
import './DropdownComponents.css';

/**
 * @function useClickOutside
 * @description
 * Detects clicks outside of a referenced element and invokes a callback to enable reliable
 * dropdown dismissal. This hook centralizes the event wiring/cleanup so dropdown components
 * remain focused on control state and rendering. It ensures no orphan listeners remain after
 * unmount, reducing memory leaks and hard-to-trace bugs during long sessions or rapid toggles.
 * @param ref React ref pointing to the element to monitor
 * @param onOutside Callback function to execute when outside click is detected
 */
function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        console.log('[DropdownComponents.tsx][8001] Click outside detected, closing dropdown');
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
 * @interface LessonsDropdownProps
 * @description Props interface for the LessonsDropdown component
 */
interface LessonsDropdownProps {
  /** Callback triggered when a lesson generation request is successful */
  onLessonGenerated?: (responseData: any) => void;
}

/**
 * @function LessonsDropdown
 * @description
 * Editable lessons dropdown that supports AI lesson generation, blank lesson creation,
 * and navigating among existing lessons. This implementation now mirrors the read-only
 * selection-highlighting rules: it applies `ch-menu__item--active` to the active lesson
 * only when the current `activeView` is for concept maps. This guarantees that highlighting
 * is mutually exclusive with uploads: if the user switches to PDF view (by selecting an
 * upload), lesson highlighting is suppressed, and only the chosen file appears selected.
 * The component remains keyboard accessible and integrates with modal workflows.
 */
export const LessonsDropdown: React.FC<LessonsDropdownProps> = ({ onLessonGenerated }) => {
  // Step 1: Local UI state
  const [isOpen, setIsOpen] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Step 2: Contexts
  const {
    getLessonModule,
    addConceptMap,
    activeConceptMapId,
    setActiveConceptMapId,
    isGeneratingLesson,
  } = useLessonModule();

  // Pull activeView so we can gate highlight to ensure exclusivity across menus
  const { activeView, setActiveView } = useViewSwitch();

  const { docFileID } = useYDoc();
  const { addLessonModule } = useLessonData();

  // Step 3: Click-outside dismissal
  useClickOutside(dropdownRef, () => setIsOpen(false));

  // Step 4: Data
  const lessons = getLessonModule().conceptMaps || [];
  console.log('[DropdownComponents.tsx][8002] LessonsDropdown render; count:', lessons.length, 'activeView:', activeView, 'activeLessonId:', activeConceptMapId);

  // Step 5: Generate lesson → open modal
  const handleGenerateLesson = useCallback(() => {
    console.log('[DropdownComponents.tsx][8003] Generate lesson requested (open modal)');
    setShowGenerateModal(true);
    setIsOpen(false);
  }, []);

  // Step 6: Create blank lesson
  const handleCreateLesson = useCallback(() => {
    console.log('[DropdownComponents.tsx][8004] Create blank lesson requested');
    const { id } = addConceptMap('Untitled Lesson');
    setActiveConceptMapId(id);
    setActiveView('conceptMap');
    setIsOpen(false);
    console.log('[DropdownComponents.tsx][8005] Lesson created; id:', id);
  }, [addConceptMap, setActiveConceptMapId, setActiveView]);

  // Step 7: Select existing lesson
  const handleLessonSelect = useCallback((lessonId: string) => {
    console.log('[DropdownComponents.tsx][8006] Lesson selected:', lessonId);
    setActiveConceptMapId(lessonId);
    setActiveView('conceptMap'); // Ensures lessons own the exclusive highlight
    setIsOpen(false);
  }, [setActiveConceptMapId, setActiveView]);

  // Step 8: Modal success handler
  const handleGenerateLessonSuccess = useCallback((responseData: any) => {
    console.log('[DropdownComponents.tsx][8007] Lesson generation success payload received');
    // Optional: Map payload if needed for local caches
    if (responseData?.id && responseData?.lessonModules) {
      addLessonModule(responseData.id, { lessonModules: responseData.lessonModules });
      console.log('[DropdownComponents.tsx][8008] Lesson modules persisted to LessonDataContext');
    }
    onLessonGenerated?.(responseData);
  }, [addLessonModule, onLessonGenerated]);

  // Step 9: Keyboard escape
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      console.log('[DropdownComponents.tsx][8009] Escape pressed; close Lessons dropdown');
      setIsOpen(false);
    }
  }, []);

  return (
    <div className="ch-nav__item" ref={dropdownRef}>
      {/* Step 10: Trigger */}
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          console.log('[DropdownComponents.tsx][8010] Lessons dropdown toggled:', next);
        }}
        onKeyDown={handleKeyDown}
        disabled={isGeneratingLesson}
      >
        <span>Lessons</span>
      </button>

      {/* Step 11: Menu */}
      {isOpen && (
        <div
          role="menu"
          className="ch-menu"
          aria-label="Lessons menu"
          onKeyDown={handleKeyDown}
        >
          {/* Generate AI Lesson */}
          <button
            role="menuitem"
            className="ch-menu__item ch-menu__item--primary"
            onClick={handleGenerateLesson}
            disabled={!docFileID}
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

          {/* Existing Lessons (active state gated by activeView) */}
          {lessons.map((lesson) => {
            const isActiveForView = activeView !== 'pdf' && lesson.id === activeConceptMapId;
            if (isActiveForView) {
              console.log('[DropdownComponents.tsx][8011] Lesson highlighted (exclusive):', lesson.id);
            }
            return (
              <button
                key={lesson.id}
                role="menuitem"
                className={`ch-menu__item ${isActiveForView ? 'ch-menu__item--active' : ''}`}
                onClick={() => handleLessonSelect(lesson.id)}
              >
                {/* Match read-only indicator: green dot when active, icon when not */}
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

          {/* Generating state (disabled row) */}
          {isGeneratingLesson && (
            <div className="ch-menu__item ch-menu__item--disabled">
              <div className="ch-menu__loading">Generating lesson...</div>
            </div>
          )}
        </div>
      )}

      {/* Step 12: AI Generation Modal */}
      {showGenerateModal && docFileID && (
        <GenerateLessonModal
          docFileId={docFileID}
          onClose={() => {
            console.log('[DropdownComponents.tsx][8012] Generate lesson modal closed');
            setShowGenerateModal(false);
          }}
          onSuccess={handleGenerateLessonSuccess}
        />
      )}
    </div>
  );
};

/**
 * @interface UploadsDropdownProps
 * @description Props interface for the UploadsDropdown component
 */
interface UploadsDropdownProps {
  /** Optional callback triggered when file upload is successful */
  onFileUploaded?: (file: TextFileMessage) => void;
}

/**
 * @function UploadsDropdown
 * @description
 * Editable uploads dropdown that supports document uploads, shows progress, and allows
 * navigation to the PDF viewer. To match read-only behavior and enforce exclusive selection
 * across both menus, it now applies `ch-menu__item--active` only when the current `activeView`
 * is `pdf` and the row matches the locally selected file. When an upload is selected, the
 * component switches the view to PDF, providing a single, authoritative selection highlight.
 * Upload mechanics and progress UI remain unchanged.
 */
export const UploadsDropdown: React.FC<UploadsDropdownProps> = ({ onFileUploaded }) => {
  // Step 1: Local UI/upload state
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Contexts
  const { getAllFiles, addFile } = useFileAsset();
  const { activeView, setSelectedPdfUrl, setActiveView } = useViewSwitch();

  // Step 3: Click-outside dismissal
  useClickOutside(dropdownRef, () => setIsOpen(false));

  // Step 4: Data
  const uploadedFiles = getAllFiles();
  console.log('[DropdownComponents.tsx][8013] UploadsDropdown render; count:', uploadedFiles.length, 'activeView:', activeView, 'selectedFileId:', selectedFileId);

  // Step 5: Simulated progress (cosmetic)
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (isUploading && uploadProgress < 100) {
      timer = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.floor(Math.random() * 10 + 5), 95));
      }, 300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isUploading, uploadProgress]);

  // Step 6: Upload click
  const handleUploadClick = useCallback(() => {
    console.log('[DropdownComponents.tsx][8014] Upload picker opened');
    fileInputRef.current?.click();
    setIsOpen(false);
  }, []);

  // Step 7: Upload handler
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log('[DropdownComponents.tsx][8015] Upload started; first file:', files[0].name);
    setIsUploading(true);
    setUploadProgress(0);
    setCurrentFileName(files[0].name);

    try {
      await Promise.all(Array.from(files).map(async (file) => {
        await addFile(file);
        onFileUploaded?.({
          id: crypto.randomUUID(),
          type: 'pdf',
          title: file.name,
          serverUrl: '', // downstream contexts typically fill this after server ingest
          uploadDate: new Date(),
          size: file.size,
        });
        console.log('[DropdownComponents.tsx][8016] File uploaded:', file.name);
      }));

      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setCurrentFileName('');
        event.target.value = '';
        console.log('[DropdownComponents.tsx][8017] Upload complete/reset UI');
      }, 1000);
    } catch (error) {
      console.error('[DropdownComponents.tsx][8018] Upload failed:', error);
      setIsUploading(false);
      setUploadProgress(0);
      setCurrentFileName('');
    }
  }, [addFile, onFileUploaded]);

  // Step 10: File select → PDF
  const handleFileSelect = useCallback((file: TextFileMessage) => {
    console.log('[DropdownComponents.tsx][8019] File selected:', file.title, '→ switch to PDF view');
    setSelectedPdfUrl(file.serverUrl);
    setSelectedFileId(file.id);
    setActiveView('pdf'); // Ensures uploads own the exclusive highlight
    setIsOpen(false);
  }, [setSelectedPdfUrl, setActiveView]);

  // Step 11: Keyboard escape
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      console.log('[DropdownComponents.tsx][8020] Escape pressed; close Uploads dropdown');
      setIsOpen(false);
    }
  }, []);

  return (
    <div className="ch-nav__item" ref={dropdownRef}>
      {/* Step 12: Trigger */}
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          console.log('[DropdownComponents.tsx][8021] Uploads dropdown toggled:', next);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>Uploads</span>
      </button>

      {/* Step 13: Hidden input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.docx,.txt,.doc,.pptx"
        multiple
        onChange={handleFileUpload}
      />

      {/* Step 14: Menu */}
      {isOpen && (
        <div
          role="menu"
          className="ch-menu"
          aria-label="Uploads menu"
          onKeyDown={handleKeyDown}
        >
          {/* Upload action */}
          <button
            role="menuitem"
            className="ch-menu__item ch-menu__item--primary"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            <FolderOpen size={16} />
            <span>Upload Document</span>
          </button>

          {/* Progress */}
          {isUploading && (
            <div className="ch-menu__item ch-menu__item--disabled">
              <div className="ch-menu__progress">
                <div className="ch-menu__progress-text">{currentFileName}</div>
                <div className="ch-menu__progress-bar">
                  <div className="ch-menu__progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="ch-menu__progress-status">
                  {uploadProgress < 100 ? 'Uploading...' : 'Upload complete!'}
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          {uploadedFiles.length > 0 && !isUploading && <div className="ch-menu__divider" />}

          {/* Empty state */}
          {!isUploading && uploadedFiles.length === 0 && (
            <div className="ch-menu__item ch-menu__item--disabled">
              <span className="ch-menu__empty">No files uploaded yet</span>
            </div>
          )}

          {/* File list with exclusive highlight gated by activeView === 'pdf' */}
          {!isUploading && uploadedFiles.map((file) => {
            const isSelectedAndActive = activeView === 'pdf' && file.id === selectedFileId;
            if (isSelectedAndActive) {
              console.log('[DropdownComponents.tsx][8022] File highlighted (exclusive):', file.id);
            }
            return (
              <button
                key={file.id}
                role="menuitem"
                className={`ch-menu__item ${isSelectedAndActive ? 'ch-menu__item--active' : ''}`}
                onClick={() => handleFileSelect(file)}
              >
                {/* Match read-only indicator: green dot when active, icon when not */}
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
    </div>
  );
};

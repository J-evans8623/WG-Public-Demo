/** bloom-maps\app\studygraph\(studygraph)\components\layout\Canvas\ReadWriteCanvas\DropDownMenu.tsx
 * @file UnifiedDropDownMenus.tsx
 * @description
 * UnifiedDropDownMenus centralizes the logic and UI for the Lessons and Uploads dropdowns so both
 * editable and read-only headers can share a single source of truth. Previously, we had two separate
 * implementations (one for the interactive Canvas header and another for the read-only header) that
 * diverged over time. This file eliminates duplication while preserving the brand UI, accessibility,
 * and CSS class hooks (e.g., .ch-nav__item, .ch-menu, .ch-menu__item). The component set exposes a
 * strict “mode” flag: `"edit"` enables mutating actions (AI generation, create blank lesson, and file
 * upload via the centralized modal system), while `"readonly"` limits the menus to safe navigation
 * (switch lessons and open existing uploaded files in the PDF viewer). This design keeps all business
 * logic co-located (navigation, exclusive highlighting, and modal routing) and enables consistent
 * logging and observability. Each handler includes precise console prints tagged with a file label
 * and a unique four-digit code. The time complexity for menu construction is O(N) where N equals the
 * number of lessons or files, respectively, which is optimal for this UI task. No canvas drawing APIs
 * are used. This module depends only on stable application contexts and the shared GlobalModal system.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, FolderOpen, Plus, Sparkles } from 'lucide-react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonData } from '@/app/Library/Context/LessonDataContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useGlobalModal } from '@/app/studygraph/(studygraph)/components/modals/GlobalModalProvider';
import { useAccountStatus } from '@/app/src/context/ApiContext';
import type { TextFileMessage } from '@/app/Library/Definitions/Definitions';
import '@/app/studygraph/(studygraph)/components/layout/Canvas/bottomUtilityBar/DropdownComponents.css'
type Mode = 'edit' | 'readonly';

/* -------------------------------------------------------------------------------------------------
 * Internals: shared helpers
 * ------------------------------------------------------------------------------------------------- */

/**
 * @function useClickOutside
 * @description
 * Attaches a document-level mouse down listener that closes a dropdown when the click occurs outside
 * of the given element. This keeps dropdown dismissal consistent for both editable and read-only
 * modes and prevents memory leaks through proper cleanup. The function operates in O(1) time per
 * event and does not allocate per-click data structures beyond temporary references.
 */
function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    const handler = (evt: MouseEvent) => {
      if (ref.current && !ref.current.contains(evt.target as Node)) {
        console.log('[UnifiedDropDownMenus.tsx][7101] click-outside → closing dropdown');
        onOutside();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

/* -------------------------------------------------------------------------------------------------
 * Lessons dropdown (unified)
 * ------------------------------------------------------------------------------------------------- */

export interface UnifiedLessonsDropdownProps {
  /** Controls whether mutating actions are available. */
  mode: Mode;
  /** Optional callback fired after successful AI lesson generation. */
  onLessonGenerated?: (payload: any) => void;
}

/**
 * @function UnifiedLessonsDropdown
 * @description
 * Renders the “Lessons” dropdown with an explicit “mode” flag. In `"edit"` mode the menu contains
 * AI generation and blank creation actions routed through the centralized modal system, plus a list
 * of existing lessons with exclusive active highlighting. In `"readonly"` mode, the menu contains
 * only the existing lessons and navigation. The component preserves design tokens, keyboard support,
 * and screen reader hints. Menu construction is O(L), where L is the count of lessons. Navigation and
 * state updates are O(1). Logging pinpoints each user action, helping diagnose menu/route regressions.
 */
export const UnifiedLessonsDropdown: React.FC<UnifiedLessonsDropdownProps> = ({
  mode,
  onLessonGenerated,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const {
    getLessonModule,
    addConceptMap,
    activeConceptMapId,
    setActiveConceptMapId,
    isGeneratingLesson,
  } = useLessonModule();

  const { setActiveView, activeView } = useViewSwitch();
  const { addLessonModule } = useLessonData();
  const { showModal } = useGlobalModal();
  const { docFileID } = useYDoc();

  const lessons = getLessonModule().conceptMaps || [];

  const handleSelect = useCallback(
    (lessonId: string) => {
      console.log('[UnifiedDropDownMenus.tsx][7102] lesson-select', { lessonId });
      setActiveConceptMapId(lessonId);
      setActiveView('conceptMap');
      setOpen(false);
    },
    [setActiveConceptMapId, setActiveView]
  );

  const handleCreateBlank = useCallback(() => {
    if (mode !== 'edit') return;
    console.log('[UnifiedDropDownMenus.tsx][7103] create-blank-lesson');
    const { id } = addConceptMap('Untitled Lesson');
    setActiveConceptMapId(id);
    setActiveView('conceptMap');
    setOpen(false);
  }, [mode, addConceptMap, setActiveConceptMapId, setActiveView]);

  const handleGenerate = useCallback(() => {
    if (mode !== 'edit') return;
    console.log('[UnifiedDropDownMenus.tsx][7104] generate-lesson → open modal');
    setOpen(false);
    showModal('lessonGeneration', {
      docFileId: docFileID,
      onSuccess: (resp: any) => {
        try {
          console.log('[UnifiedDropDownMenus.tsx][7105] generate-lesson success');
          if (resp?.id && resp?.lessonModules) {
            addLessonModule(resp.id, { lessonModules: resp.lessonModules });
          }
          onLessonGenerated?.(resp);
        } catch (e) {
          console.error('[UnifiedDropDownMenus.tsx][7106] generate-lesson onSuccess error', e);
        }
      },
    });
  }, [mode, showModal, docFileID, addLessonModule, onLessonGenerated]);

  const items = [
    ...(mode === 'edit'
      ? [
          <button
            key="ai"
            role="menuitem"
            className="ch-menu__item ch-menu__item--primary"
            onClick={handleGenerate}
            disabled={!docFileID || isGeneratingLesson}
            title="Generate AI lesson"
          >
            <Sparkles size={16} />
            <span>Generate Lesson</span>
          </button>,
          <button
            key="create"
            role="menuitem"
            className="ch-menu__item"
            onClick={handleCreateBlank}
          >
            <Plus size={16} />
            <span>Create Lesson</span>
          </button>,
          lessons.length > 0 ? <div key="div" className="ch-menu__divider" /> : null,
        ]
      : []),
    ...(lessons.length === 0
      ? [
          <div key="empty" className="ch-menu__item ch-menu__item--disabled">
            <span className="ch-menu__empty">No lessons available</span>
          </div>,
        ]
      : lessons.map((l) => {
          const isActiveForView = activeView !== 'pdf' && l.id === activeConceptMapId;
          if (isActiveForView) {
            console.log('[UnifiedDropDownMenus.tsx][7107] lesson-highlight', { lessonId: l.id });
          }
          return (
            <button
              key={l.id}
              role="menuitem"
              className={`ch-menu__item ${isActiveForView ? 'ch-menu__item--active' : ''}`}
              onClick={() => handleSelect(l.id)}
            >
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
              <span>{l.title}</span>
            </button>
          );
        })),
  ];

  return (
    <div className="ch-nav__item" ref={ref}>
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          console.log('[UnifiedDropDownMenus.tsx][7108] lessons-toggle', { open: next });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            console.log('[UnifiedDropDownMenus.tsx][7109] lessons-escape-close');
          }
        }}
      >
        <span>Lessons</span>
      </button>
      {open && (
        <div role="menu" className="ch-menu" aria-label="Lessons menu">
          {items}
          {mode === 'edit' && isGeneratingLesson && (
            <div className="ch-menu__item ch-menu__item--disabled">
              <div className="ch-menu__loading">Generating lesson…</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Uploads dropdown (unified)
 * ------------------------------------------------------------------------------------------------- */

export interface UnifiedUploadsDropdownProps {
  /** Controls whether mutating actions (upload) are available. */
  mode: Mode;
  /** Optional callback fired when an upload succeeds (edit mode only). */
  onFileUploaded?: (file: TextFileMessage) => void;
}

/**
 * @function UnifiedUploadsDropdown
 * @description
 * Renders the “Uploads” dropdown with a “mode” flag. In `"edit"` mode the menu includes an Upload
 * action that routes through the centralized modal system and a list of existing files (PDFs/TXT).
 * In `"readonly"` mode, the upload option is removed and only the file list is presented. Selecting
 * a file sets the active view to the PDF viewer and highlights the selected item. Rendering runs in
 * O(F) where F is the count of files; selection is O(1). Logging tracks every major step for audits.
 */
export const UnifiedUploadsDropdown: React.FC<UnifiedUploadsDropdownProps> = ({
  mode,
  onFileUploaded,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const { getAllFiles } = useFileAsset();
  const { setSelectedPdfUrl, setActiveView, activeView } = useViewSwitch();
  const { showModal } = useGlobalModal();
  const { accountStatus } = useAccountStatus();

  const uploadedFiles = getAllFiles();

  const handleUpload = useCallback(() => {
    if (mode !== 'edit') return;
    console.log('[UnifiedDropDownMenus.tsx][7110] upload-open-modal');
    setOpen(false);
    showModal('fileUpload', {
      onUploadSuccess: (file: File, isPublic: boolean, serverUrl?: string) => {
        console.log('[UnifiedDropDownMenus.tsx][7111] upload-success', {
          file: file.name,
          isPublic,
        });
        // Emit a light-weight message for observers; the actual asset context update
        // is handled in the modal pipeline.
        const msg: TextFileMessage = {
          id: crypto.randomUUID(),
          type: file.type === 'application/pdf' ? 'pdf' : 'txt',
          title: file.name,
          serverUrl: serverUrl || '',
          uploadDate: new Date(),
          size: file.size,
          accountType: accountStatus?.accountType || 'scholar',
        };
        onFileUploaded?.(msg);
      },
    });
  }, [mode, showModal, onFileUploaded, accountStatus?.accountType]);

  const handleOpenFile = useCallback(
    (file: TextFileMessage) => {
      console.log('[UnifiedDropDownMenus.tsx][7112] open-file', { fileId: file.id, title: file.title });
      setSelectedFileId(file.id);
      setSelectedPdfUrl(file.serverUrl);
      setActiveView('pdf');
      setOpen(false);
    },
    [setSelectedPdfUrl, setActiveView]
  );

  const items = [
    ...(mode === 'edit'
      ? [
          <button
            key="upload"
            role="menuitem"
            className="ch-menu__item ch-menu__item--primary"
            onClick={handleUpload}
          >
            <FolderOpen size={16} />
            <span>Upload Document</span>
          </button>,
          uploadedFiles.length > 0 ? <div key="div" className="ch-menu__divider" /> : null,
        ]
      : []),
    ...(uploadedFiles.length === 0
      ? [
          <div key="empty" className="ch-menu__item ch-menu__item--disabled">
            <span className="ch-menu__empty">No files available</span>
          </div>,
        ]
      : uploadedFiles.map((f) => {
          const isSelectedAndActive = activeView === 'pdf' && f.id === selectedFileId;
          if (isSelectedAndActive) {
            console.log('[UnifiedDropDownMenus.tsx][7113] file-highlight', { fileId: f.id });
          }
          return (
            <button
              key={f.id}
              role="menuitem"
              className={`ch-menu__item ${isSelectedAndActive ? 'ch-menu__item--active' : ''}`}
              onClick={() => handleOpenFile(f)}
            >
              {isSelectedAndActive ? (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    backgroundColor: '#5B8C5A',
                    borderRadius: '50%',
                    marginRight: 4,
                  }}
                  aria-label="Currently selected file"
                />
              ) : (
                <FileText size={16} />
              )}
              <span>{f.title}</span>
            </button>
          );
        })),
  ];

  return (
    <div className="ch-nav__item" ref={ref}>
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          console.log('[UnifiedDropDownMenus.tsx][7114] uploads-toggle', { open: next });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            console.log('[UnifiedDropDownMenus.tsx][7115] uploads-escape-close');
          }
        }}
      >
        <span>Uploads</span>
      </button>
      {open && (
        <div role="menu" className="ch-menu" aria-label="Uploads menu">
          {items}
        </div>
      )}
    </div>
  );
};

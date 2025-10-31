/**
 * @file ReadOnlyDropdown.tsx
 * @description
 * Pure read-only dropdown components designed exclusively for the ROCanvasViewer context with enhanced
 * selection highlighting functionality. These components provide only navigation and viewing functionality,
 * with all mutator operations completely removed from the component architecture. The implementation now
 * includes sophisticated selection state management that applies the Prototype 2 design treatment with
 * sage green border accents, subtle background gradients, and refined indicator dots.
 * 
 * This approach eliminates the need for conditional logic or boolean flags by creating dedicated
 * read-only components that are imported only by ROCanvasHeader, ensuring clean separation of
 * concerns and guaranteed access control through component-level isolation. The components now
 * properly track current selections and apply the ch-menu__item--active CSS class to trigger
 * the professional warm aesthetic defined in the brand guidelines.
 *
 * Key Design Principles:
 * - Pure read-only: No mutator operations exist in the codebase
 * - Clean architecture: No conditional rendering or boolean flags needed
 * - Focused functionality: Only navigation and viewing capabilities with proper selection highlighting
 * - Component isolation: Used exclusively in read-only contexts
 * - Comprehensive logging: All actions logged for observability with unique 4-digit codes
 * - Professional aesthetics: Green dot indicators replace file icons for selected states
 *
 * Access Control Strategy:
 * 1. ROCanvasHeader imports these pure read-only dropdown components
 * 2. No mutator operations are defined or accessible
 * 3. Only lesson navigation and file viewing are supported with proper selection feedback
 * 4. No modals, file inputs, or creation handlers exist
 * 5. Selection state management ensures proper visual feedback through CSS class application
 * 
 * Responsibilities:
 * - Provide read-only lesson navigation with active state highlighting using sage green accent design
 * - Support read-only file viewing with selection state management and green dot indicators
 * - Maintain consistent dropdown behavior with click-outside dismissal and keyboard navigation
 * - Apply proper CSS classes (ch-menu__item--active) to trigger Prototype 2 styling effects
 * - Log all navigation actions with unique codes for debugging and observability
 * - Replace traditional file icons with brand-appropriate green dot indicators for selected items
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useFileAsset } from '@/app/Library/Context/FileAssetContext';
import { useViewSwitch } from '@/app/Library/Context/pdf/ViewSwitchContext';
import { TextFileMessage } from '@/app/Library/Definitions/Definitions';

/**
 * @function useClickOutside
 * @description
 * Hook for detecting clicks outside dropdown elements for read-only dropdowns with enhanced
 * logging capabilities. Provides consistent dropdown dismissal behavior across all read-only
 * components while maintaining proper event listener cleanup to prevent memory leaks.
 * 
 * @param ref React ref pointing to the dropdown container element to monitor for outside clicks
 * @param onOutside Callback function executed when click outside the referenced element is detected
 */
function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        console.log('[ReadOnlyDropdown.tsx][9001] Click outside detected, closing dropdown');
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
 * @function LessonsDropdown
 * @description
 * Pure read-only lessons dropdown that provides only lesson navigation functionality with enhanced
 * active state highlighting. This component is designed exclusively for read-only contexts and contains
 * no mutator operations. The implementation now properly applies the ch-menu__item--active CSS class
 * to selected lessons, triggering the sophisticated Prototype 2 design with sage green border accents
 * and subtle background gradients.
 * 
 * Available functionality:
 * - View and navigate to existing lessons with proper selection highlighting
 * - Display active lesson indicator using Prototype 2 design treatment
 * - Keyboard navigation support with Escape key dismissal
 * - Green dot indicators replace traditional file icons for selected states
 * 
 * Removed functionality (compared to edit mode):
 * - Generate Lesson (no modal integration)
 * - Create Lesson (no lesson creation)
 * - All mutator context method calls
 * - Success callbacks and file generation handling
 *
 * Steps:
 * 1. Initialize dropdown state management
 * 2. Access lesson data from context for display
 * 3. Provide lesson selection and navigation with proper state tracking
 * 4. Handle keyboard interactions for accessibility
 * 5. Log all navigation actions for observability with unique codes
 * 6. Apply proper CSS classes for Prototype 2 selection styling
 */
export const LessonsDropdown: React.FC = () => {
  // Step 1: Initialize state management for read-only dropdown
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  console.log('[ReadOnlyDropdown.tsx][9002] Read-only LessonsDropdown initialized');
  
  // Step 2: Access context hooks for lesson data and navigation
  const { 
    getLessonModule, 
    activeConceptMapId, 
    setActiveConceptMapId 
  } = useLessonModule();
  const { setActiveView } = useViewSwitch();

  // Step 3: Set up click outside detection for dropdown dismissal
  useClickOutside(dropdownRef, () => setIsOpen(false));

  // Step 4: Get current lesson data for display
  const lessons = getLessonModule().conceptMaps || [];
  console.log('[ReadOnlyDropdown.tsx][9003] Lessons loaded for read-only view, count:', lessons.length, 'activeId:', activeConceptMapId);
  
  // Step 5: Navigation handler - core read-only functionality with enhanced logging
  const handleLessonSelect = useCallback((lessonId: string) => {
    console.log('[ReadOnlyDropdown.tsx][9004] Read-only lesson navigation requested:', lessonId, 'previous active:', activeConceptMapId);
    setActiveConceptMapId(lessonId);
    setActiveView('conceptMap');
    setIsOpen(false);
    console.log('[ReadOnlyDropdown.tsx][9005] Lesson navigation completed, new active lesson:', lessonId);
  }, [setActiveConceptMapId, setActiveView, activeConceptMapId]);

  // Step 6: Keyboard handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      console.log('[ReadOnlyDropdown.tsx][9006] Escape key pressed, closing lessons dropdown');
      setIsOpen(false);
    }
  }, []);

  // Step 7: Generate menu items with proper active state highlighting
  const getMenuItems = useCallback(() => {
    const items = [];
    
    // Only show existing lessons for navigation - no mutator options
    if (lessons.length === 0) {
      items.push(
        <div key="empty" className="ch-menu__item ch-menu__item--disabled">
          <span className="ch-menu__empty">No lessons available</span>
        </div>
      );
    } else {
      lessons.forEach((lesson) => {
        const isActive = lesson.id === activeConceptMapId;
        items.push(
          <button
            key={lesson.id}
            role="menuitem"
            className={`ch-menu__item ${isActive ? 'ch-menu__item--active' : ''}`}
            onClick={() => handleLessonSelect(lesson.id)}
          >
            {/* Step 8: Conditional rendering - green dot for active, file icon for inactive */}
            {isActive ? (
              <div 
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#5B8C5A',
                  borderRadius: '50%',
                  marginRight: '4px'
                }}
                aria-label="Currently selected lesson"
              />
            ) : (
              <FileText size={16} />
            )}
            <span>{lesson.title}</span>
          </button>
        );
      });
    }
    
    console.log('[ReadOnlyDropdown.tsx][9007] Read-only lesson menu items generated, count:', items.length, 'active lesson highlighted');
    return items;
  }, [lessons, activeConceptMapId, handleLessonSelect]);

  return (
    <div className="ch-nav__item" ref={dropdownRef}>
      {/* Step 9: Dropdown trigger for lesson navigation */}
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          const newState = !isOpen;
          setIsOpen(newState);
          console.log('[ReadOnlyDropdown.tsx][9008] Read-only lessons dropdown toggled:', newState);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>Lessons</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Step 10: Dropdown menu with pure navigation content and active state highlighting */}
      {isOpen && (
        <div
          role="menu"
          className="ch-menu"
          aria-label="Lessons menu"
          onKeyDown={handleKeyDown}
        >
          {getMenuItems()}
        </div>
      )}
    </div>
  );
};

/**
 * @function UploadsDropdown  
 * @description
 * Pure read-only uploads dropdown that provides only file viewing functionality with enhanced
 * selection state management. This component is designed exclusively for read-only contexts and
 * contains no upload operations. The implementation now tracks which file is currently selected
 * and applies the ch-menu__item--active CSS class to trigger the Prototype 2 design treatment
 * with sage green border accents and refined indicator dots.
 *
 * Available functionality:
 * - View and navigate to existing uploaded files with selection highlighting
 * - Navigate to PDF viewer for document viewing with proper state tracking
 * - Display file list with green dot indicators for selected files
 * - Maintain selection state across dropdown open/close cycles
 *
 * Removed functionality (compared to edit mode):
 * - Upload Document (no file input or upload processing)
 * - Upload progress indicators and status
 * - All file creation and mutator operations
 * - Success callbacks and file upload handling
 *
 * Steps:
 * 1. Initialize dropdown state management with selection tracking
 * 2. Access uploaded files from context for display
 * 3. Provide file selection and PDF navigation with state persistence
 * 4. Handle keyboard interactions for accessibility
 * 5. Log all file viewing actions for observability
 * 6. Apply proper CSS classes and green dot indicators for selected files
 */
export const UploadsDropdown: React.FC = () => {
  // Step 1: Initialize state management for read-only dropdown with selection tracking
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  console.log('[ReadOnlyDropdown.tsx][9009] Read-only UploadsDropdown initialized with selection tracking');

  // Step 2: Access context hooks for file data and navigation
  const { getAllFiles } = useFileAsset();
  const { setSelectedPdfUrl, setActiveView } = useViewSwitch();

  // Step 3: Set up click outside detection for dropdown dismissal
  useClickOutside(dropdownRef, () => setIsOpen(false));

  // Step 4: Get current uploaded files for display
  const uploadedFiles = getAllFiles();
  console.log('[ReadOnlyDropdown.tsx][9010] Files loaded for read-only view, count:', uploadedFiles.length, 'selectedId:', selectedFileId);

  // Step 5: File selection handler with enhanced state tracking
  const handleFileSelect = useCallback((file: TextFileMessage) => {
    console.log('[ReadOnlyDropdown.tsx][9011] Read-only file navigation requested:', file.title, 'fileId:', file.id);
    setSelectedFileId(file.id);
    setSelectedPdfUrl(file.serverUrl);
    setActiveView('pdf');
    setIsOpen(false);
    console.log('[ReadOnlyDropdown.tsx][9012] File navigation completed, selected file:', file.title);
  }, [setSelectedPdfUrl, setActiveView]);

  // Step 6: Keyboard handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      console.log('[ReadOnlyDropdown.tsx][9013] Escape key pressed, closing uploads dropdown');
      setIsOpen(false);
    }
  }, []);

  // Step 7: Generate menu items with proper selection highlighting
  const getMenuItems = useCallback(() => {
    const items = [];
    
    // Show existing files for viewing with selection state - no upload options
    if (uploadedFiles.length === 0) {
      items.push(
        <div key="empty" className="ch-menu__item ch-menu__item--disabled">
          <span className="ch-menu__empty">No files available</span>
        </div>
      );
    } else {
      uploadedFiles.forEach((file) => {
        const isSelected = file.id === selectedFileId;
        items.push(
          <button
            key={file.id}
            role="menuitem"
            className={`ch-menu__item ${isSelected ? 'ch-menu__item--active' : ''}`}
            onClick={() => handleFileSelect(file)}
          >
            {/* Step 8: Conditional rendering - green dot for selected, file icon for unselected */}
            {isSelected ? (
              <div 
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#5B8C5A',
                  borderRadius: '50%',
                  marginRight: '4px'
                }}
                aria-label="Currently selected file"
              />
            ) : (
              <FileText size={16} />
            )}
            <span>{file.title}</span>
          </button>
        );
      });
    }
    
    console.log('[ReadOnlyDropdown.tsx][9014] Read-only upload menu items generated, count:', items.length, 'selection highlighted');
    return items;
  }, [uploadedFiles, selectedFileId, handleFileSelect]);

  return (
    <div className="ch-nav__item" ref={dropdownRef}>
      {/* Step 9: Dropdown trigger for file viewing */}
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          const newState = !isOpen;
          setIsOpen(newState);
          console.log('[ReadOnlyDropdown.tsx][9015] Read-only uploads dropdown toggled:', newState);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>Uploads</span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Step 10: Dropdown menu with pure viewing content and selection highlighting */}
      {isOpen && (
        <div
          role="menu"
          className="ch-menu"
          aria-label="Uploads menu"  
          onKeyDown={handleKeyDown}
        >
          {getMenuItems()}
        </div>
      )}
    </div>
  );
};
/**
 * @file ToolbarButtons.tsx
 * @description
 *   Consolidates all individual toolbar “atom” components into one file.
 *
 *   Responsibilities:
 *   - Define every toolbar button (Search, Share, MenuToggle, Undo, Redo,
 *     MultiSelect, Quiz, ZoomIn, ZoomOut, PrevPage, NextPage, PageInput, Jump)
 *     as a separate React component.
 *   - Import a shared CSS file (`ToolbarButton.css`) so that every button
 *     uses the same styling, hover/active/disabled states, and sizing.
 *   - Export each component as a named export, allowing consumers to pick
 *     only the ones they need (e.g. import { SearchButton, ZoomInButton } from ...).
 *
 *   Note:
 *   - Do not modify anything unrelated to these components; all other styling
 *     and context logic is unchanged.
 */

import React, { KeyboardEvent } from 'react';
import { 
  Search, 
  Share2, 
  MoreHorizontal, 
  MousePointer, 
  ClipboardList 
} from 'lucide-react';
import './ToolbarButton.css';

/* -------------------------------------------------------------------------- */
/*                                  SearchButton                               */
/* -------------------------------------------------------------------------- */
/**
 * Renders a magnifying-glass icon button.  
 * Props:
 *  - onClick: callback when the button is clicked.
 *  - disabled?: optional boolean (defaults to false). If true, the button is non-interactive.
 */
export interface SearchButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const SearchButton: React.FC<SearchButtonProps> = ({ onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`toolbar-btn ${disabled ? 'disabled' : ''}`}
    title="Search"
    aria-label="Search"
  >
    <Search size={20} />
  </button>
);

/* -------------------------------------------------------------------------- */
/*                                  ShareButton                                */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Share” icon button.  
 * Props:
 *  - onClick: callback when the button is clicked.
 *  - disabled?: optional boolean (defaults to false). If true, the button is non-interactive.
 */
export interface ShareButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const ShareButton: React.FC<ShareButtonProps> = ({ onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`toolbar-btn ${disabled ? 'disabled' : ''}`}
    title="Share"
    aria-label="Share"
  >
    <Share2 size={20} />
  </button>
);

/* -------------------------------------------------------------------------- */
/*                             MenuToggleButton                               */
/* -------------------------------------------------------------------------- */
/**
 * Renders a three-dots (“More Options”) toggle button.  
 * Props:
 *  - isOpen: whether the dropdown is currently shown (applies .active styling).
 *  - onToggle: callback to fire when the user clicks to open/close the dropdown.
 */
export interface MenuToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}
export const MenuToggleButton: React.FC<MenuToggleButtonProps> = ({ isOpen, onToggle }) => (
  <button
    onClick={onToggle}
    className={`toolbar-btn ${isOpen ? 'active' : ''}`}
    title="More options"
    aria-label="More options"
  >
    <MoreHorizontal size={20} />
  </button>
);

/* -------------------------------------------------------------------------- */
/*                                UndoButton                                   */
/* -------------------------------------------------------------------------- */
/**
 * Renders an “Undo” icon button.  
 * Props:
 *  - onClick: callback to invoke the Undo action.
 *  - disabled?: optional boolean (defaults to false). When true, the button is non-interactive.
 */
export interface UndoButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const UndoButton: React.FC<UndoButtonProps> = ({ onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    title="Undo"
    aria-label="Undo"
  >
              <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1.5} 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>
          </svg>
  </button>
);

/* -------------------------------------------------------------------------- */
/*                                RedoButton                                   */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Redo” icon button.  
 * Props:
 *  - onClick: callback to invoke the Redo action.
 *  - disabled?: optional boolean (defaults to false). When true, the button is non-interactive.
 */
export interface RedoButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const RedoButton: React.FC<RedoButtonProps> = ({ onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    title="Redo"
    aria-label="Redo"
  >
   <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1.5} 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"/>
          </svg> 
  </button>
);

/* -------------------------------------------------------------------------- */
/*                            MultiSelectButton                               */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Multi-Select” toggle button.  
 * Props:
 *  - isEnabled: whether multi-select is currently active. If true, a “+” badge appears.
 *  - onToggle: callback to toggle multi-select on/off.
 */
export interface MultiSelectButtonProps {
  isEnabled: boolean;
  onToggle: () => void;
}
export const MultiSelectButton: React.FC<MultiSelectButtonProps> = ({ isEnabled, onToggle }) => (
  <button
    onClick={onToggle}
    className={`toolbar-btn ${isEnabled ? 'active' : ''}`}
    title="Toggle Multi-Select"
    aria-label="Toggle Multi-Select"
  >
    <MousePointer size={20} />
    {isEnabled && (
      <span
        style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          width: '16px',
          height: '16px',
          backgroundColor: '#1976d2',
          color: 'white',
          fontSize: '10px',
          fontWeight: 600,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </span>
    )}
  </button>
);

/* -------------------------------------------------------------------------- */
/*                                 QuizButton                                  */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Quiz Generator” icon button.  
 * Props:
 *  - onClick: callback to open the quiz modal.  
 *  (No disabled state—always clickable.)
 */
export interface QuizButtonProps {
  onClick: () => void;
}
export const QuizButton: React.FC<QuizButtonProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="toolbar-btn"
    title="Quiz Generator"
    aria-label="Open Quiz Generator"
  >
    <ClipboardList size={20} />
  </button>
);

/* -------------------------------------------------------------------------- */
/*                               ZoomInButton                                 */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Zoom In” icon button (magnifier + plus).  
 * Props:
 *  - onClick: callback to perform zoom in.
 *  - disabled?: optional boolean (defaults to false). When true, it is non-interactive.
 */
export interface ZoomInButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const ZoomInButton: React.FC<ZoomInButtonProps> = ({ onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    title="Zoom In"
    aria-label="Zoom In"
  >
    {/* SVG: magnifier with plus inside */}
    <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1.5} 
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <path d="M11 8v6"/>
            <path d="M8 11h6"/>
          </svg>
  </button>
);

/* -------------------------------------------------------------------------- */
/*                              ZoomOutButton                                 */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Zoom Out” icon button (magnifier + minus).  
 * Props:
 *  - onClick: callback to perform zoom out.
 *  - disabled?: optional boolean (defaults to false). When true, it is non-interactive.
 */
export interface ZoomOutButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const ZoomOutButton: React.FC<ZoomOutButtonProps> = ({ onClick, disabled = false }) => (
  <button
  
    onClick={onClick}
    disabled={disabled}
    className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    title="Zoom Out"
    aria-label="Zoom Out"
  >
    {/* SVG: magnifier with minus inside */}
<svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1.5} 
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <path d="M8 11h6"/>
          </svg>
  </button>
);

/* -------------------------------------------------------------------------- */
/*                             PrevPageButton                                 */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Previous Page” icon button (left chevron).  
 * Props:
 *  - onClick: callback to go to the previous PDF page.
 *  - disabled?: optional boolean (defaults to false). When true, it is non-interactive.
 */
export interface PrevPageButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const PrevPageButton: React.FC<PrevPageButtonProps> = ({ onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`toolbar-btn ${disabled ? 'disabled' : ''}`}
    title="Previous Page"
    aria-label="Previous Page"
  >
    {/* SVG: left chevron */}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  </button>
);

/* -------------------------------------------------------------------------- */
/*                             NextPageButton                                 */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Next Page” icon button (right chevron).  
 * Props:
 *  - onClick: callback to go to the next PDF page.
 *  - disabled?: optional boolean (defaults to false). When true, it is non-interactive.
 */
export interface NextPageButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const NextPageButton: React.FC<NextPageButtonProps> = ({ onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`toolbar-btn ${disabled ? 'disabled' : ''}`}
    title="Next Page"
    aria-label="Next Page"
  >
    {/* SVG: right chevron */}
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </button>
);

/* -------------------------------------------------------------------------- */
/*                           PageInputField                                   */
/* -------------------------------------------------------------------------- */
/**
 * Renders a numeric input field for “Page” in PDF mode.  
 * Props:
 *  - currentValue: the current string value (e.g. “5”).
 *  - min: minimum page number allowed.
 *  - max: maximum page number allowed.
 *  - onChange: callback to update the input (receives new string).
 *  - onEnter: callback triggered when user presses Enter.
 *  - placeholder?: optional placeholder text (defaults to empty).
 *
 *  The input uses shared `.page-input` styling.
 */
export interface PageInputFieldProps {
  currentValue: string;
  min: number;
  max: number;
  onChange: (newVal: string) => void;
  onEnter: () => void;
  placeholder?: string;
}
export const PageInputField: React.FC<PageInputFieldProps> = ({
  currentValue,
  min,
  max,
  onChange,
  onEnter,
  placeholder = '',
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onEnter();
    }
  };

  return (
    <input
      type="number"
      min={min}
      max={max}
      value={currentValue}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      className="page-input"
      placeholder={placeholder}
      aria-label="Page number"
    />
  );
};

/* -------------------------------------------------------------------------- */
/*                              JumpButton                                     */
/* -------------------------------------------------------------------------- */
/**
 * Renders a “Go” (jump) button next to the PageInputField.  
 * Props:
 *  - onClick: callback that performs the page jump.
 *  - disabled?: optional boolean (defaults to false). When true, the button is non-interactive.
 *
 *  Uses shared `.btn-jump` styling.
 */
export interface JumpButtonProps {
  onClick: () => void;
  disabled?: boolean;
}
export const JumpButton: React.FC<JumpButtonProps> = ({ onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`btn-jump ${disabled ? 'disabled' : ''}`}
    title="Go to page"
    aria-label="Go to page"
  >
    Go
  </button>
);

// src/app/studygraph/(studygraph)/components/layout/CardDisplay/AddResourceDropdown.tsx

import React, {
  useState,
  useRef,
  useEffect,
  MouseEvent as ReactMouseEvent,
} from 'react';
import ReactDOM from 'react-dom';
import { Plus, ChevronDown, Star } from 'lucide-react';
import { FileText, NotepadText} from 'lucide-react';
import './actionfooterbuttons.css';

export type ResourceType = 'cuecard' | 'note'| 'quiz';

interface AddResourceDropdownProps {
  onSelectType: (type: ResourceType) => void;
  disabled?: boolean;
  askHandler: ()=> void
}

/**
 * This component renders an "Ask AI Assistant" button and an "Add card" button with dropdown.
 * When the Add card button is clicked, it opens a small white dropdown above it via a React portal.
 * The portal‐based menu is positioned using the button's screen coordinates and a very high z-index.
 */
const AddResourceDropdown: React.FC<AddResourceDropdownProps> = ({
  onSelectType,
  disabled = false,
  askHandler
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; bottom: number }>({
    left: 0,
    bottom: 0,
  });
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Measure the button's position and store in `coords` whenever we open the menu
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      // Position the top of the menu about 8px above the button's top:
      setCoords({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
      });
    }
  }, [isOpen]);

  // Close the menu if the user clicks outside of the button or the menu
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Recalculate position on window resize (if user resizes while menu is open)
  useEffect(() => {
    if (!isOpen) return;
    function handleResize() {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setCoords({
          left: rect.left,
          bottom: window.innerHeight - rect.top + 8,
        });
      }
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Toggle the dropdown when the user clicks the add card button
  function handleAddCardClick(e: ReactMouseEvent) {
    e.stopPropagation();
    if (disabled) return;
    setIsOpen((prev) => !prev);
  }

  // When the user selects an item, invoke callback and close menu
  function handleSelect(type: ResourceType) {
    onSelectType(type);
    setIsOpen(false);
  }

  // If disabled, always force menu closed
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  // A trivial Portal wrapper
  const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const hostRef = useRef<HTMLDivElement | null>(null);
    if (!hostRef.current) {
      hostRef.current = document.createElement('div');
    }
    useEffect(() => {
      const host = hostRef.current!;
      document.body.appendChild(host);
      return () => {
        document.body.removeChild(host);
      };
    }, []);
    return ReactDOM.createPortal(children, hostRef.current);
  };

  return (
    <div className="toolbar-container">
      {/* Ask AI Assistant Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={askHandler}
        className="toolbar-button ask-ai-button"
      >
        <Star className="toolbar-icon" />
        Ask AI Assistant
      </button>

      {/* Add Card Button with Dropdown */}
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={handleAddCardClick}
        className="toolbar-button add-card-button"
      >
        <Plus className="toolbar-icon" />
        Add Card
        <ChevronDown className="toolbar-icon" />
      </button>

      {/* When open, render the menu in a portal so it sits atop everything else */}
      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            className="dropdown-menu"
            style={{
              left: coords.left,
              bottom: coords.bottom,
              minWidth: anchorRef.current?.offsetWidth,
            }}
          >
            {(['cuecard', 'note'] as ResourceType[]).map((type) => {
              // Pick the right icon and label
              let Icon: JSX.Element;
              if (type === 'cuecard') 
                Icon = <FileText className="dropdown-item-icon" style={{ color: '#0ea5e9' }} />;
              else (type === 'note') 
                Icon = <NotepadText className="dropdown-item-icon" style={{ color: '#14b8a6' }} />;
              const label = type === 'cuecard' ? 'Cue Card' : 'Note';

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSelect(type)}
                  className="dropdown-item"
                >
                  {Icon}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </Portal>
      )}
    </div>
  );
};

export default AddResourceDropdown;
// src/app/studygraph/(studygraph)/components/layout/CardDisplay/AddResourceDropdown.tsx

import React, {
  useState,
  useRef,
  useEffect,
  MouseEvent as ReactMouseEvent,
} from 'react';
import ReactDOM from 'react-dom';
import { Plus, ChevronDown } from 'lucide-react';
import { FileText, NotepadText, Image as ImageIcon } from 'lucide-react';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

interface AddResourceDropdownProps {
  onSelectType: (type: ResourceType) => void;
  disabled?: boolean;
}

/**
 * This component renders an “Add card” button and, when clicked,
 * opens a small white dropdown above it via a React portal.
 * The portal‐based menu is positioned using the button’s screen
 * coordinates and a very high z-index so it will float above everything.
 */
const AddResourceDropdown: React.FC<AddResourceDropdownProps> = ({
  onSelectType,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; bottom: number }>({
    left: 0,
    bottom: 0,
  });
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Measure the button’s position and store in `coords` whenever we open the menu
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      // Position the top of the menu about 4px above the button’s top:
      setCoords({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 4,
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
          bottom: window.innerHeight - rect.top + 4,
        });
      }
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Toggle the dropdown when the user clicks the button
  function handleButtonClick(e: ReactMouseEvent) {
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
    <div className="inline-block relative">
      {/* Invisible hover‐bridge replaced by simple click geometry;  
          no need to worry about hover here. */}
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={handleButtonClick}
        className={`
          flex items-center gap-1.5 whitespace-nowrap font-medium
          transition-colors bg-gray-800 text-white rounded-md
          px-2.5 py-1.5 h-8 text-sm focus:outline-none
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#1D4ED8]'}
        `}
      >
        <Plus className="h-4 w-4 stroke-[1.5]" />
        Add card
        <ChevronDown className="h-4 w-4 stroke-[1.5]" />
      </button>

      {/* When open, render the menu in a portal so it sits atop everything else */}
      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              left: coords.left,
              bottom: coords.bottom,
              zIndex: 9999,
              backgroundColor: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
              borderRadius: '0.375rem', // matches Tailwind’s “rounded-md”
              minWidth: anchorRef.current?.offsetWidth,
            }}
          >
            {(['cuecard', 'note', 'image'] as ResourceType[]).map((type) => {
              // Pick the right icon and label
              let Icon: JSX.Element;
              if (type === 'cuecard') Icon = <FileText className="h-4 w-4 text-sky-600 stroke-[1.5]" />;
              else if (type === 'note') Icon = <NotepadText className="h-4 w-4 text-teal-600 stroke-[1.5]" />;
              else Icon = <ImageIcon className="h-4 w-4 text-indigo-600 stroke-[1.5]" />;

              const label = type === 'cuecard' ? 'Cue Card' : type === 'note' ? 'Note' : 'Image';

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSelect(type)}
                  className="
                    w-full px-2.5 py-1.5 text-sm flex items-center gap-2.5
                    bg-white text-gray-800 hover:bg-gray-50 transition-colors
                  "
                >
                  {Icon}
                  <span className="text-gray-800">{label}</span>
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

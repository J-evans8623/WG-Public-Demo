// src/app/studygraph/(studygraph)/components/layout/CardDisplay/AddResourceDropdown.tsx

import React, {
  useState,
  useRef,
  useEffect,
  MouseEvent as ReactMouseEvent,
} from 'react';

import {Star } from 'lucide-react';
import './actionfooterbuttons.css';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

interface AddResourceDropdownProps {
  disabled?: boolean;
  askHandler: ()=> void
}

/**
 * This component renders an "Ask AI Assistant" button and an "Add card" button with dropdown.
 * When the Add card button is clicked, it opens a small white dropdown above it via a React portal.
 * The portal‐based menu is positioned using the button's screen coordinates and a very high z-index.
 */
const AddResourceDropdown: React.FC<AddResourceDropdownProps> = ({
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

  // If disabled, always force menu closed
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

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
    </div>
  );
};

export default AddResourceDropdown;
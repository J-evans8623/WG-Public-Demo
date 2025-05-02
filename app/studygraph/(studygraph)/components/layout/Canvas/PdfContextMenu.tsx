// components/PdfContextMenu.tsx

/**
 * @file PdfContextMenu.tsx
 * @description
 *   Floating context menu for PDF pages, rendered via a React portal.
 *   • Displays fixed-position menu items: Copy, Ask Assistant, Explore Topic, Create Quiz.
 *   • Invokes the provided onSelect(action) callback when an item is clicked.
 *   • Closes itself only when clicking outside the menu, preserving inside-click handlers.
 *
 * Responsibilities:
 *   - Render menu at the correct viewport position (x, y).
 *   - Forward selected action to parent via onSelect.
 *   - Manage its own dismissal logic (outside clicks only).
 *   - Prevent default browser context menu and inner click propagation.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';


export type PdfAction = 'copy' | 'ask' | 'explore' | 'quiz';

interface PdfContextMenuProps {
  x: number;
  y: number;
  onSelect: (action: PdfAction) => void;
  onClose: () => void;
}

const PdfContextMenu: React.FC<PdfContextMenuProps> = ({ x, y, onSelect, onClose }) => {
  // Ref to the root <ul> to detect inside vs. outside clicks
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // Handler closes menu only if click occurs outside this menu
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    // Listen in bubbling phase so inner clicks fire first
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [onClose]);

  // Prevent browser context menu from appearing on right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Stop propagation on item clicks to avoid accidental outside-close
  const handleAction = (action: PdfAction) => {
    onSelect(action);
  };

  const menu = (
    <ul
      ref={menuRef}
      className="fixed bg-white border shadow-md rounded-md py-1 z-50"
      style={{ top: y, left: x, minWidth: 150 }}
      onContextMenu={handleContextMenu}
    >
      <li
        className="px-4 py-2 hover:bg-gray-100 cursor-pointer select-none"
        onClick={e => { e.stopPropagation(); handleAction('copy'); }}
      >
        Copy
      </li>
      <li
        className="px-4 py-2 hover:bg-gray-100 cursor-pointer select-none"
        onClick={e => { e.stopPropagation(); handleAction('ask'); }}
      >
        Ask Assistant
      </li>
      <li
        className="px-4 py-2 hover:bg-gray-100 cursor-pointer select-none"
        onClick={e => { e.stopPropagation(); handleAction('explore'); }}
      >
        Explore Topic
      </li>
      <li
        className="px-4 py-2 hover:bg-gray-100 cursor-pointer select-none"
        onClick={e => { e.stopPropagation(); handleAction('quiz'); }}
      >
        Create Quiz
      </li>
    </ul>
  );

  return createPortal(menu, document.body);
};

export default PdfContextMenu;

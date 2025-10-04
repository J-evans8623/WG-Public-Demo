/**
 * @file SessionContextMenuPortal.tsx
 * @responsibility
 *   Renders a minimal, fixed-position context menu for a single session, mounted
 *   via React Portal to `document.body`. Presents one checkbox action:
 *   "Mark session complete". Closes on outside click or Escape and prevents
 *   event propagation to avoid accidentally triggering other handlers.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SessionContextMenuPortalProps {
  position: { x: number; y: number };
  checked: boolean;
  onToggle: () => void;
  onClose: () => void;
}

/**
 * @function SessionContextMenuPortal
 * @description
 *   Fixed-position, single-action context menu.
 * @steps
 *   1) Mount a container at the viewport coordinates (position: fixed).
 *   2) Wire outside-click and Escape listeners to close the menu.
 *   3) Render one checkbox-style item that toggles completion.
 *   4) Stop propagation to avoid underlying click/launch handlers.
 */
const SessionContextMenuPortal: React.FC<SessionContextMenuPortalProps> = ({
  position,
  checked,
  onToggle,
  onClose,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Step 2: outside-click & Escape to close
  useEffect(() => {
    const handleDocMouseDown = (evt: MouseEvent) => {
      if (ref.current && !ref.current.contains(evt.target as Node)) onClose();
    };
    const handleKey = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleDocMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDocMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Step 1: compute fixed style near pointer
  const style: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    transform: 'translate(4px, 4px)',
    zIndex: 10000,
    pointerEvents: 'auto',
  };

  const node = (
    <div
      ref={ref}
      style={style}
      className="calendar-context-menu"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="calendar-context-menu-item"
        onClick={() => {
          // Step 3: toggle then close
          onToggle();
          onClose();
        }}
      >
        <input
          type="checkbox"
          readOnly
          checked={checked}
          className="calendar-context-menu-checkbox"
        />
        <span className="calendar-context-menu-label">Mark session complete</span>
      </button>
    </div>
  );

  // Step 4: render via portal
  return createPortal(node, document.body);
};

export default SessionContextMenuPortal;

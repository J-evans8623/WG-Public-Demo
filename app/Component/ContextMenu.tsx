// bloom-maps/app/Component/ContextMenu.tsx

'use client';

import React from 'react';

interface ContextMenuProps {
  position: { x: number; y: number };
  onSelectOption: (option: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ position, onSelectOption }) => {
  return (
    <div
      style={{ top: position.y, left: position.x }}
      className="absolute bg-white border rounded shadow-lg z-50"
    >
      <ul className="py-1">
        <li
          onClick={() => onSelectOption('New Map')}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
        >
          New Map
        </li>
        {/* Add more options as needed */}
      </ul>
    </div>
  );
};

export default ContextMenu;

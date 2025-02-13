import React, { useState, ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import AddResourceDropdown from './AddResourceDropdown';
import AIAssistantButton from './AIAssistantButton';
import FontSizeButton from './FontSizeButton';
import { ResourceType } from './AddResourceDropdown';

interface OverflowMenuProps {
  children: ReactNode;
}

interface ResponsiveHeaderProps {
  width: number;
  onAddResource: (type: ResourceType) => void;
}

const OverflowMenu: React.FC<OverflowMenuProps> = ({ children }) => {
  return (
    <div className="group relative inline-block">
      <button
        type="button"
        className="hover:bg-gray-100 p-2 h-8 w-8 rounded-md transition-colors"
        title="More options"
      >
        <MoreHorizontal className="h-4 w-4 text-gray-600" />
      </button>
      {/* Add invisible bridge to prevent menu from closing */}
      <div className="absolute w-full h-2 -bottom-2" />
      <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md z-50 invisible group-hover:visible border border-gray-200">
        <div className="py-1">
          {children}
        </div>
      </div>
    </div>
  );
};

const ResponsiveHeader: React.FC<ResponsiveHeaderProps> = ({ width, onAddResource }) => {
  const isNarrow = width < 300;

  return (
    <div className="p-4 border-b flex justify-between items-center bg-[#F8F9FA] sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {/* Primary buttons */}
        <div className="relative z-50">
          <AddResourceDropdown onSelectType={onAddResource} />
        </div>
        <div className="relative z-40">
          <AIAssistantButton />
        </div>
        
        {!isNarrow ? (
          <div className="border-l border-gray-200 ml-2 pl-2 flex items-center gap-1">
            <div className="relative z-30">
              <FontSizeButton />
            </div>
          </div>
        ) : (
          <div className="relative z-20">
            <OverflowMenu>
              <div className="px-2.5 py-1.5">
                <span className="text-sm text-gray-700">Font Size</span>
                <div className="mt-1 space-y-1">
                  {['Small', 'Medium', 'Large'].map((size) => (
                    <button
                      key={size}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-gray-50 rounded-md transition-colors"
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </OverflowMenu>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResponsiveHeader;
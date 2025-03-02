import React from 'react';
import { Type } from 'lucide-react';
import AddResourceDropdown from './AddResourceDropdown';
import AIAssistantButton from './AIAssistantButton';
import FontSizeButton from './FontSizeButton';
import { ResourceType } from './AddResourceDropdown';

interface ResponsiveHeaderProps {
  width: number;
  onAddResource: (type: ResourceType) => void;
}

const ResponsiveHeader: React.FC<ResponsiveHeaderProps> = ({ width, onAddResource }) => {
  return (
    <div className="bg-white border-b px-4 py-2 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        {/* Primary Actions Group */}
        <div className="flex items-center gap-2">
          {/* Add Button - Keep existing dropdown functionality */}
          <div className="relative z-50">
            <AddResourceDropdown onSelectType={onAddResource} />
          </div>

          {/* AI Assistant Button - Keep existing dropdown functionality */}
          <div className="relative z-40">
            <AIAssistantButton />
          </div>
        </div>

        {/* Secondary Actions */}
        <div className="flex items-center">
          {/* Font Size Button - Using existing component */}
          <div className="relative z-30">
            <FontSizeButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponsiveHeader;
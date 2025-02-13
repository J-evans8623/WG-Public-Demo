import React, { useState } from 'react';
import { Type } from 'lucide-react';

interface FontSizeButtonProps {
  className?: string;
}

type FontSize = 'small' | 'medium' | 'large';

const FontSizeButton: React.FC<FontSizeButtonProps> = ({ className }) => {
  const [currentSize, setCurrentSize] = useState<FontSize>('medium');

  const handleFontSizeChange = (size: FontSize) => {
    setCurrentSize(size);
    
    const sizes = {
      small: '14px',
      medium: '16px',
      large: '18px'
    };
    
    document.documentElement.style.setProperty('--content-font-size', sizes[size]);
  };

  return (
    <div className="group inline-block relative">
      <button
        type="button"
        className={`hover:bg-gray-100 p-2 h-8 w-8 rounded-md transition-colors ${className}`}
        title="Font Size"
      >
        <Type className="h-4 w-4 text-gray-600" />
      </button>
      {/* Bridge to prevent menu from closing */}
      <div className="absolute w-full h-2 -bottom-2" />
      <div className="absolute right-0 mt-1 w-32 bg-white shadow-lg rounded-md z-10 hidden group-hover:block border border-gray-200 py-1">
        <button
          onClick={() => handleFontSizeChange('small')}
          className={`w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 transition-colors
            ${currentSize === 'small' ? 'bg-gray-50' : ''}`}
        >
          <span className="text-sm">Small</span>
        </button>
        <button
          onClick={() => handleFontSizeChange('medium')}
          className={`w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 transition-colors
            ${currentSize === 'medium' ? 'bg-gray-50' : ''}`}
        >
          <span className="text-base">Medium</span>
        </button>
        <button
          onClick={() => handleFontSizeChange('large')}
          className={`w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 transition-colors
            ${currentSize === 'large' ? 'bg-gray-50' : ''}`}
        >
          <span className="text-lg">Large</span>
        </button>
      </div>
    </div>
  );
};

export default FontSizeButton;
import React, { useState } from 'react';
import { Presentation, Settings } from 'lucide-react';

interface SlideshowButtonProps {
  className?: string;
}

const SlideshowButton: React.FC<SlideshowButtonProps> = ({ className }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleAction = (action: () => void) => {
    action();
  };

  const toggleSlideshow = () => {
    setIsPlaying(!isPlaying);
    console.log(isPlaying ? 'Stopping slideshow' : 'Starting slideshow');
  };

  return (
    <div className="group inline-block relative">
      <button
        type="button"
        className={`hover:bg-gray-100 p-2 h-8 w-8 rounded-md transition-colors ${className}`}
        title="Slideshow"
      >
        <Presentation 
          className={`h-4 w-4 stroke-[1.5] ${isPlaying ? 'text-blue-600' : 'text-blue-500'}`} 
        />
      </button>
      {/* Bridge to prevent menu from closing */}
      <div className="absolute w-full h-2 -bottom-2" />
      <div className="absolute right-0 mt-1 w-32 bg-white shadow-lg rounded-md z-10 hidden group-hover:block border border-gray-200 py-1">
        <button
          type="button"
          onClick={() => handleAction(toggleSlideshow)}
          className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-gray-50 transition-colors"
        >
          <span>{isPlaying ? 'Stop Show' : 'Start Show'}</span>
        </button>
        <button
          type="button"
          onClick={() => handleAction(() => console.log('Opening slideshow settings'))}
          className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition-colors"
        >
          <Settings className="h-4 w-4 stroke-[1.5]" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default SlideshowButton;
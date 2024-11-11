// bloom-maps/app/Library/components/CueCard.tsx

import React, { useState, useEffect, useRef } from 'react';
import { CueCardProps, colorThemes } from '@/app/Library/Definitions/Definitions';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { FiX } from 'react-icons/fi';
import { createPortal } from 'react-dom';
import '@/app/Library/components/CardDisplay/CardDisplaySlide.css'; // Import the CSS file

interface CueCardPropsWithBloom extends CueCardProps {
  conceptNodeTitle: string;
  onDismiss?: () => void;
  source?: string;
}

const bloomLevelNames = {
  1: 'Remember',
  2: 'Understand',
  3: 'Apply',
  4: 'Analyze',
  5: 'Evaluate',
  6: 'Create',
};

const CueCard: React.FC<CueCardPropsWithBloom> = React.memo(
  ({ title, content, conceptNodeTitle, onDismiss, source }) => {
    const [showTitle, setShowTitle] = useState(true);
    const { colorTheme } = useColorThemeContext();

    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const cueCardRef = useRef<HTMLDivElement>(null);

    const handleClick = () => {
      setShowTitle(!showTitle);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenuVisible(true);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
    };

    const handleCopy = () => {
      const textToCopy = `${title}@${content}`;
      navigator.clipboard.writeText(textToCopy).then(() => {
        // Optional: Show a notification that the text was copied
        console.log('Cue card copied to clipboard');
      });
      setContextMenuVisible(false);
    };

    const handleOutsideClick = (e: MouseEvent) => {
      if (cueCardRef.current && !cueCardRef.current.contains(e.target as Node)) {
        setContextMenuVisible(false);
      }
    };

    useEffect(() => {
      if (contextMenuVisible) {
        document.addEventListener('click', handleOutsideClick);
      } else {
        document.removeEventListener('click', handleOutsideClick);
      }
      return () => {
        document.removeEventListener('click', handleOutsideClick);
      };
    }, [contextMenuVisible]);

    // Determine the color for the dot
    const themeColors = colorThemes[colorTheme];
    const bloomColor = themeColors[1];

    return (
      <>
        <div
          className="card card-cue"
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          ref={cueCardRef}
        >
          {/* Dismiss Button */}
          {onDismiss && (
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              title="Dismiss"
            >
              <FiX size={16} />
            </button>
          )}

          {/* Header: Concept Node Title and Colored Dot */}
          <div className="flex items-center mb-4">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: bloomColor }}
            ></div>
            <span className="multiline text-sm text-gray-800 font-medium">{conceptNodeTitle}</span>
          </div>

          {/* Content */}
          <div className="flex-grow overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 px-2">
            {showTitle ? (
              // Front of the card (Title View)
              <div className="h-full flex items-center justify-center">
                <h3 className=" font-bold text-xl text-gray-800 text-center leading-tight font-sans break-words">
                  {title}
                </h3>
              </div>
            ) : (
              // Back of the card (Content View)
              <div className="py-2">
                <p className="text-xl text-gray-600 text-left leading-relaxed font-sans break-words">
                  {content}
                </p>
              </div>
            )}
          </div>

          {/* Footer: Source Display */}
          {source && (
            <div className="text-xs text-gray-500 mt-4">
              <span>Source: {source}</span>
            </div>
          )}
        </div>

        {/* Custom Context Menu rendered using createPortal */}
        {contextMenuVisible &&
          createPortal(
            <div
              className="fixed bg-white border rounded shadow-md z-50"
              style={{ top: contextMenuPosition.y, left: contextMenuPosition.x }}
            >
              <ul className="list-none m-0 p-0">
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={handleCopy}
                >
                  Copy
                </li>
              </ul>
            </div>,
            document.body
          )}
      </>
    );
  }
);

CueCard.displayName = 'CueCard';
//CueCard.whyDidYouRender = true;

export default CueCard;

'use client';
import React, {useState}from 'react';
import {CueCardProps} from '@/app/Definitions/Definitions';

function CueCard({ title, content }: CueCardProps) {
    // State to track whether the card is showing the title or the content
    const [showTitle, setShowTitle] = useState(true);
  
    // Function to toggle between title and content
    const handleClick = () => {
      setShowTitle(!showTitle);
    };
  
    return (
      <div
        className="bg-white p-4 border rounded shadow-sm min-w-[150px] h-60 flex flex-col justify-center items-center cursor-pointer"
        onClick={handleClick} // Add click event handler
      >
        {showTitle ? (
          <h3 className="font-bold text-xl text-gray-800 text-center leading-tight font-sans">
            {title}
          </h3>
        ) : (
          <p className="text-xl text-gray-600 text-center leading-relaxed font-sans">
            {content}
          </p>
        )}
      </div>
    );
  }
  
  export default CueCard;
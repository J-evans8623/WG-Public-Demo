import React from 'react';
import { CueStackProps } from '@/app/Definitions/Definitions';



// Define colors representing Bloom's Taxonomy layers
/* const taxonomyColors = [
    'bg-red-500',   // Layer 1 color
    'bg-blue-500',  // Layer 2 color
    'bg-green-500', // Layer 3 color
    'bg-yellow-500' // Layer 4 color
  ]; */
  
  function CueStack({ cueCardCount , colorTheme }: CueStackProps) {
    // Limit the stack to a maximum of four cards
    const visibleCards = Math.min(cueCardCount, 4);
  
    return (
        <div className="relative w-8 h-12"> {/* Adjust width and height values as needed */}
          {Array.from({ length: visibleCards }).map((_, index) => (
            <div
              key={index}
              className="absolute rounded-lg shadow-lg"
              style={{
                width: '100%', // Adjust card width
                height: '100%', // Adjust card height
                top: `${index * 5}px`, // Adjusts the offset of each card
                left: `${index * 5}px`, // Adjusts the offset of each card
                zIndex: visibleCards - index, // Ensures correct stacking order
                backgroundColor: colorTheme[index], // Use the color from the theme
              }}
            />
          ))}
        </div>
      );
    }
    
  
  export default CueStack;

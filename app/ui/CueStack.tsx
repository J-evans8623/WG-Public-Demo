import React from 'react';
import { CueStackProps } from '@/app/Definitions/Definitions';



// CueStack provides a visualiztion of how many cards are in a current concept-node
// As each cueCard is added to a concept node, the stack of cards grow stopping at a 
// maximum of four stacked cards. More cards can be added, but this wont effect
// the visual appearance of the component. 
  
// Define colors representing Bloom's Taxonomy layers
/* const taxonomyColors = [
    'bg-red-500',   // Layer 1 color
    'bg-blue-500',  // Layer 2 color
    'bg-green-500', // Layer 3 color
    'bg-yellow-500' // Layer 4 color
  ]; */

  function CueStack({ cueCardCount, colorTheme, onClick }: CueStackProps) {
    // Limit the stack to a maximum of four cards
    const visibleCards = Math.min(cueCardCount, 4);
  
    return (
      <div
        className="relative w-8 h-12 cursor-pointer" // Add cursor-pointer to indicate it's clickable
        onClick={onClick} // Attach the onClick event
      >
        {Array.from({ length: visibleCards }).map((_, index) => (
          <div
            key={index}
            className="absolute rounded-lg shadow-lg"
            style={{
              width: '100%',
              height: '100%',
              top: `${index * 5}px`,
              left: `${index * 5}px`,
              zIndex: visibleCards - index,
              backgroundColor: colorTheme[index],
            }}
          />
        ))}
      </div>
    );
  }  export default CueStack;
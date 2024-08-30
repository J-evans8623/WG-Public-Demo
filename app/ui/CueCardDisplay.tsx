// bloom-maps/ui/CueCardDisplay.tsx
import React from 'react';
import CueCard from './CueCard'; // Assuming CueCard component already exists
import { CueCard as CueCardInterface, CueCardDisplayProps } from '@/app/Definitions/Definitions'; // Import the CueCard interface

/* Mock data for cue cards
const mockCueCards = [
    { id: '1', title: 'What are the defining characteristics of mammals?', content: 'Mammals are warm-blooded, have hair or fur, produce milk through mammary glands, and most give birth to live young.' },
    { id: '2', title: 'Why is the presence of mammary glands significant for mammals?', content: 'Mammary glands allow mothers to feed their young with milk, providing essential nutrients and antibodies that support early development and survival.' },
    { id: '3', title: 'How would a mammal\'s fur or hair help it adapt to different environments?', content: 'Fur or hair provides insulation against cold, camouflage for protection, and sometimes sensory input, helping mammals survive in diverse habitats.' },
    { id: '4', title: 'How do the reproductive strategies of mammals differ from those of reptiles, and what advantages do they offer?', content: 'Mammals typically give birth to live young and provide extended parental care, increasing offspring survival rates compared to reptiles, which often lay eggs and provide minimal care.' },
    
  // Add more cue cards as needed
]; */

function CueCardDisplay({ cueCards }: CueCardDisplayProps) {
    return (
      <div className="flex flex-col space-y-2">
        {/* Handle undefined cueCards by providing a default empty array */}
        {(cueCards || []).map((cueCard) => (
          <CueCard key={cueCard.id} title={cueCard.title} content={cueCard.content} />
        ))}
      </div>
    );
  }
  
  export default CueCardDisplay;
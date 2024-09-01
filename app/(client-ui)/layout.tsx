// bloom-maps/app/(client-ui)/layout.tsx

'use client';

import React, { useState } from 'react';
import Split from 'react-split'; // Client-side only component
import CueCardDisplay from '../ui/CueCardDisplay'; // Import the CueCardDisplay component
import ConceptMap from '../ui/ConceptMap'; // Import the ConceptMap component
import { CueCard } from '@/app/Definitions/Definitions'; // Import CueCard type
import { GlobalSettingsProvider } from '../ui/context/GlobalSettingsContext'; // Import the GlobalSettingsProvider

export default function ClientLayout() {
  // State to manage selected cue cards for display
  const [selectedCueCards, setSelectedCueCards] = useState<CueCard[]>([]);

  return (
    <GlobalSettingsProvider>
      <Split
        className="flex h-[calc(100vh-50px)]"
        sizes={[25, 55, 20]}
        minSize={[200, 300, 150]}
        maxSize={[400, Infinity, 300]}
        gutterSize={8}
        direction="horizontal"
        cursor="col-resize"
      >
        {/* Left Panel (Cue Card Viewer) */}
        <div className="bg-gray-200 p-4 shadow-lg rounded-lg overflow-y-auto min-w-[200px] flex flex-col space-y-2">
          {/* Display selected cue cards here */}
          <CueCardDisplay cueCards={selectedCueCards} />
        </div>

        {/* Center Pane (Map Canvas) */}
        <div className="flex-1 bg-white p-4 shadow-lg rounded-lg overflow-auto">
          {/* Render ConceptMap and pass down the setSelectedCueCards function */}
          <ConceptMap setSelectedCueCards={setSelectedCueCards} />
        </div>

        {/* Right Panel (Tool Interface) */}
        <div className="bg-white p-4 shadow-lg rounded-lg overflow-auto">
          {/* Dynamic content for future toolbar */}
        </div>
      </Split>
    </GlobalSettingsProvider>
  );
}

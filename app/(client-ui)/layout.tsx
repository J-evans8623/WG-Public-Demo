// /app/route-with-client-layout/layout.tsx
'use client';

import React from 'react';
import Split from 'react-split'; // Client-side only component

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
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
        {/* Dynamic content like CueCardDisplay */}
      </div>

      {/* Center Pane (Map Canvas) */}
      <div className="flex-1 bg-white p-4 shadow-lg rounded-lg overflow-auto">
        {children}
      </div>

      {/* Right Panel (Tool Interface) */}
      <div className="bg-white p-4 shadow-lg rounded-lg overflow-auto">
        {/* Dynamic content */}
      </div>
    </Split>
  );
}

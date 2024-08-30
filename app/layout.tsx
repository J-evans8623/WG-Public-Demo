// bloom-maps/app/layout.tsx
"use client"; // Ensure this component is rendered as a client component

import React from 'react';
import Split from 'react-split'; // Import Split from react-split
import './globals.css'; // Import global styles
import CueCardDisplay from './ui/CueCardDisplay';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden bg-gray-100">
        {/* Menu Bar at the Top */}
        <div className="flex items-center justify-between bg-gray-50 p-2 shadow-md">
          {/* Left Section with Menu Options */}
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
              New Doc
            </button>
            <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
              Open
            </button>
            <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
              Save
            </button>
          </div>
          {/* Right Section (Optional) - Can add more controls here */}
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
              Help
            </button>
          </div>
        </div>

        {/* Main Split Pane Layout */}
        <Split
          className="flex h-[calc(100vh-50px)]"
          sizes={[25, 55, 20]}
          minSize={[200, 300, 150]} // Set minimum size for the left panel
          gutterSize={8}
          direction="horizontal"
          cursor="col-resize"
        >
          {/* Left Panel (Slide Viewer) */}
          <div className="bg-gray-200 p-4 shadow-lg rounded-lg overflow-y-auto min-w-[200px] flex flex-col space-y-2">
            {/* Placeholder for Cue Cards */}
            <CueCardDisplay />
          </div>

          {/* Center Pane (Map Canvas) */}
          <div className="flex-1 bg-white p-4 shadow-lg rounded-lg overflow-auto">
            <h2 className="text-xl font-bold mb-2">Map Canvas</h2>
            <p className="text-gray-500">Concept map and nodes go here.</p>
            {children}
          </div>

          {/* Right Panel (Tool Interface) */}
          <div className="bg-white p-4 shadow-lg rounded-lg overflow-auto">
            <h2 className="text-xl font-bold mb-2">Tool Interface</h2>
            <p className="text-gray-500">Editing tools and settings.</p>
          </div>
        </Split>
      </body>
    </html>
  );
}

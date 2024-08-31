// /app/layout.tsx
import React from 'react';
import '@/app/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden bg-gray-100">
        {/* Static server-rendered content here */}
        <div className="flex items-center justify-between bg-gray-50 p-2 shadow-md">
          {/* Menu Options */}
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
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
              Help
            </button>
          </div>
        </div>
        {children} {/* Nested layouts and pages go here */}
      </body>
    </html>
  );
}

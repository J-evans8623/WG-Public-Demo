// /app/layout.tsx
import React from 'react';
import '@/app/globals.css'; // Import global CSS styles for consistent styling across all pages

// RootLayout component to define the main structure and layout of the application
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Main body of the application with full screen size and background color */}
      <body className="h-screen w-screen overflow-hidden bg-gray-100">

        {/* Static server-rendered content here */}
        <div className="flex items-center justify-between bg-gray-50 p-2 shadow-md">
          {/* Menu Options - Left Side */}
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

          {/* Menu Options - Right Side */}
          <div className="flex items-center space-x-4">
            <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
              Help
            </button>
          </div>
        </div>

        {/* Render nested layouts and pages dynamically here */}
        {children}
      </body>
    </html>
  );
}

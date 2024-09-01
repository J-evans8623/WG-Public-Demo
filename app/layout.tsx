// /app/layout.tsx

import React from 'react';
import '@/app/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden bg-gray-100">
        {/* Static server-rendered content here */}
        <div className="flex items-center justify-between bg-gray-50 p-2 shadow-md">
          {/* Placeholder for static elements */}
          {/* Dynamic buttons have been removed */}
        </div>
        {children} {/* Nested layouts and pages go here */}
      </body>
    </html>
  );
}

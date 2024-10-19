// /app/layout.tsx

import React from 'react';
import '@/app/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden bg-[#F9FBFD]">
        {/* Static server-rendered content here */}
        <div className="flex items-center justify-between bg-[#F9FBFD]">
          {/* Placeholder for static elements */}
        </div>

        {/* Wrapper with subtle margins to allow space without affecting client-ui layout */}
        <div className="w-full h-full px-6 py-4">
          {children} {/* Nested layouts and pages go here */}
        </div>
      </body>
    </html>
  );
}

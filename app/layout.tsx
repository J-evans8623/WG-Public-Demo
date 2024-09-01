// /app/layout.tsx

'use client';

import React, { useState } from 'react';
import '@/app/globals.css';
import DocumentCreationModal from './ui/DocumentCreationModal'; // Import the DocumentCreationModal
import { GlobalSettingsProvider } from './ui/context/GlobalSettingsContext'; // Import the GlobalSettingsProvider
import ClientLayout from './(client-ui)/layout'; // Import the updated ClientLayout

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleNewDocClick = () => {
    setIsModalOpen(true); // Open the modal for user input
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleDocumentCreate = () => {
    const rootLayoutElement = document.getElementById('root-layout');
  
    if (rootLayoutElement) {
      // Assuming 'resetDocument' is a method you define elsewhere
      (rootLayoutElement as any).resetDocument(); // Cast as 'any' to access the custom method
      console.log('New document created with specified Bloom Depth');
    } else {
      console.warn('The root layout element was not found.');
    }
  };

  return (
    <html lang="en">
      <body className="h-screen w-screen overflow-hidden bg-gray-100">
        <GlobalSettingsProvider>
          <DocumentCreationModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onCreate={handleDocumentCreate}
          />
          {/* Static server-rendered content here */}
          <div className="flex items-center justify-between bg-gray-50 p-2 shadow-md">
            {/* Menu Options */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleNewDocClick}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
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
          <ClientLayout /> {/* Load ClientLayout */}
        </GlobalSettingsProvider>
      </body>
    </html>
  );
}

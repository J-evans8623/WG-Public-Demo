// bloom-maps/app/ui/context/GlobalSettingsContext.tsx

'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import  useNodeManager from '@/app/ui/hooks/useNodeManager'; // Import the useNodeManager hook

// Define the types for settings
type ColorTheme = 'ThemeA' | 'ThemeB';
type BloomDepth = 1 | 2 | 3 | 4 | 5 | 6;

interface GlobalSettings {
  bloomDepth: BloomDepth;
  colorTheme: ColorTheme;
  setBloomDepth: (depth: BloomDepth) => void;
  setColorTheme: (theme: ColorTheme) => void;
  createNewDocument: (depth: BloomDepth) => void; // New function to create a new document
}

// Create the initial context with default values
const GlobalSettingsContext = createContext<GlobalSettings | undefined>(undefined);

// Create a provider component
export const GlobalSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [bloomDepth, setBloomDepth] = useState<BloomDepth>(4); // Default depth to 4
  const [colorTheme, setColorTheme] = useState<ColorTheme>('ThemeA'); // Default theme
  const { initializeNewDocument } = useNodeManager(); // Get the initializeNewDocument function from useNodeManager

  // Function to handle creating a new document
  const createNewDocument = (depth: BloomDepth) => {
    setBloomDepth(depth); // Update the bloom depth based on user selection
    initializeNewDocument(depth); // Call the hook function to reset and initialize a new document
  };

  return (
    <GlobalSettingsContext.Provider
      value={{ bloomDepth, colorTheme, setBloomDepth, setColorTheme, createNewDocument }}
    >
      {children}
    </GlobalSettingsContext.Provider>
  );
};

// Create a custom hook to use the GlobalSettingsContext
export const useGlobalSettings = () => {
  const context = useContext(GlobalSettingsContext);
  if (!context) {
    throw new Error('useGlobalSettings must be used within a GlobalSettingsProvider');
  }
  return context;
};

// bloom-maps/app/ui/context/GlobalSettingsContext.tsx

'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the types for settings
type ColorTheme = 'ThemeA' | 'ThemeB';
type BloomDepth = 1 | 2 | 3 | 4 | 5 | 6;

interface GlobalSettings {
  bloomDepth: BloomDepth;
  colorTheme: ColorTheme;
  setBloomDepth: (depth: BloomDepth) => void;
  setColorTheme: (theme: ColorTheme) => void;
}

// Create the initial context with default values
const GlobalSettingsContext = createContext<GlobalSettings | undefined>(undefined);

// Create a provider component
export const GlobalSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [bloomDepth, setBloomDepth] = useState<BloomDepth>(4); // Default depth to 4
  const [colorTheme, setColorTheme] = useState<ColorTheme>('ThemeA'); // Default theme

  return (
    <GlobalSettingsContext.Provider value={{ bloomDepth, colorTheme, setBloomDepth, setColorTheme }}>
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

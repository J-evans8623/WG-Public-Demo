// bloom-maps/app/Library/Context/colorThemeContext.tsx
'use client';

import React, { createContext, useReducer, useContext, ReactNode, useMemo } from 'react';
import { colorThemeReducer, initialColorThemeState } from './colorThemeReducer';
import { ColorThemeAction, ColorTheme } from '@/app/Library/Definitions/Definitions';
import { resetColorTheme as resetColorThemeAction } from './colorThemeActions';

interface ColorThemeContextValue {
  colorTheme: ColorTheme;
  primaryColor: string;
  backgroundColor: string;
  dispatch: React.Dispatch<ColorThemeAction>;
  resetColorTheme: () => void; // Add this
}

const ColorThemeContext = createContext<ColorThemeContextValue | undefined>(undefined);

export const ColorThemeProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(colorThemeReducer, initialColorThemeState);

  const contextValue = useMemo(() => ({
    ...state,
    dispatch,
    resetColorTheme: () => dispatch(resetColorThemeAction()), // Add this
  }), [state]);

  return (
    <ColorThemeContext.Provider value={contextValue}>
      {children}
    </ColorThemeContext.Provider>
  );
};

export const useColorThemeContext = () => {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error('useColorThemeContext must be used within a ColorThemeProvider');
  }
  return context;
};

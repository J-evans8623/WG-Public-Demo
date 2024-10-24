'use client';

import React, { createContext, useReducer, useContext, ReactNode, useMemo } from 'react';
import { colorThemeReducer, initialColorThemeState } from './colorThemeReducer';
import { ColorThemeAction, ColorTheme } from '@/app/Library/Definitions/Definitions';

interface ColorThemeContextValue {
  colorTheme: ColorTheme;
  primaryColor: string;
  backgroundColor: string;
  dispatch: React.Dispatch<ColorThemeAction>;
}

const ColorThemeContext = createContext<ColorThemeContextValue | undefined>(undefined);

export const ColorThemeProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(colorThemeReducer, initialColorThemeState);

  const contextValue = useMemo(() => ({
    ...state,
    dispatch,
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

/**
 * @file bloom-maps\app\Library\Context\LessonDataContext.tsx
 * @description
 *   This context provides state management for the lesson module list.
 *   It decouples lesson module data from FileAssetContext. The context exposes:
 *     - lessonModuleList: A Map storing lesson modules keyed by file ID.
 *     - addLessonModule: A method to add or update a lesson module.
 *     - clearLessonModuleList: A method to clear the lesson module list.
 *
 *   This context allows other parts of the frontend (e.g., useLessonModuleMapper)
 *   to listen to and consume the lesson module data without interfering with file upload data.
 *
 * @author 
 * @date 
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Define the type for the lesson module; since the backend response schema is complex,
// we use "any" to allow flexibility. In a real production environment, you may define a stricter type.
export type LessonModuleType = any;

// Define the shape of the context data.
interface LessonDataContextType {
  lessonModuleList: Map<string, LessonModuleType>;
  addLessonModule: (fileId: string, lessonModule: LessonModuleType) => void;
  clearLessonModuleList: () => void;
}

// Create the context.
const LessonDataContext = createContext<LessonDataContextType | undefined>(undefined);

// Provider component.
export const LessonDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Using a Map keyed by fileId for fast lookup.
  const [lessonModuleList, setLessonModuleList] = useState<Map<string, LessonModuleType>>(new Map());

  /**
   * addLessonModule
   * Adds or updates a lesson module in the context.
   */
  const addLessonModule = useCallback((fileId: string, lessonModule: LessonModuleType) => {
    console.log('[LessonDataContext] addLessonModule called with fileId:', fileId, 'and lessonModule:', lessonModule);
    setLessonModuleList((prev) => {
      const newMap = new Map(prev);
      newMap.set(fileId, lessonModule);
      console.log('[LessonDataContext] lessonModuleList updated. Current keys:', Array.from(newMap.keys()));
      return newMap;
    });
  }, []);

  /**
   * clearLessonModuleList
   * Clears all lesson modules from the context.
   */
  const clearLessonModuleList = useCallback(() => {
    console.log('[LessonDataContext] clearLessonModuleList called. Clearing all lesson modules.');
    setLessonModuleList(new Map());
  }, []);

  return (
    <LessonDataContext.Provider value={{ lessonModuleList, addLessonModule, clearLessonModuleList }}>
      {children}
    </LessonDataContext.Provider>
  );
};

/**
 * useLessonData
 * Custom hook to access the LessonDataContext.
 */
export const useLessonData = (): LessonDataContextType => {
  const context = useContext(LessonDataContext);
  if (!context) {
    throw new Error('useLessonData must be used within a LessonDataProvider');
  }
  return context;
};

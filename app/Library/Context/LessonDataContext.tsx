/**
 * LessonDataContext.tsx
 *
 * Responsibilities:
 *  - Expose lessonModuleList: Map<fileId, { lessonModules: any[]; streaming?: boolean }>
 *  - addLessonModule: now can accept a `streaming` flag on the payload.
 *  - clearLessonModuleList: reset entirely.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type LessonModulePayload = {
  lessonModules?: any[];
  streaming?: boolean;
};

interface LessonDataContextType {
  lessonModuleList: Map<string, LessonModulePayload>;
  addLessonModule: (fileId: string, payload: LessonModulePayload) => void;
  clearLessonModuleList: () => void;
}

const LessonDataContext = createContext<LessonDataContextType | undefined>(undefined);

export const LessonDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lessonModuleList, setLessonModuleList] = useState<Map<string, LessonModulePayload>>(new Map());

  const addLessonModule = useCallback((fileId: string, payload: LessonModulePayload) => {
    console.log('[LessonDataContext] addLessonModule', fileId, payload);
    setLessonModuleList(prev => {
      const m = new Map(prev);
      m.set(fileId, payload);
      return m;
    });
  }, []);

  const clearLessonModuleList = useCallback(() => {
    console.log('[LessonDataContext] clearLessonModuleList');
    setLessonModuleList(new Map());
  }, []);

  return (
    <LessonDataContext.Provider value={{ lessonModuleList, addLessonModule, clearLessonModuleList }}>
      {children}
    </LessonDataContext.Provider>
  );
};

export const useLessonData = (): LessonDataContextType => {
  const ctx = useContext(LessonDataContext);
  if (!ctx) throw new Error('useLessonData must be used within LessonDataProvider');
  return ctx;
};

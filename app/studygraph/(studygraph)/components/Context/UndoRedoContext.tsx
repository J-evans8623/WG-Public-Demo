// UndoRedoContext.tsx
/**
 * @file React context exposing global undo/redo functionality.
 * @description
 *   - Delegates to deltaEngine’s undo/redo/clearHistory.
 *   - Polls the engine’s canUndo/canRedo flags to update context state.
 *   - Provides undo(), redo(), clearHistory(), canUndo, canRedo to consumers.
 */

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    ReactNode
  } from 'react';
  import * as Engine from '../utils/deltaEngine';
  
  interface UndoRedoContextType {
    undo(): void;
    redo(): void;
    clearHistory(): void;
    canUndo: boolean;
    canRedo: boolean;
  }
  
  const UndoRedoContext = createContext<UndoRedoContextType | undefined>(undefined);
  
  export const UndoRedoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [canUndo, setCanUndo] = useState(Engine.canUndo());
    const [canRedo, setCanRedo] = useState(Engine.canRedo());
  
    const updateFlags = useCallback(() => {
      setCanUndo(Engine.canUndo());
      setCanRedo(Engine.canRedo());
    }, []);
  
    const undo = useCallback(() => {
      Engine.undo();
      updateFlags();
    }, [updateFlags]);
  
    const redo = useCallback(() => {
      Engine.redo();
      updateFlags();
    }, [updateFlags]);
  
    const clearHistory = useCallback(() => {
      Engine.clearHistory();
      updateFlags();
    }, [updateFlags]);
  
    // Poll the engine flags every 100ms to keep UI in sync.
    useEffect(() => {
      const interval = setInterval(updateFlags, 100);
      return () => clearInterval(interval);
    }, [updateFlags]);
  
    return (
      <UndoRedoContext.Provider
        value={{ undo, redo, clearHistory, canUndo, canRedo }}
      >
        {children}
      </UndoRedoContext.Provider>
    );
  };
  
  /** Hook to access global undo/redo controls. */
  export function useUndoRedo(): UndoRedoContextType {
    const ctx = useContext(UndoRedoContext);
    if (!ctx) {
      throw new Error('useUndoRedo must be used within UndoRedoProvider');
    }
    return ctx;
  }
  
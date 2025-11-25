/**
 * @file ResourceQuickActionsContext.tsx
 * @responsibility
 *  Provide a tiny, decoupled bridge so any ConceptNode can trigger right-rail draft creation
 *  without prop drilling. CardDisplay registers two callbacks (createNoteDraft, createCueCardDraft),
 *  and nodes call these via a hook. We store only function refs to avoid re-renders and keep
 *  the scope local to the canvas.
 */

import React, { createContext, useContext, useRef, useMemo } from 'react';

type QuickActions = {
  createNoteDraft?: () => void;
  createCueCardDraft?: () => void;
};

type QuickActionsContextType = {
  registerActions: (fns: Required<QuickActions>) => void;
  createNoteDraft: () => void;
  createCueCardDraft: () => void;
};

const ResourceQuickActionsContext = createContext<QuickActionsContextType | null>(null);

export const ResourceQuickActionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Store in refs to avoid re-renders when callbacks change
  const fnsRef = useRef<QuickActions>({});

  /**
   * registerActions
   * @purpose Let CardDisplay register the imperative quick-action callbacks.
   */
  const registerActions = (fns: Required<QuickActions>) => {
    fnsRef.current.createNoteDraft = fns.createNoteDraft;
    fnsRef.current.createCueCardDraft = fns.createCueCardDraft;
  };

  /**
   * createNoteDraft
   * @purpose Safely invoke the registered "note" draft creator.
   */
  const createNoteDraft = () => {
    fnsRef.current.createNoteDraft?.();
  };

  /**
   * createCueCardDraft
   * @purpose Safely invoke the registered "cue card" draft creator.
   */
  const createCueCardDraft = () => {
    fnsRef.current.createCueCardDraft?.();
  };

  const value = useMemo(
    () => ({ registerActions, createNoteDraft, createCueCardDraft }),
    []
  );

  return (
    <ResourceQuickActionsContext.Provider value={value}>
      {children}
    </ResourceQuickActionsContext.Provider>
  );
};

export const useResourceQuickActions = () => {
  const ctx = useContext(ResourceQuickActionsContext);
  if (!ctx) throw new Error('useResourceQuickActions must be used within ResourceQuickActionsProvider');
  return ctx;
};

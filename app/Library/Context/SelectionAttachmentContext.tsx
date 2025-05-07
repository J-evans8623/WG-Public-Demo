// app/Library/Context/SelectionAttachmentContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * @file SelectionAttachmentContext.tsx
 * @description
 *   Provides a centralized mechanism for carrying PDF-selected text ("attachment")
 *   into the Chat, Explore-Topic, and Quiz pipelines.
 *
 *   Responsibilities:
 *     - Store the last text captured from the PDF context menu.
 *     - Expose commands to trigger each pipeline and open its UI.
 *     - Allow consuming components to read `attachedText` and which pane/modal is open.
 *     - Provide a `clearAttachment()` to reset state when done.
 */

interface SelectionAttachmentContextValue {
  /** The text selection or full-page text from the PDF viewer */
  attachedText: string;
  /** Whether the Ask-Assistant pane should be opened */
  isAskOpen: boolean;
  /** Whether the Explore-Topic modal should be opened */
  isExploreOpen: boolean;
  /** Whether the Create-Quiz modal should be opened */
  isQuizOpen: boolean;
  /** Trigger the Ask Assistant flow with the given text */
  triggerAsk: (text: string) => void;
  /** Trigger the Explore Topic flow with the given text */
  triggerExplore: (text: string) => void;
  /** Trigger the Create Quiz flow with the given text */
  triggerQuiz: (text: string) => void;
  /** Reset attached text and close all pipelines */
  clearAttachment: () => void;
}

const SelectionAttachmentContext = createContext<SelectionAttachmentContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export const SelectionAttachmentProvider: React.FC<ProviderProps> = ({ children }) => {
  const [attachedText, setAttachedText] = useState<string>('');
  const [isAskOpen, setAskOpen] = useState<boolean>(false);
  const [isExploreOpen, setExploreOpen] = useState<boolean>(false);
  const [isQuizOpen, setQuizOpen] = useState<boolean>(false);

  const triggerAsk = (text: string) => {
    setAttachedText(text);
    setAskOpen(true);
    // ensure other modals are closed
    setExploreOpen(false);
    setQuizOpen(false);
  };

  const triggerExplore = (text: string) => {
    setAttachedText(text);
    setExploreOpen(true);
    setAskOpen(false);
    setQuizOpen(false);
  };

  const triggerQuiz = (text: string) => {
    setAttachedText(text);
    setQuizOpen(true);
    setAskOpen(false);
    setExploreOpen(false);
  };

  const clearAttachment = () => {
    setAttachedText('');
    setAskOpen(false);
    setExploreOpen(false);
    setQuizOpen(false);
  };

  return (
    <SelectionAttachmentContext.Provider
      value={{
        attachedText,
        isAskOpen,
        isExploreOpen,
        isQuizOpen,
        triggerAsk,
        triggerExplore,
        triggerQuiz,
        clearAttachment,
      }}
    >
      {children}
    </SelectionAttachmentContext.Provider>
  );
};

/**
 * Hook to consume the attached-text context.
 * @throws if used outside of SelectionAttachmentProvider
 */
export function useSelectionAttachment(): SelectionAttachmentContextValue {
  const ctx = useContext(SelectionAttachmentContext);
  if (!ctx) {
    throw new Error('useSelectionAttachment must be used within a SelectionAttachmentProvider');
  }
  return ctx;
}

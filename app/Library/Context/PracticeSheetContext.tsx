// bloom-maps\app\Library\Context\PracticeSheetContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the structure for a PracticeSheet with quizType and quizContent fields
export interface PracticeSheet {
  id: string;
  title: string;
  content: {
    quizType: 'matching' | 'multipleChoice' | 'wordProblem'; // New field for quiz type
    quizContent: string; // New field for actual content of the quiz
  };
}

// Define the context type
interface PracticeSheetContextType {
  practiceSheets: Map<string, PracticeSheet[]>;
  addPracticeSheet: (nodeId: string, practiceSheet: PracticeSheet) => void;
  removePracticeSheet: (nodeId: string, practiceSheetId: string) => void;
  selectPracticeSheets: (nodeId: string) => PracticeSheet[]; // Method to select practice sheets for a given nodeId
  resetPracticeSheets: () => void;
  setPracticeSheets: (newPracticeSheets: Map<string, PracticeSheet[]>) => void;
  transferPracticeSheet: (sourceNodeId: string, targetNodeId: string, practiceSheetId: string) => void;
  editPracticeSheet: (nodeId: string, updatedPracticeSheet: PracticeSheet) => void;
}

// Create the PracticeSheet context
const PracticeSheetContext = createContext<PracticeSheetContextType | undefined>(undefined);

// Serialization logic to handle the updated PracticeSheet structure
export const serializePracticeSheets = (practiceSheets: Map<string, PracticeSheet[]>): [string, PracticeSheet[]][] => {
  return Array.from(practiceSheets.entries());
};

export const PracticeSheetProvider = ({ children }: { children: ReactNode }) => {
  const [practiceSheets, setPracticeSheetsState] = useState<Map<string, PracticeSheet[]>>(new Map());

  const addPracticeSheet = (nodeId: string, practiceSheet: PracticeSheet) => {
    setPracticeSheetsState((prev) => {
      const updatedPracticeSheets = new Map(prev);
      const nodePracticeSheets = updatedPracticeSheets.get(nodeId) || [];
      updatedPracticeSheets.set(nodeId, [...nodePracticeSheets, practiceSheet]);
      return updatedPracticeSheets;
    });
  };

  const removePracticeSheet = (nodeId: string, practiceSheetId: string) => {
    setPracticeSheetsState((prev) => {
      const updatedPracticeSheets = new Map(prev);
      const nodePracticeSheets = updatedPracticeSheets.get(nodeId) || [];
      updatedPracticeSheets.set(nodeId, nodePracticeSheets.filter((sheet) => sheet.id !== practiceSheetId));
      return updatedPracticeSheets;
    });
  };

  const selectPracticeSheets = (nodeId: string): PracticeSheet[] => {
    return practiceSheets.get(nodeId) || [];
  };

  const resetPracticeSheets = () => {
    setPracticeSheetsState(new Map());
  };

  const setPracticeSheets = (newPracticeSheets: Map<string, PracticeSheet[]>) => {
    setPracticeSheetsState(newPracticeSheets);
  };

  const transferPracticeSheet = (sourceNodeId: string, targetNodeId: string, practiceSheetId: string) => {
    setPracticeSheetsState((prev) => {
      const updatedPracticeSheets = new Map(prev);
      const sourcePracticeSheets = updatedPracticeSheets.get(sourceNodeId) || [];
      const practiceSheet = sourcePracticeSheets.find((sheet) => sheet.id === practiceSheetId);
      if (!practiceSheet) return prev;

      // Remove from source
      updatedPracticeSheets.set(sourceNodeId, sourcePracticeSheets.filter((sheet) => sheet.id !== practiceSheetId));

      // Add to target
      const targetPracticeSheets = updatedPracticeSheets.get(targetNodeId) || [];
      updatedPracticeSheets.set(targetNodeId, [...targetPracticeSheets, practiceSheet]);

      return updatedPracticeSheets;
    });
  };

  const editPracticeSheet = (nodeId: string, updatedPracticeSheet: PracticeSheet) => {
    setPracticeSheetsState((prev) => {
      const updatedPracticeSheets = new Map(prev);
      const nodePracticeSheets = updatedPracticeSheets.get(nodeId) || [];
      updatedPracticeSheets.set(
        nodeId,
        nodePracticeSheets.map((sheet) =>
          sheet.id === updatedPracticeSheet.id ? updatedPracticeSheet : sheet
        )
      );
      return updatedPracticeSheets;
    });
  };

  return (
    <PracticeSheetContext.Provider
      value={{
        practiceSheets,
        addPracticeSheet,
        removePracticeSheet,
        selectPracticeSheets,
        resetPracticeSheets,
        setPracticeSheets,
        transferPracticeSheet,
        editPracticeSheet,
      }}
    >
      {children}
    </PracticeSheetContext.Provider>
  );
};

// Custom hook to use the PracticeSheetContext
export const usePracticeSheetContext = () => {
  const context = useContext(PracticeSheetContext);
  if (!context) {
    throw new Error('usePracticeSheetContext must be used within a PracticeSheetProvider');
  }
  return context;
};

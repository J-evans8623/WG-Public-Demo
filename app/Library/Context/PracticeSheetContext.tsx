// bloom-maps\app\Library\Context\PracticeSheetContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUndoRedoContext, UndoRedoActionType } from './UndoRedoContext'; 

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
  removeResource: (nodeId: string, practiceSheetId: string) => void;
  selectResources: (nodeId: string) => PracticeSheet[]; // Method to select practice sheets for a given nodeId
  resetPracticeSheets: () => void;
  setPracticeSheets: (newPracticeSheets: Map<string, PracticeSheet[]>) => void;
  transferResource: (sourceNodeId: string, targetNodeId: string, practiceSheetId: string) => void;
  editPracticeSheet: (nodeId: string, updatedPracticeSheet: PracticeSheet) => void;
  setPracticeSheetsState: React.Dispatch<React.SetStateAction<Map<string, PracticeSheet[]>>>
}

// Create the PracticeSheet context
const PracticeSheetContext = createContext<PracticeSheetContextType | undefined>(undefined);

// Serialization logic to handle the updated PracticeSheet structure
export const serializePracticeSheets = (practiceSheets: Map<string, PracticeSheet[]>): [string, PracticeSheet[]][] => {
  return Array.from(practiceSheets.entries());
};

export const PracticeSheetProvider = ({ children }: { children: ReactNode }) => {
  const [practiceSheets, setPracticeSheetsState] = useState<Map<string, PracticeSheet[]>>(new Map());
  const { recordAction} = useUndoRedoContext();

  const addPracticeSheet = (nodeId: string, practiceSheet: PracticeSheet) => {
    setPracticeSheetsState((prev) => {
      const updatedPracticeSheets = new Map(prev);
      const nodePracticeSheets = updatedPracticeSheets.get(nodeId) || [];
      updatedPracticeSheets.set(nodeId, [...nodePracticeSheets, practiceSheet]);

      recordAction(nodeId);

      return updatedPracticeSheets;
    });
  };

  const removeResource = (nodeId: string, practiceSheetId: string) => {
    setPracticeSheetsState((prev) => {
      const updatedPracticeSheets = new Map(prev);
      const nodePracticeSheets = updatedPracticeSheets.get(nodeId) || [];
      const removedPracticeSheet = nodePracticeSheets.find((sheet) => sheet.id === practiceSheetId);

      updatedPracticeSheets.set(nodeId, nodePracticeSheets.filter((sheet) => sheet.id !== practiceSheetId));

      // Record the action for undo
      if (removedPracticeSheet) {
        recordAction(nodeId);
      }
      return updatedPracticeSheets;
    });
  };

  const selectResources = (nodeId: string): PracticeSheet[] => {
    return practiceSheets.get(nodeId) || [];
  };

  const resetPracticeSheets = () => {
    setPracticeSheetsState(new Map());
  };

  const setPracticeSheets = (newPracticeSheets: Map<string, PracticeSheet[]>) => {
    setPracticeSheetsState(newPracticeSheets);
  };

  const transferResource = (sourceNodeId: string, targetNodeId: string, practiceSheetId: string) => {
    setPracticeSheetsState((prev) => {
      const updatedPracticeSheets = new Map(prev);
      const sourcePracticeSheets = updatedPracticeSheets.get(sourceNodeId) || [];
      const practiceSheet = sourcePracticeSheets.find((sheet) => sheet.id === practiceSheetId);
      if (!practiceSheet) return prev;
  
      // Create a copy of the practice sheet with a new unique ID
      const newPracticeSheet = { ...practiceSheet, id: uuidv4() };
  
      // Add the new practice sheet to the target node
      const targetPracticeSheets = updatedPracticeSheets.get(targetNodeId) || [];
      updatedPracticeSheets.set(targetNodeId, [...targetPracticeSheets, newPracticeSheet]);
  
      return updatedPracticeSheets;
    });
  };
  

  const editPracticeSheet = (nodeId: string, updatedPracticeSheet: PracticeSheet) => {
    setPracticeSheetsState((prev) => {
      const updatedPracticeSheets = new Map(prev);
      const nodePracticeSheets = updatedPracticeSheets.get(nodeId) || [];
      const originalPracticeSheet = nodePracticeSheets.find((sheet) => sheet.id === updatedPracticeSheet.id);

      updatedPracticeSheets.set(
        nodeId,
        nodePracticeSheets.map((sheet) =>
          sheet.id === updatedPracticeSheet.id ? updatedPracticeSheet : sheet
        )
      );

      // Record the action for undo
      if (originalPracticeSheet) {
        recordAction(nodeId);
      }
      
      return updatedPracticeSheets;
    });
  };

  return (
    <PracticeSheetContext.Provider
      value={{
        practiceSheets,
        addPracticeSheet,
        removeResource,
        selectResources,
        resetPracticeSheets,
        setPracticeSheets,
        transferResource,
        editPracticeSheet,
        setPracticeSheetsState,
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

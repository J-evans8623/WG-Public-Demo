// bloom-maps/app/Library/Context/CueCardContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CueCard } from '@/app/Library/Definitions/Definitions';

// Extend CueCardContextType to include the new selectCueCards method
interface CueCardContextType {
  cueCards: Map<string, CueCard[]>;
  addCueCard: (nodeId: string, cueCard: CueCard) => void;
  removeCueCard: (nodeId: string, cueCardId: string) => void;
  selectCueCards: (nodeId: string) => CueCard[]; // New method to select cue cards for a given nodeId
  resetCueCards: () => void; 
  setCueCards : (newCueCards: Map<string, CueCard[]>) => void; 
  editCueCard: (nodeId: string, updatedCueCard: CueCard) => void; // New function
  transferCueCard: (sourceNodeId: string, targetNodeId: string, cueCardId: string) => void;
}

// Create the CueCard context
const CueCardContext = createContext<CueCardContextType | undefined>(undefined);

export const serializeCueCards = (cueCards: Map<string, CueCard[]>): [string, CueCard[]][] => {
  return Array.from(cueCards.entries());
};

export const CueCardProvider = ({ children }: { children: ReactNode }) => {
  const [cueCards, setCueCardsState] = useState<Map<string, CueCard[]>>(new Map());

  const addCueCard = (nodeId: string, cueCard: CueCard) => {
    setCueCardsState((prev) => {
      const updatedCueCards = new Map(prev);
      const nodeCueCards = updatedCueCards.get(nodeId) || [];
      updatedCueCards.set(nodeId, [...nodeCueCards, cueCard]);
      return updatedCueCards;
    });
  };

  const removeCueCard = (nodeId: string, cueCardId: string) => {
    setCueCardsState((prev) => {
      const updatedCueCards = new Map(prev);
      const nodeCueCards = updatedCueCards.get(nodeId) || [];
      updatedCueCards.set(nodeId, nodeCueCards.filter((card) => card.id !== cueCardId));
      return updatedCueCards;
    });
  };

  // New function to select cue cards for a specific node
  const selectCueCards = (nodeId: string): CueCard[] => {
    return cueCards.get(nodeId) || [];
  };

  const resetCueCards = () => {
    setCueCardsState(new Map());
  };

  const setCueCards = (newCueCards: Map<string, CueCard[]>) => {
    setCueCardsState(newCueCards);
  };

  const editCueCard = (nodeId: string, updatedCueCard: CueCard) => {
    setCueCardsState((prev) => {
      const updatedCueCards = new Map(prev);
      const nodeCueCards = updatedCueCards.get(nodeId) || [];
      updatedCueCards.set(
        nodeId,
        nodeCueCards.map((card) => (card.id === updatedCueCard.id ? updatedCueCard : card))
      );
      return updatedCueCards;
    });
  };
  
  const transferCueCard = (sourceNodeId: string, targetNodeId: string, cueCardId: string) => {
    setCueCardsState((prev) => {
      const updatedCueCards = new Map(prev);
      const sourceCueCards = updatedCueCards.get(sourceNodeId) || [];
      const cueCard = sourceCueCards.find((card) => card.id === cueCardId);
      if (!cueCard) return prev;
  
      // Remove from source
      updatedCueCards.set(
        sourceNodeId,
        sourceCueCards.filter((card) => card.id !== cueCardId)
      );
  
      // Add to target
      const targetCueCards = updatedCueCards.get(targetNodeId) || [];
      updatedCueCards.set(targetNodeId, [...targetCueCards, cueCard]);
  
      return updatedCueCards;
    });
  };

  return (
    <CueCardContext.Provider
    value={{ cueCards, 
      addCueCard, 
      removeCueCard,
      selectCueCards, 
      resetCueCards, 
      setCueCards,
      editCueCard, 
      transferCueCard,
     }}
  >
      {children}
    </CueCardContext.Provider>
  );

  
};


// Custom hook to use the CueCardContext
export const useCueCardContext = () => {
  const context = useContext(CueCardContext);
  if (context === undefined) {
    throw new Error('useCueCardContext must be used within a CueCardProvider');
  }
  return context;
};

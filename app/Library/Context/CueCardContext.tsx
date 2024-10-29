// bloom-maps/app/Library/Context/CueCardContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CueCard } from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';

// Extend CueCardContextType to include the new selectCueCards method
interface CueCardContextType {
  cueCards: Map<string, CueCard[]>;
  addCueCard: (nodeId: string, cueCard: CueCard) => void;
  removeResource: (nodeId: string, cueCardId: string) => void;
  selectResources: (nodeId: string) => CueCard[]; // New method to select cue cards for a given nodeId
  resetCueCards: () => void; 
  setCueCards : (newCueCards: Map<string, CueCard[]>) => void; 
  editCueCard: (nodeId: string, updatedCueCard: CueCard) => void; // New function
  transferResource: (sourceNodeId: string, targetNodeId: string, cueCardId: string) => void;
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

  const removeResource = (nodeId: string, cueCardId: string) => {
    setCueCardsState((prev) => {
      const updatedCueCards = new Map(prev);
      const nodeCueCards = updatedCueCards.get(nodeId) || [];
      updatedCueCards.set(nodeId, nodeCueCards.filter((card) => card.id !== cueCardId));
      return updatedCueCards;
    });
  };

  // New function to select cue cards for a specific node
  const selectResources= (nodeId: string): CueCard[] => {
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
  

  const transferResource = (sourceNodeId: string, targetNodeId: string, cueCardId: string) => {
    setCueCardsState((prev) => {
      const updatedCueCards = new Map(prev);
      const sourceCueCards = updatedCueCards.get(sourceNodeId) || [];
      const cueCard = sourceCueCards.find((card) => card.id === cueCardId);
      if (!cueCard) return prev;
  
      // Create a copy of the cue card with a new unique ID
      const newCueCard = { ...cueCard, id: uuidv4() };
  
      // Add the new cue card to the target node
      const targetCueCards = updatedCueCards.get(targetNodeId) || [];
      updatedCueCards.set(targetNodeId, [...targetCueCards, newCueCard]);
  
      return updatedCueCards;
    });
  };

  return (
    <CueCardContext.Provider
    value={{ cueCards, 
      addCueCard, 
      removeResource,
      selectResources, 
      resetCueCards, 
      setCueCards,
      editCueCard, 
      transferResource,
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

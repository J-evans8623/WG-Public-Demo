'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the structure of the depth-wise dictionary
interface DepthWiseDictionary {
  [depth: number]: number[]; // Array of x-coordinates occupied at each depth level
}

// Define the context interface
interface PositionTrackingContextProps {
  occupiedPositions: DepthWiseDictionary;
  updatePosition: (depth: number, xCoordinate: number) => void;
  resetPositions: () => void;
  getPositionsAtDepth: (depth: number) => number[];
}

// Create the PositionTrackingContext with default values
const PositionTrackingContext = createContext<PositionTrackingContextProps>({
  occupiedPositions: {},
  updatePosition: () => {},
  resetPositions: () => {},
  getPositionsAtDepth: () => [],
});

// Provider component for managing and exposing the depth-wise dictionary
export const PositionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [occupiedPositions, setOccupiedPositions] = useState<DepthWiseDictionary>({});

  // Function to update the position at a specific depth
  const updatePosition = (depth: number, xCoordinate: number) => {
    setOccupiedPositions((prev) => {
      const updatedPositions = { ...prev };
      if (!updatedPositions[depth]?.includes(xCoordinate)) {
        if (!updatedPositions[depth]) {
          updatedPositions[depth] = [];
        }
        updatedPositions[depth].push(xCoordinate);
      }
      return updatedPositions;
    });
  };
// Function to reset all positions
  // Refactored function to reset all positions
  // Function to reset all positions
  const resetPositions = () => {
    setOccupiedPositions((prev) => {
      // Only reset if there is any occupied position stored
      if (Object.keys(prev).length !== 0) {
        return {};
      }
      return prev; // No update needed if already empty
    });
  };
  // Function to get positions occupied at a specific depth
  const getPositionsAtDepth = (depth: number): number[] => {
    return occupiedPositions[depth] || [];
  };

  // Provide the context values to children components
  return (
    <PositionTrackingContext.Provider
      value={{ occupiedPositions, updatePosition, resetPositions, getPositionsAtDepth }}
    >
      {children}
    </PositionTrackingContext.Provider>
  );
};

// Hook to use the PositionTrackingContext in other components
export const usePositionTracking = () => useContext(PositionTrackingContext);

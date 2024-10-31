// bloom-maps/app/Library/Context/PictureContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useUndoRedoContext, UndoRedoActionType } from './UndoRedoContext';


// Define the structure for a Picture
export interface Picture {
  id: string;
  title: string;
  image: File | null;
}

// Define the context type
interface PictureContextType {
  pictures: Map<string, Picture[]>;
  addPicture: (nodeId: string, picture: Picture) => void;
  removeResource: (nodeId: string, pictureId: string) => void;
  selectResources: (nodeId: string) => Picture[]; // Method to select pictures for a given nodeId
  resetPictures: () => void;
  setPictures: (newPictures: Map<string, Picture[]>) => void;
  editPicture: (nodeId: string, updatedPicture: Picture) => void;
  transferResource: (sourceNodeId: string, targetNodeId: string, pictureId: string) => void;
  setPicturesState: React.Dispatch<React.SetStateAction<Map<string, Picture[]>>>
}

// Create the Picture context
const PictureContext = createContext<PictureContextType | undefined>(undefined);

// bloom-maps/app/Library/Context/PictureContext.tsx

export const serializePictures = (
    pictures: Map<string, Picture[]>
  ): [string, { id: string; title: string; imagePath: string }[]][] => {
    const serialized: [string, { id: string; title: string; imagePath: string }[]][] = [];
    pictures.forEach((pictureArray, nodeId) => {
      const serializedPictures = pictureArray.map(pic => ({
        id: pic.id,
        title: pic.title,
        imagePath: `document/images/${pic.id}_${pic.image?.name}`, // Updated path
      }));
      serialized.push([nodeId, serializedPictures]);
    });
    return serialized;
  };
  
  

export const PictureProvider = ({ children }: { children: ReactNode }) => {
  const [pictures, setPicturesState] = useState<Map<string, Picture[]>>(new Map());
  const { recordAction} = useUndoRedoContext();

  const addPicture = (nodeId: string, picture: Picture) => {
    setPicturesState((prev) => {
      const updatedPictures = new Map(prev);
      const nodePictures = updatedPictures.get(nodeId) || [];
      updatedPictures.set(nodeId, [...nodePictures, picture]);

      recordAction(nodeId);

      return updatedPictures;
    });
  };

  const removeResource = (nodeId: string, pictureId: string) => {
    setPicturesState((prev) => {
      const updatedPictures = new Map(prev);
      const nodePictures = updatedPictures.get(nodeId) || [];

      const removedPicture = nodePictures.find((pic) => pic.id === pictureId);
      updatedPictures.set(nodeId, nodePictures.filter((pic) => pic.id !== pictureId));

      if (removedPicture) {
        recordAction(nodeId);
      }
      return updatedPictures;
    });
  };

  const selectResources = (nodeId: string): Picture[] => {
    return pictures.get(nodeId) || [];
  };

  const resetPictures = () => {
    setPicturesState(new Map());
  };

  const setPictures = (newPictures: Map<string, Picture[]>) => {
    setPicturesState(newPictures);
  };

  const editPicture = (nodeId: string, updatedPicture: Picture) => {
    setPicturesState((prev) => {
      const updatedPictures = new Map(prev);
      const nodePictures = updatedPictures.get(nodeId) || [];
      const originalPicture = nodePictures.find((pic) => pic.id === updatedPicture.id);

      updatedPictures.set(
        nodeId,
        nodePictures.map((pic) => (pic.id === updatedPicture.id ? updatedPicture : pic))
      );
      if (originalPicture) {
        recordAction(nodeId);
      }


      return updatedPictures;
    });
  };

  const transferResource = (sourceNodeId: string, targetNodeId: string, pictureId: string) => {
    setPicturesState((prev) => {
      const updatedPictures = new Map(prev);
      const sourcePictures = updatedPictures.get(sourceNodeId) || [];
      const picture = sourcePictures.find((pic) => pic.id === pictureId);
      if (!picture) return prev;
  
      // Create a copy of the picture with a new unique ID
      const newPicture = { ...picture, id: uuidv4() };
  
      // Add the new picture to the target node
      const targetPictures = updatedPictures.get(targetNodeId) || [];
      updatedPictures.set(targetNodeId, [...targetPictures, newPicture]);
  
      return updatedPictures;
    });
  };

  return (
    <PictureContext.Provider
      value={{
        pictures,
        addPicture,
        removeResource,
        selectResources,
        resetPictures,
        setPictures,
        editPicture,
        transferResource,
        setPicturesState,
      }}
    >
      {children}
    </PictureContext.Provider>
  );
};

// Custom hook to use the PictureContext
export const usePictureContext = () => {
  const context = useContext(PictureContext);
  if (!context) {
    throw new Error('usePictureContext must be used within a PictureProvider');
  }
  return context;
};

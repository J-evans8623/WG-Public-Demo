//bloom-maps\app\Library\Context\DocumentProvider.tsx
'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { documentReducer, initialDocumentState } from './documentReducer';


import { 
  ColorTheme, 
  ConceptNode, 
  DocumentState, 
  DocumentAction, 
  DocumentActionType 
} from '@/app/Library/Definitions/Definitions';


// Debounce function
function debounce(func: (...args: any[]) => void, delay: number) {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

// Create the context for the document state
const NewDocumentContext = createContext<{
  state: DocumentState;
  dispatch: React.Dispatch<DocumentAction>;
  zoomIn: () => void;
  zoomOut: () => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  setPrimaryColor: (color: string) => void; // New function to set primary color
  setBackgroundColor: (color: string) => void; // New function to set background color
} | undefined>(undefined);

// Define the provider component
export const DocumentProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(documentReducer, initialDocumentState);

  // Debounced zoom functions
  const debouncedZoomIn = debounce(() => dispatch(zoomIn()), 100);
  const debouncedZoomOut = debounce(() => dispatch(zoomOut()), 100);
  const handleSetColorTheme = (colorTheme: ColorTheme) => {
    dispatch(setColorTheme(colorTheme));
  };
  const handleSetPrimaryColor = (color: string) => {
    dispatch(setPrimaryColor(color));
  };

  const handleSetBackgroundColor = (color: string) => {
    dispatch(setBackgroundColor(color));
  };
  return (
    <NewDocumentContext.Provider 
    value={{ 
      state, 
      dispatch, 
      zoomIn: debouncedZoomIn, 
      zoomOut: debouncedZoomOut, 
      setColorTheme: handleSetColorTheme,
      setPrimaryColor: handleSetPrimaryColor, // Concept Node colors
      setBackgroundColor: handleSetBackgroundColor // Cocnept Node colors
       }}>
      {children}
    </NewDocumentContext.Provider>
  );
};

// Custom hook to use the NewDocumentContext
export const useDocumentContext = () => {
    
  const context = useContext(NewDocumentContext);
  if (context === undefined) {
    throw new Error('useDocumentContext must be used within a DocumentProvider');
  }
  return context;
};

export const setPrimaryColor = (color: string): DocumentAction => ({
  type: DocumentActionType.SET_PRIMARY_COLOR, // New action type
  payload: color,
});

export const setBackgroundColor = (color: string): DocumentAction => ({
  type: DocumentActionType.SET_BACKGROUND_COLOR, // New action type
  payload: color,
});
export const toggleResetMapSize = (): DocumentAction => ({
  type: DocumentActionType.TOGGLE_RESET_MAP_SIZE,
});

export const setNodes = (nodes: Map<string, ConceptNode>): DocumentAction => ({
  type: DocumentActionType.SET_NODES,
  payload: nodes,
});

export const setColorTheme = (colorTheme: ColorTheme): DocumentAction => ({
  type: DocumentActionType.SET_COLOR_THEME,
  payload: colorTheme,
});


export const updateNodeTitle = (nodeId: string, newTitle: string): DocumentAction => ({
  type: DocumentActionType.UPDATE_NODE_TITLE,
  payload: { nodeId, newTitle },
});

export const setGetLayout = (getLayout: boolean): DocumentAction => ({
    type: DocumentActionType.SET_GET_LAYOUT,
    payload: getLayout,
  });

export const createNewNode = (title: string, parentNodeId: string): DocumentAction => ({
  type: DocumentActionType.CREATE_NEW_NODE,
  payload: { title, parentNodeId },
});

export const resetGlobalData = (): DocumentAction => ({
  type: DocumentActionType.RESET_GLOBAL_DATA,
});

export const setMapSize = (groundWidth: number, mapWidth: number, mapHeight: number): DocumentAction => ({
  type: DocumentActionType.SET_MAP_SIZE,
  payload: { groundWidth, mapWidth, mapHeight },
});


export const initializeNewDocumentAction = (bloomDepth: 1 | 2 | 3 | 4 | 5 | 6, mapWidth: number, mapHeight: number): DocumentAction => ({
  type: DocumentActionType.INIT_NEW_DOCUMENT,
  payload: { bloomDepth, mapWidth, mapHeight },
});

// Action creators for zoom
export const zoomIn = (): DocumentAction => ({
  type: DocumentActionType.ZOOM_IN,
});

export const zoomOut = (): DocumentAction => ({
  type: DocumentActionType.ZOOM_OUT,
});

export const updateNode = (nodeId: string, updatedNode: Partial<ConceptNode>): DocumentAction => ({
    type: DocumentActionType.UPDATE_NODE,
    payload: { nodeId, updatedNode },
  });
  
  /**export const initializeNewDocument = (
   
    dispatch: React.Dispatch<DocumentAction>,
    resetCueCards: () => void, // Add this parameter
    resetTreeDimensions: () => void,
    bloomDepth: 1 | 2 | 3 | 4 | 5 | 6 = 6,
    groundWidth: number,
    isInitialLoad: boolean,
    mapWidth: number = 1800,
    mapHeight: number = 1800
  ) => {
    if (!isInitialLoad) {
      dispatch(resetGlobalData()); // Reset global state
      resetCueCards(); // Reset cue cards
      resetTreeDimensions();
    }
  
    // Dispatch action to set the map size
    dispatch(setMapSize(groundWidth, mapWidth, mapHeight));
  
    // Dispatch action to initialize the new document
    dispatch(initializeNewDocumentAction(bloomDepth, mapWidth, mapHeight));
  }; */
  export const initializeNewDocument = (
    dispatch: React.Dispatch<DocumentAction>,
    resetCueCards: () => void,
    resetTreeDimensions: () => void,
    resetSubtrees: () => void, // Add this parameter
    bloomDepth: 1 | 2 | 3 | 4 | 5 | 6 = 6,
    groundWidth: number,
    isInitialLoad: boolean,
    mapWidth: number = 1800,
    mapHeight: number = 1800
  ) => {
    if (!isInitialLoad) {
      dispatch(resetGlobalData());
      resetCueCards();
      resetTreeDimensions();
      resetSubtrees(); // Reset subtrees
    }
  
    dispatch(setMapSize(groundWidth, mapWidth, mapHeight));
    dispatch(initializeNewDocumentAction(bloomDepth, mapWidth, mapHeight));
  };
  /**
   * 
   * Where is the implementation of resetSubtree?
   */
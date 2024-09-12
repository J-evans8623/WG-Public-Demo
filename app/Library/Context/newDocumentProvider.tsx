'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { documentReducer, initialDocumentState } from './documentReducer';
import { 
  ColorTheme, 
  ConceptNode, 
  CueCard, 
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
} | undefined>(undefined);

// Define the provider component
export const NewDocumentProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(documentReducer, initialDocumentState);

  // Debounced zoom functions
  const debouncedZoomIn = debounce(() => dispatch(zoomIn()), 100);
  const debouncedZoomOut = debounce(() => dispatch(zoomOut()), 100);

  return (
    <NewDocumentContext.Provider value={{ state, dispatch, zoomIn: debouncedZoomIn, zoomOut: debouncedZoomOut }}>
      {children}
    </NewDocumentContext.Provider>
  );
};

// Custom hook to use the NewDocumentContext
export const useNewDocumentContext = () => {
  const context = useContext(NewDocumentContext);
  if (context === undefined) {
    throw new Error('useNewDocumentContext must be used within a NewDocumentProvider');
  }
  return context;
};

// Action creators
export const selectCueCards = (cueCards: CueCard[]): DocumentAction => ({
  type: DocumentActionType.SELECT_CUE_CARDS,
  payload: cueCards,
});

export const setNodes = (nodes: Map<string, ConceptNode>): DocumentAction => ({
  type: DocumentActionType.SET_NODES,
  payload: nodes,
});

export const setColorTheme = (colorTheme: ColorTheme): DocumentAction => ({
  type: DocumentActionType.SET_COLOR_THEME,
  payload: colorTheme,
});

export const addCueCardToNode = (nodeId: string, cueCard: CueCard): DocumentAction => ({
  type: DocumentActionType.ADD_CUE_CARD_TO_NODE,
  payload: { nodeId, cueCard },
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

export const initializeNewDocument = (
  dispatch: React.Dispatch<DocumentAction>, 
  bloomDepth: 1 | 2 | 3 | 4 | 5 | 6 = 6,
  groundWidth: number,
  isInitialLoad: boolean,
  mapWidth: number = 1800, // Assuming default values for map size
  mapHeight: number = 1800
) => {
  if (!isInitialLoad) {
    dispatch(resetGlobalData()); // Reset global state
  }

  // Dispatch action to set the map size
  dispatch(setMapSize(groundWidth, mapWidth, mapHeight));

  // Dispatch action to initialize the new document
  dispatch(initializeNewDocumentAction(bloomDepth, mapWidth, mapHeight));
};

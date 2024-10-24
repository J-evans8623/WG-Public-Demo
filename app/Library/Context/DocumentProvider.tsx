//bloom-maps\app\Library\Context\DocumentProvider.tsx
'use client';

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { documentReducer, initialDocumentState } from './documentReducer';
import { 
  ColorTheme, 
  ConceptNode, 
  DocumentState, 
  DocumentAction, 
  DocumentActionType,
  SerializedDocument,
  CueCard,
} from '@/app/Library/Definitions/Definitions';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { serializeCueCards } from '@/app/Library/Context/CueCardContext';
import { serializeSubtrees, SubtreeData } from '@/app/Library/Context/SubTreeProvider';
import { serializePictures, Picture } from '@/app/Library/Context/PictureContext';
import { serializePracticeSheets, PracticeSheet } from '@/app/Library/Context/PracticeSheetContext';


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

export const saveDocument = async (state: DocumentState, cueCards: Map<string, CueCard[]>, subtrees: Map<string, SubtreeData>, pictures: Map<string, Picture[]>, practiceSheets: Map<string, PracticeSheet[]>, fileName: string) => {
  const zip = new JSZip();

  // Serialize document data
  const serializedDocument = {
    ...serializeDocument(state),
    fileName  // Include fileName in the document metadata
  };
  const documentJson = JSON.stringify(serializedDocument);
  zip.file('document/document.json', documentJson);

  // Serialize cue cards
  const serializedCueCards = serializeCueCards(cueCards);
  const cueCardsJson = JSON.stringify(serializedCueCards);
  zip.file('document/cuecards.json', cueCardsJson);

  // Serialize subtrees
  const serializedSubtrees = serializeSubtrees(subtrees);
  const subtreesJson = JSON.stringify(serializedSubtrees);
  zip.file('document/subtrees.json', subtreesJson);

  // Serialize pictures metadata
  const serializedPictures = serializePictures(pictures);
  const picturesJson = JSON.stringify(serializedPictures);
  zip.file('document/pictures.json', picturesJson);

  // Serialize practice sheets
  const serializedPracticeSheets = serializePracticeSheets(practiceSheets);
  const practiceSheetsJson = JSON.stringify(serializedPracticeSheets);
  zip.file('document/practiceSheets.json', practiceSheetsJson);

  // Serialize styles
  const styles = {
    primaryColor: state.primaryColor,
    backgroundColor: state.backgroundColor,
    colorTheme: state.colorTheme,
  };
  const stylesJson = JSON.stringify(styles);
  zip.file('document/styles.json', stylesJson);

  // Add images to the ZIP under 'document/images/'
  for (const [nodeId, pictureArray] of pictures.entries()) {
    for (const picture of pictureArray) {
      if (picture.image) {
        try {
          const imageData = await picture.image.arrayBuffer();
          zip.file(`document/images/${picture.id}_${picture.image.name}`, imageData);
        } catch (error) {
          console.error(`Error saving image ${picture.id}:`, error);
        }
      }
    }
  }

  // Generate ZIP and trigger download
  try {
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${fileName || 'my_document'}.bloomdocx`);
  } catch (error) {
    console.error('Error generating ZIP:', error);
  }
};

export const loadDocument = async (
  file: File,
   dispatch: React.Dispatch<DocumentAction>,
   setCueCards: (cueCards: Map<string, CueCard[]>) => void, 
   setSubtrees: (subtrees: Map<string, SubtreeData>) => void, 
   setPictures: (pictures: Map<string, Picture[]>) => void, 
   setPracticeSheets: (practiceSheets: Map<string, PracticeSheet[]>) => void
  ) => {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const loadedFileName = file.name.replace(/\.[^/.]+$/, "");

  // Load document.json
  const documentFile = content.file('document/document.json');
  if (documentFile) {
    const documentJson = await documentFile.async('string');
    const parsedDocument = JSON.parse(documentJson) as SerializedDocument;

    // Reconstruct nodes Map
    const nodes = new Map<string, ConceptNode>(parsedDocument.nodes);
    dispatch(setNodes(nodes));
    dispatch(setPrimaryColor(parsedDocument.primaryColor));
    dispatch(setBackgroundColor(parsedDocument.backgroundColor));
    dispatch(setFileName(loadedFileName)); 
  }

  
  // Load cuecards.json
  const cueCardsFile = content.file('document/cuecards.json');
  if (cueCardsFile) {
    const cueCardsJson = await cueCardsFile.async('string');
    const parsedCueCards = JSON.parse(cueCardsJson) as [string, CueCard[]][];
    const cueCardsMap = new Map<string, CueCard[]>(parsedCueCards);
    setCueCards(cueCardsMap);
  }

  // Load subtrees.json
  const subtreesFile = content.file('document/subtrees.json');
  if (subtreesFile) {
    const subtreesJson = await subtreesFile.async('string');
    const parsedSubtrees = JSON.parse(subtreesJson) as [string, SubtreeData][];
    const subtreesMap = new Map<string, SubtreeData>(parsedSubtrees);
    setSubtrees(subtreesMap);
  }

  // Load pictures.json and images
  const picturesFile = content.file('document/pictures.json');
  if (picturesFile) {
    const picturesJson = await picturesFile.async('string');
    const parsedPictures = JSON.parse(picturesJson) as [string, { id: string; title: string; imagePath: string }[]][];
    const picturesMap = new Map<string, Picture[]>();

    for (const [nodeId, pictureArray] of parsedPictures) {
      const reconstructedPictures: Picture[] = [];
      for (const pic of pictureArray) {
        const imageFile = content.file(pic.imagePath);
        if (imageFile) {
          try {
            const imageBlob = await imageFile.async('blob');
            const imageURL = URL.createObjectURL(imageBlob);
            const imageFileObject = new File([imageBlob], pic.imagePath.split('/').pop() || 'image', { type: imageBlob.type });
            reconstructedPictures.push({
              id: pic.id,
              title: pic.title,
              image: imageFileObject,
            });
          } catch (error) {
            console.error(`Error loading image ${pic.id}:`, error);
          }
        } else {
          console.warn(`Image file not found: ${pic.imagePath}`);
        }
      }
      picturesMap.set(nodeId, reconstructedPictures);
    }
    setPictures(picturesMap);
  }

  // Load practiceSheets.json
  const practiceSheetsFile = content.file('document/practiceSheets.json');
  if (practiceSheetsFile) {
    const practiceSheetsJson = await practiceSheetsFile.async('string');
    const parsedPracticeSheets = JSON.parse(practiceSheetsJson) as [string, PracticeSheet[]][];
    const practiceSheetsMap = new Map<string, PracticeSheet[]>(parsedPracticeSheets);
    setPracticeSheets(practiceSheetsMap);
  }

  // Load styles.json
  const stylesFile = content.file('document/styles.json');
  if (stylesFile) {
    const stylesJson = await stylesFile.async('string');
    const styles = JSON.parse(stylesJson);
    dispatch(setPrimaryColor(styles.primaryColor));
    dispatch(setBackgroundColor(styles.backgroundColor));
  }

  // Trigger layout computation if necessary
  dispatch(setGetLayout(true));
};



// Create the context for the document state
const NewDocumentContext = createContext<{
  state: DocumentState;
  dispatch: React.Dispatch<DocumentAction>;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoomLevel: (zoomLevel: number) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  setPrimaryColor: (color: string) => void; // New function to set primary color
  setBackgroundColor: (color: string) => void; // New function to set background color
} | undefined>(undefined);

// Define the provider component
export const DocumentProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(documentReducer, initialDocumentState);

  // Debounced zoom functions
  // Memoized debounced zoom functions
  const debouncedZoomIn = useCallback(
    debounce(() => dispatch(zoomIn()), 100),
    [dispatch]
  );
  const debouncedZoomOut = useCallback(
    debounce(() => dispatch(zoomOut()), 100),
    [dispatch]
  );
  const debouncedSetZoomLevel = useCallback(
    debounce((zoomLevel: number) => dispatch(setZoomLevel(zoomLevel)), 100),
    [dispatch]
  );

  const handleSetColorTheme = useCallback(
    (colorTheme: ColorTheme) => {
      dispatch(setColorTheme(colorTheme));
    },
    [dispatch]
  );

  const handleSetPrimaryColor = useCallback(
    (color: string) => {
      dispatch(setPrimaryColor(color));
    },
    [dispatch]
  );

  const handleSetBackgroundColor = useCallback(
    (color: string) => {
      dispatch(setBackgroundColor(color));
    },
    [dispatch]
  );
  return (
    <NewDocumentContext.Provider 
    value={{ 
      state, 
      dispatch, 
      zoomIn: debouncedZoomIn, 
      zoomOut: debouncedZoomOut,
      setZoomLevel: debouncedSetZoomLevel,
      setColorTheme: handleSetColorTheme,
      setPrimaryColor: handleSetPrimaryColor, // Concept Node colors
      setBackgroundColor: handleSetBackgroundColor // Cocnept Node colors
       }}>
      {children}
    </NewDocumentContext.Provider>
  );
};

export const serializeDocument = (state: DocumentState): SerializedDocument => {
  const { nodes, colorTheme, primaryColor, backgroundColor, fileName } = state;
  // Convert Map to an array for serialization
  const nodesArray = Array.from(nodes.entries());

  return {
    nodes: nodesArray,
    colorTheme,
    primaryColor,
    backgroundColor,
    fileName,  // Include fileName in the serialized document
  };
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

export const setFileName = (fileName: string): DocumentAction => ({
  type: DocumentActionType.SET_FILE_NAME,
  payload: fileName,
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

export const setZoomLevel = (zoomLevel: number): DocumentAction => ({
    type: DocumentActionType.SET_ZOOM_LEVEL,
    payload: zoomLevel,
  });

export const createNewNode = 
(title: string, 
parentNodeId: string,
newNodeId: string
): DocumentAction => ({
  type: DocumentActionType.CREATE_NEW_NODE,
  payload: {newNodeId, title, parentNodeId },
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
  
  export const initializeNewDocument = (
    dispatch: React.Dispatch<DocumentAction>,
    resetCueCards: () => void,
    resetTreeDimensions: () => void,
    resetSubtrees: () => void, 
    resetPictures: () => void, // New reset function for pictures
    resetPracticeSheets: () => void, // New reset function for practice sheets
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
      resetSubtrees();
      resetPictures(); // Reset pictures
      resetPracticeSheets(); // Reset practice sheets
    }
  
    dispatch(setMapSize(groundWidth, mapWidth, mapHeight));
    dispatch(initializeNewDocumentAction(bloomDepth, mapWidth, mapHeight));
    dispatch(setFileName('Untitled Document'));
  };
  


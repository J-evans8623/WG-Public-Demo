/**
 * @file documentUtils.ts
 * @description 
 * Utility functions for handling document serialization, saving, loading, and initialization.
 * These functions manage the conversion of document data to and from JSON formats,
 * handle file operations like saving and loading .bloomdocx files,
 * and initialize new documents with default settings.
 * 
 * Additionally, this file implements mode-dependent functionality to handle
 * different behaviors when operating in 'private' mode versus 'collaborate' mode.
 * In 'collaborate' mode, additional metadata and conflict resolution information
 * are included to maintain data integrity across multiple users.
 * 
 * This ensures that the application can seamlessly switch between private and
 * collaborative workflows without compromising on functionality or performance.
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  ConceptNode,
  CueCardResource,
  SubtreeData,
  PictureResource,
  PracticeSheetResource,
  SerializedDocument,
  ColorTheme,
  ResourceCard,
} from '@/app/Library/Definitions/Definitions';

import { resetColorTheme } from '@/app/Library/Context/colorThemeActions';
import { Descendant } from 'slate';
import { toast } from 'react-toastify';
import * as Y from 'yjs';



/**
 * Function to serialize cue cards.
 * Converts a Map of cue cards into an array of tuples for JSON serialization.
 * 
 * @param cueCards - Map where key is nodeId and value is an array of CueCardResource
 * @returns Array of [nodeId, CueCardResource[]] tuples
 */
export const serializeCueCards = (cueCards: Map<string, CueCardResource[]>): [string, CueCardResource[]][] => {
  return Array.from(cueCards.entries());
};

/**
 * Function to serialize practice sheets.
 * Converts a Map of practice sheets into an array of tuples for JSON serialization.
 * 
 * @param practiceSheets - Map where key is nodeId and value is an array of PracticeSheetResource
 * @returns Array of [nodeId, PracticeSheetResource[]] tuples
 */
export const serializePracticeSheets = (
  practiceSheets: Map<string, PracticeSheetResource[]>
): [string, PracticeSheetResource[]][] => {
  return Array.from(practiceSheets.entries());
};

/**
 * Function to serialize pictures.
 * Converts a Map of pictures into an array of tuples with image paths for JSON serialization.
 * 
 * @param pictures - Map where key is nodeId and value is an array of PictureResource
 * @returns Array of [nodeId, { id, title, imagePath, description }[]] tuples
 */
export const serializePictures = (
  pictures: Map<string, PictureResource[]>
): [string, { id: string; title: string; imagePath: string; description?: Descendant[]; source?: string }[]][] => {
  const serialized: [string, { id: string; title: string; imagePath: string; description?: Descendant[]; source?: string }[]][] = [];
  pictures.forEach((pictureArray, nodeId) => {
    const serializedPictures = pictureArray.map(pic => ({
      id: pic.id,
      title: pic.title,
      // We keep imagePath reference; actual image binary goes separately.
      imagePath: `document/images/${pic.id}_${pic.image?.name}`,
      // Include the description directly as Descendant[]
      description: pic.description || [{ type: 'paragraph', children: [{ text: '' }] }],
      source: pic.source || '',
    }));
    serialized.push([nodeId, serializedPictures]);
  });
  return serialized;
};

/**
 * Function to serialize document data.
 * Converts nodes and styling information into a SerializedDocument object.
 * 
 * @param nodes - Map of ConceptNode with nodeId as key
 * @param colorTheme - Current color theme
 * @param primaryColor - Primary color of the theme
 * @param backgroundColor - Background color of the theme
 * @param fileName - Name of the document file
 * @returns SerializedDocument object
 */
export const serializeDocument = (
  nodes: Map<string, ConceptNode>,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string
): SerializedDocument => {
  const nodesArray = Array.from(nodes.entries());

  return {
    nodes: nodesArray,
    colorTheme,
    primaryColor,
    backgroundColor,
    fileName,
  };
};


// Helper functions for loading different resource types
const loadCueCards = async (zip: JSZip): Promise<Map<string, CueCardResource[]>> => {
  const cueCardsMap = new Map<string, CueCardResource[]>();
  const cueCardsFile = zip.file('document/cuecards.json');
  
  if (cueCardsFile) {
    const cueCardsJson = await cueCardsFile.async('string');
    const parsedCueCards = JSON.parse(cueCardsJson) as [string, CueCardResource[]][];
    parsedCueCards.forEach(([nodeId, resources]) => {
      cueCardsMap.set(nodeId, resources);
    });
  }
  
  return cueCardsMap;
};

const loadPictures = async (zip: JSZip): Promise<Map<string, PictureResource[]>> => {
  const picturesMap = new Map<string, PictureResource[]>();
  const picturesFile = zip.file('document/pictures.json');
  
  if (picturesFile) {
    const picturesJson = await picturesFile.async('string');
    const parsedPictures = JSON.parse(picturesJson) as [
      string,
      { id: string; title: string; imagePath: string; description?: Descendant[]; source?: string }[]
    ][];

    await Promise.all(
      parsedPictures.map(async ([nodeId, pictureArray]) => {
        const reconstructedPictures: PictureResource[] = [];
        
        await Promise.all(
          pictureArray.map(async (pic) => {
            const imageFile = zip.file(pic.imagePath);
            if (imageFile) {
              const imageBlob = await imageFile.async('blob');
              const imageFileObject = new File(
                [imageBlob],
                pic.imagePath.split('/').pop() || 'image',
                { type: imageBlob.type }
              );

              reconstructedPictures.push({
                id: pic.id,
                title: pic.title,
                type: 'picture',
                nodeId: nodeId,
                image: imageFileObject,         // Store File object directly
                localUrl: URL.createObjectURL(imageFileObject), // For UI rendering
                serverUrl: undefined,           // Will be set when syncing
                description: pic.description || [{ type: 'paragraph', children: [{ text: '' }] }],
                source: pic.source || ''
              });
            }
          })
        );
        
        if (reconstructedPictures.length > 0) {
          picturesMap.set(nodeId, reconstructedPictures);
        }
      })
    );
  }
  
  return picturesMap;
};

const loadPracticeSheets = async (zip: JSZip): Promise<Map<string, PracticeSheetResource[]>> => {
  const practiceSheetsMap = new Map<string, PracticeSheetResource[]>();
  const practiceSheetsFile = zip.file('document/practiceSheets.json');
  
  if (practiceSheetsFile) {
    const practiceSheetsJson = await practiceSheetsFile.async('string');
    const parsedPracticeSheets = JSON.parse(practiceSheetsJson) as [
      string,
      PracticeSheetResource[]
    ][];
    parsedPracticeSheets.forEach(([nodeId, resources]) => {
      practiceSheetsMap.set(nodeId, resources);
    });
  }
  
  return practiceSheetsMap;
};


/**
 * Function to initialize a new document with default settings using system transactions.
 * All initialization operations are wrapped in a system transaction to prevent WebSocket updates.
 * 
 * @param ydoc - The Y.Doc instance to initialize
 * @param resetNode - Function to reset nodes
 * @param initNodes - Function to initialize nodes
 * @param layoutDispatch - Dispatch function to update layout state
 * @param fileDispatch - Dispatch function to update file-related state
 * @param colorThemeDispatch - Dispatch function to update color theme state
 * @param resetSubtrees - Function to reset subtrees
 * @param resetResources - Function to reset resources
 * @param bloomDepth - Depth level of the bloom taxonomy
 * @param isInitialLoad - Flag to indicate if it's the initial load
 * @param mapWidth - Width of the map layout
 * @param mapHeight - Height of the map layout
 */
export const initializeNewDocument = async (
     createNewDocument: () => Promise<void>,  
    layoutDispatch: React.Dispatch<any>,
    colorThemeDispatch: React.Dispatch<any>,
    mapWidth: number = 1800,// used to make a layout dispatch call .. can be moved up to topbar.tsx 
    mapHeight: number = 1800 // used to make a layout dispatch call .. can be moved up to topbar.tsx 
  ): Promise<void> => {
        try {

        await createNewDocument();
        console.log('Starting transactional document initialization');
  

        colorThemeDispatch(resetColorTheme()); 
        
  
        // Second phase: Initialize new state
        console.log('Initializing new document state...');
        
        // Set map size
        layoutDispatch({ // this can be lifted to top bar.tsx
          type: 'SET_MAP_SIZE', 
          payload: { 
            mapWidth: mapWidth || 1800, 
            mapHeight: mapHeight || 1800 
          } 
        });
  
        console.log('Document initialization completed successfully');
        toast.success('New document initialized successfully.');
      } catch (error) {
        console.error('Error initializing document:', error);
        toast.error('Failed to initialize new document');
        throw error;
      }
    }

/**
 * Loads a document from Google Drive using a system transaction.
 */
export const loadDocumentFromDrive = async (
  file: Blob,
  loadData: (
    fileName: string,
    driveFileId: string | undefined,
    docState: Uint8Array
  ) => Promise<void>,
  fileId: string,
  loadImages: (imageData: Map<string, ArrayBuffer>) => void,
  colorThemeDispatch: React.Dispatch<any>
): Promise<void> => {
  try {
    console.log('Starting document load from drive');

    const zip = new JSZip();
    await zip.loadAsync(file);

    // 1. Load Y.doc state
    const yjsStateFile = zip.file('document/yjsState.bin');
    if (!yjsStateFile) {
      throw new Error('Invalid document format: missing Y.doc state');
    }
    const yjsState = await yjsStateFile.async('uint8array');

    // 2. Load metadata
    const metadataFile = await zip.file('document/metadata.json')?.async('string');
    const metadata = metadataFile ? JSON.parse(metadataFile) : { 
      fileName: `${fileId}.bloomdocx`
    };

    // 3. Load styles
    const stylesFile = await zip.file('document/styles.json')?.async('string');
    if (stylesFile) {
      const { primaryColor, backgroundColor, colorTheme } = JSON.parse(stylesFile);
      colorThemeDispatch({ type: 'SET_PRIMARY_COLOR', payload: primaryColor });
      colorThemeDispatch({ type: 'SET_BACKGROUND_COLOR', payload: backgroundColor });
      colorThemeDispatch({ type: 'SET_COLOR_THEME', payload: colorTheme });
    }

    // 4. Load images
    const imageBuffers = new Map<string, ArrayBuffer>();
    const imageFiles = Object.entries(zip.files).filter(([path]) => 
      path.startsWith('document/images/'));
    
    for (const [path, file] of imageFiles) {
      const imageId = path.split('/').pop()!;
      const buffer = await file.async('arraybuffer');
      imageBuffers.set(imageId, buffer);
    }
    loadImages(imageBuffers);

    // 5. Initialize data with binary state
    await loadData(
      metadata.fileName,
      fileId,  // Use provided fileId
      yjsState
    );

    toast.success('Document loaded successfully from Drive');
  } catch (error) {
    console.error('Error loading document from drive:', error);
    toast.error('Failed to load document from drive');
    throw error;
  }
};

/**
 * Loads a document from local storage using a system transaction.
 */
// In LoadDocumentUtils.ts

export const loadDocument = async (
  file: File,
  loadData: (
    fileName: string,
    driveFileId: string | undefined,
    docState: Uint8Array
  ) => Promise<void>,
  loadImages: (imageData: Map<string, ArrayBuffer>) => void,
  colorThemeDispatch: React.Dispatch<any>
): Promise<void> => {
  try {
    const zip = new JSZip();
    const content = await zip.loadAsync(file);

    // 1. Load Y.doc state directly
    const yjsStateFile = content.file('document/yjsState.bin');
    if (!yjsStateFile) {
      throw new Error('Invalid document format: missing Y.doc state');
    }
    const yjsState = await yjsStateFile.async('uint8array');

    // 2. Load metadata
    const metadataFile = await content.file('document/metadata.json')?.async('string');
    const metadata = metadataFile ? JSON.parse(metadataFile) : { 
      fileName: file.name.replace(/\.bloomdocx$/, '') 
    };

    // 3. Load styles
    const stylesFile = await content.file('document/styles.json')?.async('string');
    if (stylesFile) {
      const { primaryColor, backgroundColor, colorTheme } = JSON.parse(stylesFile);
      colorThemeDispatch({ type: 'SET_PRIMARY_COLOR', payload: primaryColor });
      colorThemeDispatch({ type: 'SET_BACKGROUND_COLOR', payload: backgroundColor });
      colorThemeDispatch({ type: 'SET_COLOR_THEME', payload: colorTheme });
    }

    // 4. Load images
    const imageBuffers = new Map<string, ArrayBuffer>();
    const imageFiles = Object.entries(content.files).filter(([path]) => 
      path.startsWith('document/images/'));
    
    for (const [path, file] of imageFiles) {
      const imageId = path.split('/').pop()!;
      const buffer = await file.async('arraybuffer');
      imageBuffers.set(imageId, buffer);
    }
    loadImages(imageBuffers);

    // 5. Initialize data with binary state
    await loadData(metadata.fileName, metadata.fileId, yjsState);

    toast.success('Document loaded successfully');
  } catch (error) {
    console.error('Error loading document:', error);
    toast.error('Failed to load the document');
    throw error;
  }
};


// Helper functions for document loading operations...
const loadDocumentData = async (zip: JSZip): Promise<SerializedDocument | null> => {
  const documentFile = zip.file('document/document.json');
  if (documentFile) {
    const documentJson = await documentFile.async('string');
    return JSON.parse(documentJson) as SerializedDocument;
  }
  return null;
};




/**
const initializeYDocNodes = (ydoc: Y.Doc, nodes: Map<string, ConceptNode>): void => {
    console.log('[LoadDocumentUtils] Initializing YDoc nodes with system transaction');
    
    ydoc.transact(() => {
      const nodesMap = ydoc.getMap('nodes');
      nodesMap.clear();
      
      // Batch all node updates in a single operation
      const updates = Array.from(nodes.entries());
      updates.forEach(([key, node]) => {
        nodesMap.set(key, node);
      });
      
      console.log('[LoadDocumentUtils] Node updates completed, count:', updates.length);
    }, { type: 'system', action: 'fileLoad' });
  };

const updateDocumentProperties = (
  colorThemeDispatch: React.Dispatch<any>,
  fileDispatch: React.Dispatch<any>,
  primaryColor: string,
  backgroundColor: string,
  fileName: string
): void => {
  colorThemeDispatch({ type: 'SET_PRIMARY_COLOR', payload: primaryColor });
  colorThemeDispatch({ type: 'SET_BACKGROUND_COLOR', payload: backgroundColor });
  fileDispatch({ type: 'SET_FILE_NAME', payload: fileName });
};

const applyYDocState = async (ydoc: Y.Doc, zip: JSZip): Promise<void> => {
  const yjsStateFile = zip.file('document/yjsState.bin');
  if (yjsStateFile) {
    try {
      const yjsStateBinary = await yjsStateFile.async('uint8array');
      Y.applyUpdate(ydoc, yjsStateBinary);
      console.log('Y.js state applied successfully');
    } catch (error) {
      console.error('Error applying Y.js state:', error);
      toast.error('Failed to synchronize collaborative state');
    }
  }
};

const loadAndSetResources = async (
  zip: JSZip,
  setResourcesByMap: (
    resourceMap: Map<string, CueCardResource[] | PictureResource[] | PracticeSheetResource[]>,
    options?: { origin?: { type: 'system'; action: SystemActionType } }
  ) => void,
): Promise<void> => {
  try {
    console.log('[DocumentUtils] Starting resource loading process:', new Date().toISOString());

    // Load all resource types concurrently
    const [cueCards, pictures, practiceSheets] = await Promise.all([
      loadCueCards(zip),
      loadPictures(zip),
      loadPracticeSheets(zip)
    ]);

    // No need for base64 conversion anymore
    console.log('[DocumentUtils] Setting resources with system origin:', new Date().toISOString());

    const setResourcesWithLogging = async (
      resources: Map<string, any[]>,
      type: string
    ) => {
      if (resources.size > 0) {
        console.log(`[DocumentUtils] Setting ${type}:`, {
          nodeCount: resources.size,
          totalResources: Array.from(resources.values()).flat().length,
          timestamp: new Date().toISOString()
        });

        await setResourcesByMap(resources, {
          origin: { type: 'system', action: 'fileLoad' }
        });
      }
    };

    // Set resources in sequence to avoid conflicts
    await setResourcesWithLogging(cueCards, 'cueCards');
    await setResourcesWithLogging(pictures, 'pictures');
    await setResourcesWithLogging(practiceSheets, 'practiceSheets');

    console.log('[DocumentUtils] Resource loading completed:', new Date().toISOString());

  } catch (error) {
    console.error('[DocumentUtils] Error in loadAndSetResources:', error);
    throw new Error('Failed to load and set resources: ' + error);
  }
};

const loadAndSetSubtrees = async (
  zip: JSZip,
  setSubtrees: (newSubtrees: Map<string, SubtreeData>) => void
): Promise<void> => {
  const subtreesFile = zip.file('document/subtrees.json');
  if (subtreesFile) {
    const subtreesJson = await subtreesFile.async('string');
    const parsedSubtrees = JSON.parse(subtreesJson) as [string, SubtreeData][];
    const subtreesMap = new Map<string, SubtreeData>(parsedSubtrees);
    setSubtrees(subtreesMap);
  }
};


/**
 * Helper function to convert serialized nodes array to Map

const convertNodesToMap = (nodesArray: [string, ConceptNode][]): Map<string, ConceptNode> => {
    return new Map(nodesArray);
  };

 */

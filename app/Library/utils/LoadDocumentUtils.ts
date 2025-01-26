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


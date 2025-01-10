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

import { serializeSubtrees } from '@/app/Library/Context/SubTreeProvider';
import { resetColorTheme } from '@/app/Library/Context/colorThemeActions';
import { Descendant } from 'slate';

/**
 * Enumeration for application modes.
 * - 'private': Standard mode for single-user operations.
 * - 'collaborate': Mode for collaborative operations with multiple users.
 */
export type AppMode = 'private' | 'collaborate';

/**
 * Interface for serialized resource metadata in collaborate mode.
 * Includes additional fields to handle conflict resolution and user-specific data.
 */
interface SerializedResourceMetadata {
  userId: string;         // ID of the user who made the change
  timestamp: number;      // Unix timestamp of the change
  operation: string;      // Type of operation (e.g., 'create', 'update', 'delete')
}

/**
 * Function to serialize cue cards.
 * Converts a Map of cue cards into an array of tuples for JSON serialization.
 * 
 * @param cueCards - Map where key is nodeId and value is an array of CueCardResource
 * @returns Array of [nodeId, CueCardResource[]] tuples
 */
const serializeCueCards = (cueCards: Map<string, CueCardResource[]>): [string, CueCardResource[]][] => {
  return Array.from(cueCards.entries());
};

/**
 * Function to serialize practice sheets.
 * Converts a Map of practice sheets into an array of tuples for JSON serialization.
 * 
 * @param practiceSheets - Map where key is nodeId and value is an array of PracticeSheetResource
 * @returns Array of [nodeId, PracticeSheetResource[]] tuples
 */
const serializePracticeSheets = (
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
const serializePictures = (
  pictures: Map<string, PictureResource[]>
): [string, { id: string; title: string; imagePath: string; description?: Descendant[] }[]][] => {
  const serialized: [string, { id: string; title: string; imagePath: string; description?: Descendant[] }[]][] = [];
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
 * Function to save the document as a .bloomdocx file.
 * Handles mode-dependent serialization to include additional metadata in collaborate mode.
 * 
 * @param nodes - Map of ConceptNode with nodeId as key
 * @param colorTheme - Current color theme
 * @param primaryColor - Primary color of the theme
 * @param backgroundColor - Background color of the theme
 * @param fileName - Name of the document file
 * @param cueCards - Map of CueCardResource with nodeId as key
 * @param subtrees - Map of SubtreeData with subtreeId as key
 * @param pictures - Map of PictureResource with nodeId as key
 * @param practiceSheets - Map of PracticeSheetResource with nodeId as key
 * @param mode - Current application mode ('private' or 'collaborate')
 */
export const saveDocument = async (
  nodes: Map<string, ConceptNode>,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  cueCards: Map<string, ResourceCard[]>,
  subtrees: Map<string, SubtreeData>,
  pictures: Map<string, ResourceCard[]>,
  practiceSheets: Map<string, ResourceCard[]>,
  mode: AppMode = 'private' // Default to 'private' mode
) => {
  const zip = new JSZip();

  // Serialize document data
  const serializedDocument = serializeDocument(
    nodes,
    colorTheme,
    primaryColor,
    backgroundColor,
    fileName
  );
  const documentJson = JSON.stringify(serializedDocument);
  zip.file('document/document.json', documentJson);

  // Serialize cue cards
  const serializedCueCards = serializeCueCards(cueCards as Map<string, CueCardResource[]>);
  const cueCardsJson = JSON.stringify(serializedCueCards);
  zip.file('document/cuecards.json', cueCardsJson);

  // Serialize subtrees
  const serializedSubtrees = serializeSubtrees(subtrees);
  const subtreesJson = JSON.stringify(serializedSubtrees);
  zip.file('document/subtrees.json', subtreesJson);

  // Serialize pictures metadata
  const serializedPictures = serializePictures(pictures as Map<string, PictureResource[]>);
  const picturesJson = JSON.stringify(serializedPictures);
  zip.file('document/pictures.json', picturesJson);

  // Serialize practice sheets
  const serializedPracticeSheets = serializePracticeSheets(
    practiceSheets as Map<string, PracticeSheetResource[]>
  );
  const practiceSheetsJson = JSON.stringify(serializedPracticeSheets);
  zip.file('document/practiceSheets.json', practiceSheetsJson);

  // Serialize styles
  const styles = {
    primaryColor,
    backgroundColor,
    colorTheme,
  };
  const stylesJson = JSON.stringify(styles);
  zip.file('document/styles.json', stylesJson);

  // Mode-dependent serialization: Include additional metadata in 'collaborate' mode
  if (mode === 'collaborate') {
    const metadata: SerializedResourceMetadata = {
      userId: 'currentUserId', // Replace with actual user ID from context or state
      timestamp: Date.now(),
      operation: 'save', // Example operation
    };
    const metadataJson = JSON.stringify(metadata);
    zip.file('document/metadata.json', metadataJson);
  }

  // Add images to the ZIP under 'document/images/'
  for (const [nodeId, pictureArray] of pictures.entries()) {
    for (const picture of pictureArray as PictureResource[]) {
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

/**
 * Function to load a document from a .bloomdocx file.
 * Handles mode-dependent deserialization to process additional metadata in 'collaborate' mode.
 * 
 * @param file - The .bloomdocx file to load
 * @param nodesDispatch - Dispatch function to update nodes state
 * @param setResourcesByMap - Function to set resources by their respective maps
 * @param setSubtrees - Function to set subtrees data
 * @param fileDispatch - Dispatch function to update file-related state
 * @param colorThemeDispatch - Dispatch function to update color theme state
 * @param resetTreeDimensions - Function to reset tree dimensions
 * @param resetSubtrees - Function to reset subtrees
 * @param resetResources - Function to reset resources
 */
export const loadDocument = async (
  file: File,
  nodesDispatch: React.Dispatch<any>,
  setResourcesByMap: (
    resourceMap: Map<string, CueCardResource[] | PictureResource[] | PracticeSheetResource[]>
  ) => void,
  setSubtrees: (newSubtrees: Map<string, SubtreeData>) => void,
  fileDispatch: React.Dispatch<any>,
  colorThemeDispatch: React.Dispatch<any>,
  resetTreeDimensions: () => void,
  resetSubtrees: () => void,
  resetResources: () => void
) => {
  resetTreeDimensions();
  resetSubtrees();
  resetResources();
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const loadedFileName = file.name.replace(/\.[^/.]+$/, '');

  // Load metadata.json to determine the mode
  const metadataFile = content.file('document/metadata.json');
  let mode: AppMode = 'private'; // Default mode

  if (metadataFile) {
    const metadataJson = await metadataFile.async('string');
    const metadata = JSON.parse(metadataJson) as SerializedResourceMetadata;
    // You can use metadata to set mode or handle collaborative features
    // For this example, we'll assume mode is 'collaborate' if metadata exists
    mode = 'collaborate';
    // Additional metadata can be processed here
  }

  // Load document.json
  const documentFile = content.file('document/document.json');
  if (documentFile) {
    const documentJson = await documentFile.async('string');
    const parsedDocument = JSON.parse(documentJson) as SerializedDocument;

    // Reconstruct nodes Map
    const nodes = new Map<string, ConceptNode>(parsedDocument.nodes);
    nodesDispatch({ type: 'SET_NODES', payload: nodes });
    colorThemeDispatch({ type: 'SET_PRIMARY_COLOR', payload: parsedDocument.primaryColor });
    colorThemeDispatch({ type: 'SET_BACKGROUND_COLOR', payload: parsedDocument.backgroundColor });
    fileDispatch({ type: 'SET_FILE_NAME', payload: loadedFileName });
  }

  // Load cuecards.json
  const cueCardsFile = content.file('document/cuecards.json');
  if (cueCardsFile) {
    const cueCardsJson = await cueCardsFile.async('string');
    let parsedCueCards: [string, CueCardResource[]][] = JSON.parse(cueCardsJson);
    // parsedCueCards is now [nodeId, CueCardResource[]]
    // Each CueCardResource has content as Descendant[]. No conversion needed.
    const cueCardsMap = new Map<string, CueCardResource[]>(parsedCueCards);
    setResourcesByMap(cueCardsMap);
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
    const parsedPictures = JSON.parse(picturesJson) as [
      string,
      { id: string; title: string; imagePath: string; description?: Descendant[], source?:string }[]
    ][];
    const picturesMap = new Map<string, PictureResource[]>();

    for (const [nodeId, pictureArray] of parsedPictures) {
      const reconstructedPictures: PictureResource[] = [];
      for (const pic of pictureArray) {
        const imageFile = content.file(pic.imagePath);
        if (imageFile) {
          try {
            const imageBlob = await imageFile.async('blob');
            const imageFileObject = new File(
              [imageBlob],
              pic.imagePath.split('/').pop() || 'image',
              { type: imageBlob.type }
            );
            reconstructedPictures.push({
              id: pic.id,
              title: pic.title,
              image: imageFileObject,
              type: 'picture',
              nodeId: nodeId,
              imageUrl: '',
              description: pic.description || [{ type: 'paragraph', children: [{ text: '' }] }],
              source: pic.source || '',
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
    setResourcesByMap(picturesMap);
  }

  // Load practiceSheets.json
  const practiceSheetsFile = content.file('document/practiceSheets.json');
  if (practiceSheetsFile) {
    const practiceSheetsJson = await practiceSheetsFile.async('string');
    const parsedPracticeSheets = JSON.parse(practiceSheetsJson) as [
      string,
      PracticeSheetResource[]
    ][];
    const practiceSheetsMap = new Map<string, PracticeSheetResource[]>(parsedPracticeSheets);
    setResourcesByMap(practiceSheetsMap);
  }

  // Load styles.json
  const stylesFile = content.file('document/styles.json');
  if (stylesFile) {
    const stylesJson = await stylesFile.async('string');
    const styles = JSON.parse(stylesJson);
    colorThemeDispatch({ type: 'SET_PRIMARY_COLOR', payload: styles.primaryColor });
    colorThemeDispatch({ type: 'SET_BACKGROUND_COLOR', payload: styles.backgroundColor });
  }

  // Handle mode-dependent logic after loading
  if (mode === 'collaborate') {
    // Implement any additional initialization for collaborate mode here
    console.log('Document loaded in Collaborate Mode.');
    // For example, initialize conflict resolution mechanisms or user sessions
  } else {
    console.log('Document loaded in Private Mode.');
  }

  // Trigger layout computation if necessary
  // You may need to dispatch an action to set layout state
};

/**
 * Function to initialize a new document with default settings.
 * Resets the application state and sets up initial configurations.
 * 
 * @param nodesDispatch - Dispatch function to update nodes state
 * @param layoutDispatch - Dispatch function to update layout state
 * @param fileDispatch - Dispatch function to update file-related state
 * @param colorThemeDispatch - Dispatch function to update color theme state
 * @param resetTreeDimensions - Function to reset tree dimensions
 * @param resetSubtrees - Function to reset subtrees
 * @param resetResources - Function to reset resources
 * @param bloomDepth - Depth level of the bloom taxonomy
 * @param isInitialLoad - Flag to indicate if it's the initial load
 * @param mapWidth - Width of the map layout
 * @param mapHeight - Height of the map layout
 */
export const initializeNewDocument = (
  nodesDispatch: React.Dispatch<any>,
  layoutDispatch: React.Dispatch<any>,
  fileDispatch: React.Dispatch<any>,
  colorThemeDispatch: React.Dispatch<any>,
  resetTreeDimensions: () => void,
  resetSubtrees: () => void,
  resetResources: () => void,
  bloomDepth: 1 | 2 | 3 | 4 | 5 | 6 = 6,
  isInitialLoad: boolean,
  mapWidth: number = 1800,
  mapHeight: number = 1800
) => {
  if (!isInitialLoad) {
    nodesDispatch({ type: 'RESET_NODES' });
    resetTreeDimensions();
    resetSubtrees();
    resetResources();
    colorThemeDispatch(resetColorTheme()); // Reset the color theme to default
  }

  layoutDispatch({ type: 'SET_MAP_SIZE', payload: { mapWidth, mapHeight } });
  nodesDispatch({ type: 'INIT_NEW_DOCUMENT', payload: { bloomDepth, mapWidth, mapHeight } });
  fileDispatch({ type: 'SET_FILE_NAME', payload: 'Untitled Document' });
};

/**
 * Prepares a `.bloomdocx` file for saving to Google Drive.
 * @param nodes - Map of ConceptNode with nodeId as key.
 * @param colorTheme - Current color theme.
 * @param primaryColor - Primary color of the theme.
 * @param backgroundColor - Background color of the theme.
 * @param fileName - Name of the document file.
 * @param cueCards - Map of CueCardResource with nodeId as key.
 * @param subtrees - Map of SubtreeData with subtreeId as key.
 * @param pictures - Map of PictureResource with nodeId as key.
 * @param practiceSheets - Map of PracticeSheetResource with nodeId as key.
 * @returns A `Blob` representing the `.bloomdocx` file.
 */
export const prepareBloomDocx = async (
  nodes: Map<string, ConceptNode>,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  cueCards: Map<string, ResourceCard[]>,
  subtrees: Map<string, SubtreeData>,
  pictures: Map<string, ResourceCard[]>,
  practiceSheets: Map<string, ResourceCard[]>
): Promise<Blob> => {
  const zip = new JSZip();

  // Serialize document data
  const serializedDocument = serializeDocument(
    nodes,
    colorTheme,
    primaryColor,
    backgroundColor,
    fileName
  );
  const documentJson = JSON.stringify(serializedDocument);
  zip.file('document/document.json', documentJson);

  // Serialize cue cards
  const serializedCueCards = serializeCueCards(cueCards as Map<string, CueCardResource[]>);
  const cueCardsJson = JSON.stringify(serializedCueCards);
  zip.file('document/cuecards.json', cueCardsJson);

  // Serialize subtrees
  const serializedSubtrees = serializeSubtrees(subtrees);
  const subtreesJson = JSON.stringify(serializedSubtrees);
  zip.file('document/subtrees.json', subtreesJson);

  // Serialize pictures metadata
  const serializedPictures = serializePictures(pictures as Map<string, PictureResource[]>);
  const picturesJson = JSON.stringify(serializedPictures);
  zip.file('document/pictures.json', picturesJson);

  // Serialize practice sheets
  const serializedPracticeSheets = serializePracticeSheets(
    practiceSheets as Map<string, PracticeSheetResource[]>
  );
  const practiceSheetsJson = JSON.stringify(serializedPracticeSheets);
  zip.file('document/practiceSheets.json', practiceSheetsJson);

  // Serialize styles
  const styles = {
    primaryColor,
    backgroundColor,
    colorTheme,
  };
  const stylesJson = JSON.stringify(styles);
  zip.file('document/styles.json', stylesJson);

  // Add images to the ZIP under 'document/images/'
  for (const [nodeId, pictureArray] of pictures.entries()) {
    for (const picture of pictureArray as PictureResource[]) {
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

  // Generate ZIP as Blob
  try {
    const content = await zip.generateAsync({ type: 'blob' });
    return content;
  } catch (error) {
    console.error('Error generating ZIP:', error);
    throw error;
  }
};

/**
 * Handles loading a document from Google Drive into the application's state.
 * @param file - The `.bloomdocx` file fetched from Google Drive.
 * @param nodesDispatch - Dispatch function to update nodes state.
 * @param setResourcesByMap - Function to set resources by their respective maps.
 * @param setSubtrees - Function to set subtrees data.
 * @param fileDispatch - Dispatch function to update file-related state.
 * @param colorThemeDispatch - Dispatch function to update color theme state.
 * @param resetTreeDimensions - Function to reset tree dimensions.
 * @param resetSubtrees - Function to reset subtrees.
 * @param resetResources - Function to reset resources.
 */
export const loadDocumentFromDrive = async (
  file: Blob,
  nodesDispatch: React.Dispatch<any>,
  setResourcesByMap: any,
  setSubtrees: any,
  fileDispatch: any,
  colorThemeDispatch: any,
  resetTreeDimensions: any,
  resetSubtrees: any,
  resetResources: any
) => {
  try {
    console.log('Starting to load document from drive.');
    console.log('Received file:', file);

    const zip = new JSZip();
    await zip.loadAsync(file);
    console.log('ZIP loaded successfully.');

    // Safely access the name property
    if (!(file instanceof File)) {
      console.error('Provided blob is not a File instance. Cannot extract file name.');
      throw new Error('Invalid file type. Expected a File with a name.');
    }

    // Load document.json
    const documentFile = zip.file('document/document.json');
    if (documentFile) {
      const documentJson = await documentFile.async('string');
      console.log('document.json content:', documentJson);
      const parsedDocument = JSON.parse(documentJson) as SerializedDocument;

      // Reconstruct nodes Map
      const nodes = new Map<string, ConceptNode>(parsedDocument.nodes);
      nodesDispatch({ type: 'SET_NODES', payload: nodes });
      colorThemeDispatch({ type: 'SET_PRIMARY_COLOR', payload: parsedDocument.primaryColor });
      colorThemeDispatch({ type: 'SET_BACKGROUND_COLOR', payload: parsedDocument.backgroundColor });
      fileDispatch({ type: 'SET_FILE_NAME', payload: parsedDocument.fileName });
      console.log('Nodes and color themes updated successfully.');
    } else {
      console.warn('document/document.json not found in the ZIP.');
    }

    // Load cuecards.json
    const cueCardsFile = zip.file('document/cuecards.json');
    if (cueCardsFile) {
      const cueCardsJson = await cueCardsFile.async('string');
      console.log('cuecards.json content:', cueCardsJson);
      let parsedCueCards: [string, CueCardResource[]][] = JSON.parse(cueCardsJson);
      const cueCardsMap = new Map<string, CueCardResource[]>(parsedCueCards);
      setResourcesByMap(cueCardsMap);
      console.log('Cue cards loaded successfully.');
    } else {
      console.warn('document/cuecards.json not found in the ZIP.');
    }

    // Load subtrees.json
    const subtreesFile = zip.file('document/subtrees.json');
    if (subtreesFile) {
      const subtreesJson = await subtreesFile.async('string');
      console.log('subtrees.json content:', subtreesJson);
      const parsedSubtrees = JSON.parse(subtreesJson) as [string, SubtreeData][];
      const subtreesMap = new Map<string, SubtreeData>(parsedSubtrees);
      setSubtrees(subtreesMap);
      console.log('Subtrees loaded successfully.');
    } else {
      console.warn('document/subtrees.json not found in the ZIP.');
    }

    // Load pictures.json and images
    const picturesFile = zip.file('document/pictures.json');
    if (picturesFile) {
      const picturesJson = await picturesFile.async('string');
      console.log('pictures.json content:', picturesJson);
      const parsedPictures = JSON.parse(picturesJson) as [
        string,
        { id: string; title: string; imagePath: string; description?: Descendant[]; source?: string }[]
      ][];
      const picturesMap = new Map<string, PictureResource[]>();

      for (const [nodeId, pictureArray] of parsedPictures) {
        const reconstructedPictures: PictureResource[] = [];
        for (const pic of pictureArray) {
          const imageFile = zip.file(pic.imagePath);
          if (imageFile) {
            try {
              const imageBlob = await imageFile.async('blob');
              const imageFileObject = new File(
                [imageBlob],
                pic.imagePath.split('/').pop() || 'image',
                { type: imageBlob.type }
              );
              reconstructedPictures.push({
                id: pic.id,
                title: pic.title,
                image: imageFileObject,
                type: 'picture',
                nodeId: nodeId,
                imageUrl: '',
                description: pic.description || [{ type: 'paragraph', children: [{ text: '' }] }],
                source: pic.source || '',
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
      setResourcesByMap(picturesMap);
      console.log('Pictures loaded successfully.');
    } else {
      console.warn('document/pictures.json not found in the ZIP.');
    }

    // Load practiceSheets.json
    const practiceSheetsFile = zip.file('document/practiceSheets.json');
    if (practiceSheetsFile) {
      const practiceSheetsJson = await practiceSheetsFile.async('string');
      console.log('practiceSheets.json content:', practiceSheetsJson);
      const parsedPracticeSheets = JSON.parse(practiceSheetsJson) as [
        string,
        PracticeSheetResource[]
      ][];
      const practiceSheetsMap = new Map<string, PracticeSheetResource[]>(parsedPracticeSheets);
      setResourcesByMap(practiceSheetsMap);
      console.log('Practice sheets loaded successfully.');
    } else {
      console.warn('document/practiceSheets.json not found in the ZIP.');
    }

    // Load styles.json
    const stylesFile = zip.file('document/styles.json');
    if (stylesFile) {
      const stylesJson = await stylesFile.async('string');
      console.log('styles.json content:', stylesJson);
      const styles = JSON.parse(stylesJson);
      colorThemeDispatch({ type: 'SET_PRIMARY_COLOR', payload: styles.primaryColor });
      colorThemeDispatch({ type: 'SET_BACKGROUND_COLOR', payload: styles.backgroundColor });
      console.log('Styles updated successfully.');
    } else {
      console.warn('document/styles.json not found in the ZIP.');
    }

    // Handle mode-dependent logic after loading
    const metadataFile = zip.file('document/metadata.json');
    if (metadataFile) {
      const metadataJson = await metadataFile.async('string');
      const metadata = JSON.parse(metadataJson) as SerializedResourceMetadata;
      console.log('Metadata found:', metadata);
      // Implement any additional initialization for collaborate mode here
      console.log('Document loaded in Collaborate Mode.');
      // Example: Initialize conflict resolution mechanisms or user sessions
    } else {
      console.log('Document loaded in Private Mode.');
    }

    // Trigger layout computation if necessary
    // Example:
    // layoutDispatch(setGetLayout(true));
    console.log('Document loaded and state updated successfully.');
  } catch (error) {
    console.error('Error in loadDocumentFromDrive:', error);
    throw error; // Re-throw to handle in the caller
  }
};
// bloom-maps\app\Library\Tests\utils\documentUtils.ts

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



const serializeCueCards = (cueCards: Map<string, CueCardResource[]>): [string, CueCardResource[]][] => {
  return Array.from(cueCards.entries());
};

// Serialization logic to handle the updated PracticeSheet structure
 const serializePracticeSheets = (practiceSheets: Map<string, PracticeSheetResource[]>): [string, PracticeSheetResource[]][] => {
  return Array.from(practiceSheets.entries());
};

const serializePictures = (
  pictures: Map<string,  PictureResource[]>
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

// Function to serialize document data
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

export const saveDocument = async (
  nodes: Map<string, ConceptNode>,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  cueCards: Map<string, ResourceCard[]>,  // Changed to ResourceCard[]
  subtrees: Map<string, SubtreeData>,
  pictures: Map<string, ResourceCard[]>,  // Changed to ResourceCard[]
  practiceSheets: Map<string, ResourceCard[]>  // Changed to ResourceCard[]
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
  const serializedCueCards = serializeCueCards(cueCards as Map<string, CueCardResource[]>);  // Type cast
  const cueCardsJson = JSON.stringify(serializedCueCards);
  zip.file('document/cuecards.json', cueCardsJson);

  // Serialize subtrees
  const serializedSubtrees = serializeSubtrees(subtrees);
  const subtreesJson = JSON.stringify(serializedSubtrees);
  zip.file('document/subtrees.json', subtreesJson);

  // Serialize pictures metadata
  const serializedPictures = serializePictures(pictures as Map<string,  PictureResource[]>);  // Type cast
  const picturesJson = JSON.stringify(serializedPictures);
  zip.file('document/pictures.json', picturesJson);

  // Serialize practice sheets
  const serializedPracticeSheets = serializePracticeSheets(practiceSheets as Map<string, PracticeSheetResource[]>);  // Type cast
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
    for (const picture of pictureArray as  PictureResource[]) {  // Type cast ResourceCard to Picture
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
  nodesDispatch: React.Dispatch<any>,
  setResourcesByMap: (resourceMap: Map<string, CueCardResource[] | PictureResource[] | PracticeSheetResource[]>) => void,
  setSubtrees: (newSubtrees: Map<string, SubtreeData>) => void,
  fileDispatch: React.Dispatch<any>,
  colorThemeDispatch: React.Dispatch<any>,
  resetTreeDimensions: () => void,
  resetSubtrees: () => void,
  resetResources: () => void,
) => {
  resetTreeDimensions();
  resetSubtrees();
  resetResources();
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const loadedFileName = file.name.replace(/\.[^/.]+$/, '');

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
 // Load cuecards.json
 const cueCardsFile = content.file('document/cuecards.json');
 if (cueCardsFile) {
   const cueCardsJson = await cueCardsFile.async('string');
   let parsedCueCards: [string, any[]][] = JSON.parse(cueCardsJson);
   
   // Detect if old format (without 'type' field)
   if (parsedCueCards.length > 0 && parsedCueCards[0][1].length > 0 && !('type' in parsedCueCards[0][1][0])) {
     // Transform old CueCard to new ResourceCard format
     parsedCueCards = parsedCueCards.map(([nodeId, cueCards]) => [
       nodeId,
       cueCards.map((card: any) => ({
         type: 'cueCard',
         nodeId: nodeId,
         id: card.id,
         title: card.title,
         content: card.content,
         bloomLevel: card.bloomLevel,
         source: card.source || '',
       })),
     ]);
   }

   const cueCardsMap = new Map<string, CueCardResource[]>(parsedCueCards as [string, CueCardResource[]][]);
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
    const parsedPictures = JSON.parse(picturesJson) as [string, { id: string; title: string; imagePath: string }[]][];
    const picturesMap = new Map<string,  PictureResource[]>();

    for (const [nodeId, pictureArray] of parsedPictures) {
      const reconstructedPictures:  PictureResource[] = [];
      for (const pic of pictureArray) {
        const imageFile = content.file(pic.imagePath);
        if (imageFile) {
          try {
            const imageBlob = await imageFile.async('blob');
            const imageFileObject = new File([imageBlob], pic.imagePath.split('/').pop() || 'image', { type: imageBlob.type });
            reconstructedPictures.push({
              id: pic.id,
              title: pic.title,
              image: imageFileObject,
              type: 'picture',
              nodeId: nodeId
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
    const parsedPracticeSheets = JSON.parse(practiceSheetsJson) as [string, PracticeSheetResource[]][];
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

  // Trigger layout computation if necessary
  // You may need to dispatch an action to set layout state
};

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
  }

  layoutDispatch({ type: 'SET_MAP_SIZE', payload: { mapWidth, mapHeight } });
  nodesDispatch({ type: 'INIT_NEW_DOCUMENT', payload: { bloomDepth, mapWidth, mapHeight } });
  fileDispatch({ type: 'SET_FILE_NAME', payload: 'Untitled Document' });
};

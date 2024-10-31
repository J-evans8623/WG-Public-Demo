// bloom-maps/app/Library/Tests/utils/documentUtils.ts

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  ConceptNode,
  PracticeSheet,
  SubtreeData,
  SerializedDocument,
  ColorTheme,
  ResourceCard,
  PictureResource
} from '@/app/Library/Definitions/Definitions';
import { serializeSubtrees } from '@/app/Library/Context/SubTreeProvider';

/**
 * Extended interface to include resources in SerializedDocument.
 */
interface ExtendedSerializedDocument extends SerializedDocument {
  resources: [string, ResourceCard[]][];
}

// Define serialized resource interfaces
interface SerializedCueCardResource {
  id: string;
  title: string;
  type: 'cueCard';
  content: string;
  bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  source?: string;
}

interface SerializedPictureResource {
  id: string;
  title: string;
  type: 'picture';
  imagePath: string; // Include imagePath here
}

interface SerializedPracticeSheetResource {
  id: string;
  title: string;
  type: 'practiceSheet';
  content: {
    quizType: 'matching' | 'multipleChoice' | 'wordProblem';
    quizContent: string;
  };
}

type SerializedResourceCard =
  | SerializedCueCardResource
  | SerializedPictureResource
  | SerializedPracticeSheetResource;


/**
 * Function to serialize the entire document, including nodes, resources, color themes, and layout.
 * @param nodes - Map of ConceptNodes.
 * @param colorTheme - The color theme settings.
 * @param primaryColor - The primary color used in the document.
 * @param backgroundColor - The background color of the document.
 * @param fileName - The name of the file to be saved.
 * @param resources - Map of resources managed by ResourceContext.
 * @returns SerializedDocument object containing all necessary data.
 */
export const serializeDocument = (
  nodes: Map<string, ConceptNode>,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  resources: Map<string, ResourceCard[]>
): ExtendedSerializedDocument => {
  const nodesArray = Array.from(nodes.entries());

  return {
    nodes: nodesArray,
    colorTheme,
    primaryColor,
    backgroundColor,
    fileName,
    resources: Array.from(resources.entries()), // Serialize resources as an array of [nodeId, ResourceCard[]]
  };
};

/**
 * Function to save the document by serializing nodes, resources, subtrees, and styles into a ZIP file.
 * @param nodes - Map of ConceptNodes.
 * @param colorTheme - The color theme settings.
 * @param primaryColor - The primary color used in the document.
 * @param backgroundColor - The background color of the document.
 * @param fileName - The name of the file to be saved.
 * @param resources - Map of resources managed by ResourceContext.
 * @param subtrees - Map of SubtreeData.
 */
export const saveDocument = async (
  nodes: Map<string, ConceptNode>,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  resources: Map<string, ResourceCard[]>,
  subtrees: Map<string, SubtreeData>
) => {
  const zip = new JSZip();

  // Serialize document data, including resources
  const serializedDocument: ExtendedSerializedDocument = serializeDocument(
    nodes,
    colorTheme,
    primaryColor,
    backgroundColor,
    fileName,
    resources
  );
  const documentJson = JSON.stringify(serializedDocument);
  zip.file('document/document.json', documentJson);

  // Serialize subtrees
  const serializedSubtrees = serializeSubtrees(subtrees);
  const subtreesJson = JSON.stringify(serializedSubtrees);
  zip.file('document/subtrees.json', subtreesJson);

  // Serialize styles
  const styles = {
    primaryColor,
    backgroundColor,
    colorTheme,
  };
  const stylesJson = JSON.stringify(styles);
  zip.file('document/styles.json', stylesJson);

  // Add images to the ZIP under 'document/images/'
  for (const [nodeId, resourceArray] of resources.entries()) {
    for (const resource of resourceArray) {
      if (resource.type === 'picture' && resource.image) {
        try {
          const imageData = await resource.image.arrayBuffer();
          zip.file(`document/images/${resource.id}_${resource.image.name}`, imageData);
        } catch (error) {
          console.error(`Error saving image ${resource.id}:`, error);
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
 * Function to load the document by deserializing nodes, resources, subtrees, and styles from a ZIP file.
 * @param file - The ZIP file to load.
 * @param nodesDispatch - Dispatch function to update nodes in the context.
 * @param setResources - Function to set resources in the ResourceContext.
 * @param setSubtrees - Function to set subtrees data.
 * @param fileDispatch - Dispatch function to update file-related information.
 * @param colorThemeDispatch - Dispatch function to update color theme settings.
 */
export const loadDocument = async (
  file: File,
  nodesDispatch: React.Dispatch<any>,
  setResources: (resources: Map<string, ResourceCard[]>) => void,
  setSubtrees: (subtrees: Map<string, SubtreeData>) => void,
  fileDispatch: React.Dispatch<any>,
  colorThemeDispatch: React.Dispatch<any>
) => {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const loadedFileName = file.name.replace(/\.[^/.]+$/, '');

  // Load document.json
  const documentFile = content.file('document/document.json');
  if (documentFile) {
    const documentJson = await documentFile.async('string');
    const parsedDocument = JSON.parse(documentJson) as ExtendedSerializedDocument;

    // Reconstruct nodes Map
    const nodes = new Map<string, ConceptNode>(parsedDocument.nodes);
    nodesDispatch({ type: 'SET_NODES', payload: nodes });
    colorThemeDispatch({ type: 'SET_PRIMARY_COLOR', payload: parsedDocument.primaryColor });
    colorThemeDispatch({ type: 'SET_BACKGROUND_COLOR', payload: parsedDocument.backgroundColor });
    fileDispatch({ type: 'SET_FILE_NAME', payload: loadedFileName });

    // Reconstruct resources Map
    const resourcesMap = new Map<string, ResourceCard[]>();
    for (const [nodeId, resourceArray] of parsedDocument.resources) {
      const reconstructedResources: ResourceCard[] = [];
      for (const resource of resourceArray) {
        if (resource.type === 'picture') {
          const imageFilePath = resource.imagePath;
          const imageFile = content.file(imageFilePath);
          if (imageFile) {
            try {
              const imageBlob = await imageFile.async('blob');
              const imageName = imageFilePath.split('/').pop() || 'image';
              const imageFileObject = new File([imageBlob], imageName, { type: imageBlob.type });
              reconstructedResources.push({
                ...resource,
                image: imageFileObject, // Assign as File object
              } as PictureResource);
            } catch (error) {
              console.error(`Error loading image ${resource.id}:`, error);
              // Assign null to image if there's an error
              reconstructedResources.push({
                ...resource,
                image: null,
              } as PictureResource);
            }
          } else {
            console.warn(`Image file not found: ${imageFilePath}`);
            // Assign null to image if the image file is missing
            reconstructedResources.push({
              ...resource,
              image: null,
            } as PictureResource);
          }
        } else {
          // Handle other resource types (cueCard, practiceSheet) as needed
          reconstructedResources.push(resource);
        }
      }
      resourcesMap.set(nodeId, reconstructedResources);
    }
    setResources(resourcesMap);
  }

  // Load subtrees.json
  const subtreesFile = content.file('document/subtrees.json');
  if (subtreesFile) {
    const subtreesJson = await subtreesFile.async('string');
    const parsedSubtrees = JSON.parse(subtreesJson) as [string, SubtreeData][];
    const subtreesMap = new Map<string, SubtreeData>(parsedSubtrees);
    setSubtrees(subtreesMap);
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

/**
 * Function to initialize a new document, resetting nodes, resources, subtrees, and styles.
 * @param nodesDispatch - Dispatch function to update nodes in the context.
 * @param layoutDispatch - Dispatch function to update layout-related settings.
 * @param fileDispatch - Dispatch function to update file-related information.
 * @param colorThemeDispatch - Dispatch function to update color theme settings.
 * @param resetResources - Function to reset resources in the ResourceContext.
 * @param resetTreeDimensions - Function to reset tree dimensions.
 * @param resetSubtrees - Function to reset subtrees data.
 * @param bloomDepth - The bloom depth level.
 * @param groundWidth - The ground width of the layout.
 * @param isInitialLoad - Flag indicating if it's the initial load.
 * @param mapWidth - The width of the map.
 * @param mapHeight - The height of the map.
 */
export const initializeNewDocument = (
  nodesDispatch: React.Dispatch<any>,
  layoutDispatch: React.Dispatch<any>,
  fileDispatch: React.Dispatch<any>,
  colorThemeDispatch: React.Dispatch<any>,
  resetResources: () => void,
  resetTreeDimensions: () => void,
  resetSubtrees: () => void,
  bloomDepth: 1 | 2 | 3 | 4 | 5 | 6 = 6,
  groundWidth: number,
  isInitialLoad: boolean,
  mapWidth: number = 1800,
  mapHeight: number = 1800
) => {
  if (!isInitialLoad) {
    nodesDispatch({ type: 'RESET_NODES' });
    resetResources();
    resetTreeDimensions();
    resetSubtrees();
  }

  layoutDispatch({ type: 'SET_MAP_SIZE', payload: { groundWidth, mapWidth, mapHeight } });
  nodesDispatch({ type: 'INIT_NEW_DOCUMENT', payload: { bloomDepth, mapWidth, mapHeight } });
  fileDispatch({ type: 'SET_FILE_NAME', payload: 'Untitled Document' });
};

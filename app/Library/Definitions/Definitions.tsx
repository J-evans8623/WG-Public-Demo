//bloom-maps\app\Library\Definitions\Definitions.tsx
export interface CueCard {
  id: string;
  title: string;
  content: string;
  createdDate?: Date;
  tags?: string[];
  source?: string; // New property
}
  export interface CueCardProps {
    title: string;
    content: string;
  }

  // Interface for CueStackProps
export interface CueStackProps {
    nodeId: string;
    colorTheme: string[];
    onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  }


  interface ConceptNodeProps {
    node: ConceptNode;
    openModalWithResourceType: (
      nodeId: string | null,
      resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
      op: 'resource' | 'node'
    ) => void;
    onNodeClick: (nodeId: string) => void;
  }


  // Define the Concept-node interface
  export interface ConceptNode {
    id: string; // Unique identifier for the concept node
    title: string; // Title of the concept node
    description?: string; // Optional: Description of the concept node
    parentNodeId?: string; // Optional: ID of the parent node
    childrenNodeIds?: string[]; // Optional: Array of child node IDs
    x?: number; // Optional: X-coordinate for positioning (initially undefined)
    y?: number; // Optional: Y-coordinate for positioning (initially undefined)
    isRoot?: boolean; // Flag to indicate if the node is a root node
    depth: number; // Depth level of the node
    subtreeID?: string;
  }
  



  // Color definitions
export type ColorTheme = 'cool-spring' | 'warm-summer' | 'gray';

// Define the colors for each theme
export const colorThemes: Record<ColorTheme, string[]> = {
  'cool-spring': [
    'rgb(223, 252, 173)', // Light green
    'rgb(181, 245, 216)', // Light teal
    'rgb(168, 204, 252)', // Light blue
    'rgb(137, 112, 252)', // Light purple
    'rgb(93, 76, 204)',   // Dark purple
    'rgb(25, 116, 210)'   // Deep blue
  ],
  'warm-summer': [
    'rgb(247, 244, 212)', // Light beige
    'rgb(254, 228, 119)', // Light yellow
    'rgb(254, 228, 11)',  // Yellow
    'rgb(255, 99, 71)', // Tomato
    'rgb(255, 166, 0)',  // Orange yellow
    'rgb(255, 68, 0)'    // Red orang
  ],
  'gray': [
    'rgb(211, 211, 211)', // Light gray for unspecified levels
  ],
};

  
  export default interface TreeSizeContextType {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    treeWidth: number;
    treeHeight: number;
    setMinX: (value: number) => void;
    setMaxX: (value: number) => void;
    setMinY: (value: number) => void;
    setMaxY: (value: number) => void;
    setTreeWidth: (value: number) => void;
    setTreeHeight: (value: number) => void;
  }

  

export interface SerializedDocument {
  nodes: [string, ConceptNode][];
  colorTheme: ColorTheme;
  primaryColor: string;
  backgroundColor: string;
  fileName: string; 
}

// Picture Definition
export interface Picture {
  id: string;
  title: string;
  image: File | null; // The image file, if provided
}

// PracticeSheet Definition
export interface PracticeSheet {
  id: string;
  title: string;
  content: {
    quizType: 'matching' | 'multipleChoice' | 'wordProblem'; // New field for quiz type
    quizContent: string; // New field for actual content of the quiz
  };
}

// New definitions for new context
// bloom-maps/app/Library/Definitions/Definitions.ts
export enum NodesActionType {
  SET_NODES = 'SET_NODES',
  CREATE_NEW_NODE = 'CREATE_NEW_NODE',
  UPDATE_NODE_TITLE = 'UPDATE_NODE_TITLE',
  RESET_NODES = 'RESET_NODES',
  INIT_NEW_DOCUMENT = 'INIT_NEW_DOCUMENT',
  TRANSFER_NODE = 'TRANSFER_NODE',
  DELETE_NODE = 'DELETE_NODE',
}

export interface NodesAction {
  type: NodesActionType;
  payload?: any;
}
// bloom-maps/app/Library/Definitions/Definitions.ts
export enum ZoomActionType {
  ZOOM_IN = 'ZOOM_IN',
  ZOOM_OUT = 'ZOOM_OUT',
  SET_ZOOM_LEVEL = 'SET_ZOOM_LEVEL',
}

export interface ZoomAction {
  type: ZoomActionType;
  payload?: any;
}


export enum LayoutActionType {
  SET_GET_LAYOUT = 'SET_GET_LAYOUT',
  SET_MAP_SIZE = 'SET_MAP_SIZE',
  TOGGLE_RESET_MAP_SIZE = 'TOGGLE_RESET_MAP_SIZE',
}

export interface LayoutAction {
  type: LayoutActionType;
  payload?: any;
}

// bloom-maps/app/Library/Definitions/Definitions.ts
export enum ColorThemeActionType {
  SET_COLOR_THEME = 'SET_COLOR_THEME',
  SET_PRIMARY_COLOR = 'SET_PRIMARY_COLOR',
  SET_BACKGROUND_COLOR = 'SET_BACKGROUND_COLOR',
   RESET_COLOR_THEME = 'RESET_COLOR_THEME',
}

export interface ColorThemeAction {
  type: ColorThemeActionType;
  payload?: any;
}

export enum FileActionType {
  SET_FILE_NAME = 'SET_FILE_NAME',
}

export interface FileAction {
  type: FileActionType;
  payload?: any;
}
export interface SubtreeData {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  position?: { x: number; y: number };
}


export type ResourceType = 'cueCard' | 'picture' | 'practiceSheet';

/**
 * Base interface for all resources.
 */
export interface BaseResource {
  id: string;
  title: string;
  nodeId: string; // The node to which the resource is associated
}

/**
 * Interface for CueCard resources.
 */
export interface CueCardResource extends BaseResource {
  type: 'cueCard';
  content: string;
  source?: string;
}

/**
 * Interface for Picture resources.
 */
export interface PictureResource extends BaseResource {
  type: 'picture';
  image: File | null;
  description? : string;
}

/**
 * Interface for PracticeSheet resources.
 */
export interface PracticeSheetResource extends BaseResource {
  type: 'practiceSheet';
  content: {
    quizType: 'matching' | 'multipleChoice' | 'wordProblem';
    quizContent: string;
  };
}

/**
 * Discriminated union type for all resources.
 */
export type ResourceCard = CueCardResource | PictureResource | PracticeSheetResource;

//bloom-maps\app\Library\Definitions\Definitions.tsx
import { constants } from 'crypto';
import { Descendant } from 'slate';

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
  fileId? : string;
}

// Picture Definition
export interface Picture {
  id: string;
  title: string;
  image: File | null; // The image file, if provided
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

export type StorageType = 'local' | 'drive';

/**
 * Enum for File action types.
 */
export enum FileActionType {
  SET_FILE_NAME = 'SET_FILE_NAME',
  SET_DRIVE_FILE_ID = 'SET_DRIVE_FILE_ID',
  RESET_DRIVE_FILE_ID = 'RESET_DRIVE_FILE_ID',
  SET_INITIALIZED = 'SET_INITIALIZED',
  SET_YDOC_INITIALIZED = 'SET_YDOC_INITIALIZED',
}
/**
 * Union type for File actions.
 */
export type FileAction =
  | { type: FileActionType.SET_FILE_NAME; payload: string }
  | { type: FileActionType.SET_DRIVE_FILE_ID; payload: string }
  | { type: FileActionType.RESET_DRIVE_FILE_ID }
  | { type: FileActionType.SET_INITIALIZED; payload: boolean }
  | { type: FileActionType.SET_YDOC_INITIALIZED; payload: boolean };
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
  source?: string;
}

/***
 * 
 * v1 shows the legacy versions of the resources which are now depricated.
 *

 * Interface for CueCard resources.
 *
export interface CueCardResourcev1 extends BaseResource {
  type: 'cueCard';
  content: Descendant[];
}


 * Interface for Picture resources.
 *
export interface PictureResourcev1 extends BaseResource {
  type: 'picture';
  imageUrl: string;        // File object stored in ResourceContext
  description?: Descendant[];
}

*/

export interface CueCardResource extends BaseResource {
  type: 'cueCard' ;
  content: Record<string, any>; // The TipTap JSON representation
}

/**
 * NEW: Interface for Note resources.
 * A note is similar to a cue card but is used for longer text.
 */
export interface NoteResource extends BaseResource {
  type: 'note';
  content: Record<string, any>;
}

export interface PictureResource extends BaseResource {
  type: 'picture';
  imageUrl: string;
  description?: Record<string, any>; // TipTap JSON for rich text description
}



export type QuizType = 'matching' | 'multipleChoice' | 'true-false' | 'FIB'; 

export interface IQuizQuestion {
  id: string;
  type: QuizType;
  question: string;
  correctAnswer: string | string[] | Boolean;
}

// Multiple choice specific interface
export interface IMultipleChoiceQuestion extends IQuizQuestion {
  type: 'multipleChoice';
  options: string[];
  correctAnswer: string;  // Array with single correct answer
}

// True/False specific interface
export interface ITrueFalseQuestion extends IQuizQuestion {
  type: 'true-false';
  correctAnswer: Boolean;
}

// Fill in the Blank specific interface
export interface IFillInBlankQuestion extends IQuizQuestion {
  type: 'FIB';
  questionText: string;  // Text with special markers for blanks, e.g., "The {{blank-1}} jumped over the {{blank-2}}"
  correctAnswer: string;  // Array of blank definitions, each posessing an id field that maps a blank placed holder to the correct answer.
}



/**
 * Interface for PracticeSheet resources.
 */
export interface PracticeSheetResource extends BaseResource {
  type: 'practiceSheet';
  content: {
    quizType: QuizType;
    quizContent: IQuizQuestion[];
  };
}

/**
 * Discriminated union type for all resources.
 */
export type ResourceCard = CueCardResource | NoteResource | PictureResource | PracticeSheetResource ; //| ImageMessage;



export interface TextFileMessage {
  id: string;
  type: 'pdf' | 'txt' | 'doc' | 'docx';
  title: string;
  serverUrl: string;
  uploadDate: Date;
  size: number;
  description?: string;
}

export interface LayoutConfig {
  nodewidth: number;
  nodeheight: number;
  ILWidth: number;
  ILvertspacing: number;
  HVvertspacing: number;
  padding: number;
}

export const layoutConfig: LayoutConfig = {
  nodewidth : 210,
  nodeheight : 80,
  ILWidth : 48,
  ILvertspacing: 115,
  HVvertspacing : 145,
  padding : 32,
}

/**
 * export const layoutConfig: LayoutConfig = {
  nodewidth : 325,
  nodeheight : 125,
  ILWidth : 75,
  ILvertspacing: 175,
  HVvertspacing : 225,
  padding : 50,
}


 * 
 * 
 */




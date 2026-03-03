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
    childrenNodeIds: string[]; // Optional: Array of child node IDs
    x?: number; // Optional: X-coordinate for positioning (initially undefined)
    y?: number; // Optional: Y-coordinate for positioning (initially undefined)
    isRoot?: boolean; // Flag to indicate if the node is a root node
    depth: number; // Depth level of the node
    subtreeID?: string;
    lessonOrder?: string;
  }
  


// Color definitions
// -----------------------------------------------------------------------------

// Redefine ColorTheme to exactly the four theme names introduced:
//   'soft-peach', 'salmon-peach', 'ocean-blue', 'classic'
export type ColorTheme = 'soft-peach' | 'salmon-peach' | 'ocean-blue' | 'classic';

// (Optional) Legacy colorThemes record has been retained for reference but is not used
// by the new theming logic. It can be removed if obsolete.
export const colorThemes: Record<ColorTheme, string[]> = {
  'soft-peach': [
    'rgb(251, 124, 124)', // Soft peach accent
    'rgb(254, 252, 232)', // Light yellow background
  ],
  'salmon-peach': [
    'rgb(252, 165, 165)', // Salmon peach accent
    'rgb(254, 252, 232)', // Light yellow background
  ],
  'ocean-blue': [
    'rgb(14, 165, 233)', // Sky blue accent
    'rgb(224, 242, 254)', // Light blue background
    'rgb(248, 250, 252)', // Root node background
  ],
  'classic': [
    '#fafafa', // Classic primary background
    '#f0f8ff', // Classic secondary background
    '#2c3e50', // Classic text color
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


export interface Citation {
  /** The inline index used in the rendered sup tag */
  index: number;
  /** A short quote or snippet from the source material */
  textsource: string;
  /** The page number in the original document */
  page_number: number;
}

/**
 * Base interface for all resources.
 */
export interface BaseResource {
  id: string;
  title: string;
  nodeId: string; // The node to which the resource is associated
  source?: string;
  conceptNodeTitle?:string;
  citations?: Citation[] | null;
  mapId:string;
}


export interface CueCardResource extends BaseResource {
  type: 'cueCard' ;
  content: string; // HTML string
}

/**
 * NEW: Interface for Note resources.
 * A note is similar to a cue card but is used for longer text.
 */
export interface NoteResource extends BaseResource {
  type: 'note';
  content: string;  // HTML string
}

/**export interface PictureResource extends BaseResource {
  type: 'picture';
  imageUrl: string;
  description?: string; // TipTap JSON for rich text description
} */



export type QuizType = 'matching' | 'multipleChoice' | 'true-false' | 'FIB'; 

export interface IQuizQuestion {
  id: string;
  type: QuizType;
  question: string;
  correctAnswer: string | string[] | Boolean;
  parentQuizId: string;
  mapId: string;
  // Add support for feedback-enriched metadata
  explanation?: string;
  /** VERBATIM quote from the source material used as proof for the question. */
  citation?: {
    text: string;
  };
  /** The original system UUID of the topic, resolved during post-processing. */
  topicId?: string;
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
 * @section Quiz Binding & Assessment Types (inline-only) — update - 1
 * @description
 * This section defines the single, authoritative quiz binding shape used across authoring, storage,
 * rendering, and networking. We adopt a decisive, inline-only contract so that a quiz assessment card
 * contains the exact quiz spec the player will render. This avoids any ambiguity about indirection,
 * removes legacy adapter paths, and eliminates the need to chase references at read time.
 *
 * Performance: by continuing to key assessment cards by `assignmentId` inside a Y.Map, core lookups
 * and mutations remain O(1). Rendering lists stays O(N) (iterate and map headers). This choice reduces
 * coupling between modules (authoring, gradebook, overlay) and preserves cache-friendly structures.
 * Observability remains consistent: higher layers log network/result checkpoints; types here remain
 * pure. No runtime logs are added in this section by design.
 */

// -------------------------------------------------------------------------------------------------
// 1) Inline-only binding (authoritative shape) — update - 1
// -------------------------------------------------------------------------------------------------
export type QuizBinding = {
  mode: 'inline';
  spec: InlineQuizSpec;
};

// -------------------------------------------------------------------------------------------------
// 2) Minimal inline spec consumed by the quiz player — update - 1
//    Mirrors PracticeSheetResource.content but intentionally small and stable.
// -------------------------------------------------------------------------------------------------
export interface InlineQuizSpec {
  quizType: QuizType;             // Reuses existing union: 'matching' | 'multipleChoice' | 'true-false' | 'FIB'
  quizContent: IQuizQuestion[];   // Reuses existing question interfaces
}

// -------------------------------------------------------------------------------------------------
// 3) NOTE ON REMOVALS — update - 2
//    The previous reference variant `QuizSpecRef` is intentionally removed to enforce a decisive,
//    inline-only contract. Please ensure all references to `QuizSpecRef` are deleted throughout
//    the codebase. O(1) access is preserved via Y.Map keyed by `assignmentId` rather than ref hops.
// -------------------------------------------------------------------------------------------------
// (intentionally no code here — this comment documents the removal of QuizSpecRef)

// -------------------------------------------------------------------------------------------------
// 4) QuizAssessmentResource keeps the binding field but is now always inline — update - 3
// -------------------------------------------------------------------------------------------------
export interface QuizAssessmentResource extends BaseResource {
  type: 'quizAssessment';
  /** Stable id also doubling as assignment id for server correlation */
  assignmentId: string; // mirrors id
  /** Binding is decisively inline-only (see QuizBinding) */
  binding: QuizBinding;
  /** Optional scheduling/limits metadata */
  window?: { startAt?: string; endAt?: string };
  attemptLimit?: number;
  /** Optional educator-facing notes */
  instructions?: string;
  /** Optional UI audit hints */
  createdByEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  quizResultFeedback?: 'immediately' | 'after_close';
}



// 4) Sentinel node id for globally-scoped quiz assessments (Option A).
//    All quiz assessment cards will live under this node id to keep CRUD/undo/redo consistent
//    while remaining "global" and discoverable from the header modal.
export const GLOBAL_ASSESSMENTS_NODE_ID = '__assessments__';

// update - 7
/**
 * Discriminated union type for all resources.
 * NOTE: This is the authoritative union used everywhere in the app (ResourceContext, etc).
 */
export type ResourceCard =
  | CueCardResource
  | NoteResource
  | PracticeSheetResource
  | QuizAssessmentResource;





export interface TextFileMessage {
  id: string;
  type: 'pdf' | 'txt' | 'doc' | 'docx' | 'pptx';
  title: string;
  serverUrl: string;
  uploadDate: Date;
  size: number;
  description?: string;
  visibility?: 'public' | 'private';
  ownerId?: string;
  documentId?: string;
  accountType: 'scholar' | 'educator'
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

export interface layoutColor {
  connector : '#9e9e9e';
  nodeAccent : string;
  nodeMuted : string;
  textColorAccentnode: string
  textColorMutednode: string
}

export const classicTheme : layoutColor = {
  connector: '#9e9e9e',
  nodeAccent: '#f0f8ff',
  nodeMuted: '#fafafa',
  textColorAccentnode: "#ffffff",
  textColorMutednode: "",
}
//const warmSummer : layoutColor =

//export const mapColortheme: layoutColor[] = []

export const mapviewthemes = {
  modern: {
    leftPane: 'bg-slate-100 text-slate-800',
    canvas: 'bg-white text-slate-800',
    rightPane: 'bg-slate-50 text-slate-800',
    header: 'bg-slate-200 text-slate-800',
    accent: 'bg-blue-600',
    border: 'border-slate-200',
  }

}



/**
 * @file SystemOriginTypes.ts
 * @description
 * Defines types for system-originated transactions to differentiate them from user-initiated updates.
 */

export type SystemActionType = 
  | 'reset' 
  | 'fileLoad' 
  | 'cleanup' 
  | 'initialize'
  | 'documentSwitch';

export interface SystemOrigin {
  type: 'system';
  action: SystemActionType;
  transactionId?: string; // Optional identifier for tracking related operations
}

// autosave origins
export type LocalOrigin = { __bm_local: true };

export const LOCAL_ORIGIN: LocalOrigin = Object.freeze({ __bm_local: true });


export type Visibility = "private" | "public";

export interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
}
//bloom-maps\app\Library\Definitions\Definitions.tsx
export interface CueCard {
    id: string; // Unique identifier for the cue card
    title: string; // Title of the cue card
    content: string; // Main content of the cue card
    createdDate?: Date; // Optional: Date the cue card was created
    tags?: string[]; // Optional: Tags for categorizing cue cards
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6; // Add bloomLevel as an optional property
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


// Interface for ConceptNodeProps
// Interface for ConceptNodeProps
export interface ConceptNodeProps {
  node: ConceptNode; // The data representing a Concept-node
  //onDragStart: (node: ConceptNode) => void; // Drag start function, kept as it is still needed
   onOpenCueCardModal: (nodeId: string) => void;
}


// Extended props for ConceptNode with additional context functions
/**export interface ExtendedConceptNodeProps extends ConceptNodeProps {
    onClick: (cueCards: CueCard[]) => void;
  } */

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
  
  // Interface for a map of cue cards associated with concept nodes
  export type CueCardMap = Map<string, CueCard[]>; // Keyed by ConceptNode ID
  
  // Interface for the CueCardContext
  export interface CueCardContextType {
    cueCardMap: CueCardMap; // The map storing cue cards keyed by ConceptNode ID
    addCueCard: (nodeId: string, cueCard: CueCard) => void; // Function to add a cue card
    removeCueCard: (nodeId: string, cueCardId: string) => void; // Function to remove a cue card
    updateCueCard: (nodeId: string, cueCard: CueCard) => void; // Function to update a cue card
    selectCueCards: (nodeId: string) => CueCard[]; // Function to select cue cards for a specific node
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

export interface DocumentContextType {
    nodes: Map<string, ConceptNode>;
    selectedCueCards: CueCard[];
    bloomDepth: 1 | 2 | 3 | 4 | 5 | 6;
    setBloomDepth: (depth: 1 | 2 | 3 | 4 | 5 | 6) => void;
    colorTheme: ColorTheme;
    setColorTheme: (theme: ColorTheme) => void;
    selectCueCards: (cueCards: CueCard[]) => void;
    //resetDocument: () => void;
    createNewNode: (title: string, parentNodeId: string) => void;
    createSecondaryRootNode: (title: string, x: number, y: number) => void;
    addCueCardToNode: (nodeId: string, cueCard: CueCard) => void;
    updateNodeTitle: (nodeId: string, newTitle: string) => void;
    updateNode: (nodeId: string, updatedNode: Partial<ConceptNode>) => void;
    initializeNewDocument: (bloomDepth: 1 | 2 | 3 | 4 | 5 | 6, groundWidth: number, isInitialLoad: boolean) => void;
    primaryRootNode: (title: string, groundWidth: number) => void;
    zoomLevel: number;
    zoomIn: () => void;
    zoomOut: () => void;
    //updateScrollPosition: (left: number, top: number) => void;
    defaultMapWidth: number;
    defaultMapHeight: number;
    getLayout: boolean;
    setGetLayout: (bool: boolean) => void;
    toggleResetMapSize: () => void;
    //updateDefaultMapSize: (width: number, height: number) => void;
    //scrollLeft: number; // Added scrollLeft to track horizontal scroll position
    //scrollTop: number; // Added scrollTop to track vertical scroll position
    //adjustScrollPosition: (newZoomLevel: number) => void; // Added adjustScrollPosition function
  }
  
  
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

  //Document Reducer
  export interface DocumentState {
    nodes: Map<string, ConceptNode>; // A map of all concept nodes
    selectedCueCards: CueCard[]; // An array of currently selected cue cards
    bloomDepth: 1 | 2 | 3 | 4 | 5 | 6; // Represents the Bloom's Taxonomy depth
    colorTheme: ColorTheme; // The current color theme
    getLayout: boolean; // Flag to trigger layout computation
    zoomLevel: number; // Add this line
    baseZoomLevel: number;
    defaultMapWidth: number;
    defaultMapHeight: number;
    groundWidth: number;
    resetMapSize: boolean;
    scrollLeft: number; // Add this line for horizontal scroll position
    scrollTop: number; // Add this line for vertical scroll position
    primaryColor: string; // New property
    backgroundColor: string;
    
    // Add other state properties as needed
  }
  export type DocumentAction =
  | { type: DocumentActionType.UPDATE_NODE; payload: { nodeId: string; updatedNode: Partial<ConceptNode> } }
  | { type: DocumentActionType.SELECT_CUE_CARDS; payload: CueCard[] }
  | { type: DocumentActionType.SET_NODES; payload: Map<string, ConceptNode> }
  | { type: DocumentActionType.SET_COLOR_THEME; payload: ColorTheme }
  | { type: DocumentActionType.ADD_CUE_CARD_TO_NODE; payload: { nodeId: string; cueCard: CueCard } }
  | { type: DocumentActionType.UPDATE_NODE_TITLE; payload: { nodeId: string; newTitle: string } }
  | { type: DocumentActionType.SET_GET_LAYOUT; payload: boolean }
  | { type: DocumentActionType.CREATE_NEW_NODE; payload: { title: string; parentNodeId: string } }
  | { type: DocumentActionType.INIT_NEW_DOCUMENT; payload: { bloomDepth: 1 | 2 | 3 | 4 | 5 | 6; mapWidth: number; mapHeight: number } }
  | { type: DocumentActionType.SET_MAP_SIZE; payload: { groundWidth: number; mapWidth: number; mapHeight: number } }
  | { type: DocumentActionType.RESET_GLOBAL_DATA }
  | { type: DocumentActionType.SET_ZOOM_LEVEL; payload: number }
  | { type: DocumentActionType.ZOOM_IN }
  | { type: DocumentActionType.ZOOM_OUT }
  | { type: DocumentActionType.SET_PRIMARY_COLOR; payload: string } // New action type
  | { type: DocumentActionType.SET_BACKGROUND_COLOR; payload: string }
  | { type: DocumentActionType.TOGGLE_RESET_MAP_SIZE };

// Action Types
export enum DocumentActionType {
  SELECT_CUE_CARDS = 'SELECT_CUE_CARDS',
  SET_NODES = 'SET_NODES',
  SET_COLOR_THEME = 'SET_COLOR_THEME',
  ADD_CUE_CARD_TO_NODE = 'ADD_CUE_CARD_TO_NODE', // New action type
  UPDATE_NODE_TITLE = 'UPDATE_NODE_TITLE', // New action type
  SET_GET_LAYOUT = 'SET_GET_LAYOUT', // New action type
  CREATE_NEW_NODE = 'CREATE_NEW_NODE', // New action type
  INIT_NEW_DOCUMENT = 'INIT_NEW_DOCUMENT', // New action for initializing a document
  SET_MAP_SIZE = 'SET_MAP_SIZE', // Action to reset map size
  RESET_GLOBAL_DATA = 'RESET_GLOBAL_DATA', // Action to reset global state
  SET_ZOOM_LEVEL = 'SET_ZOOM_LEVEL',
  ZOOM_IN = 'ZOOM_IN',
  ZOOM_OUT = 'ZOOM_OUT',
  UPDATE_NODE = 'UPDATE_NODE',
  SET_PRIMARY_COLOR = 'SET_PRIMARY_COLOR',
  SET_BACKGROUND_COLOR = 'SET_BACKGROUND_COLOR',
  TOGGLE_RESET_MAP_SIZE = 'TOGGLE_RESET_MAP_SIZE', 
  // Add other action types as needed
}

export interface CueCard {
    id: string; // Unique identifier for the cue card
    title: string; // Title of the cue card
    content: string; // Main content of the cue card
    createdDate?: Date; // Optional: Date the cue card was created
    tags?: string[]; // Optional: Tags for categorizing cue cards
    bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6; // Add bloomLevel as an optional property
  }
  

  // Interface for CueStackProps
export interface CueStackProps {
    cueCardCount: number;
    colorTheme: string[];
    onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  }


// Interface for ConceptNodeProps
export interface ConceptNodeProps {
    node: ConceptNode; // The data representing a Concept-node, including cue cards
    onClick: (cueCards: CueCard[]) => void; // Expect a CueCard[] argument for handling clicks
  }

// Extended props for ConceptNode with additional context functions
export interface ExtendedConceptNodeProps extends ConceptNodeProps {
    onClick: (cueCards: CueCard[]) => void;
  }

  // Define the Concept-node interface
export interface ConceptNode {
    id: string;
    title: string;
    description?: string;
    cueCards: CueCard[];
    parentNodeId?: string;
    childrenNodeIds?: string[];
    x: number; // X-coordinate for positioning (required)
    y: number; // Y-coordinate for positioning (required)
    mod?: number; // Modification offset for node positioning
    isRoot?: boolean; // Flag to indicate if the node is a root node
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
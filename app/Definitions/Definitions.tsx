// bloom-maps/Definitions/Definitions.tsx

// bloom-maps/app/Definitions/Definitions.tsx

export interface CueCard {
  id: string; // Unique identifier for the cue card
  title: string; // Title of the cue card
  content: string; // Main content of the cue card
  createdDate?: Date; // Optional: Date the cue card was created
  tags?: string[]; // Optional: Tags for categorizing cue cards
  bloomLevel?: 1 | 2 | 3 | 4 | 5 | 6; // Add bloomLevel as an optional property
}


// Define the Concept-node interface
export interface ConceptNode {
  id: string;
  title: string;
  description?: string;
  cueCards: CueCard[];
  parentNodeId?: string;
  childrenNodeIds?: string[];
  x?: number; // X-coordinate for positioning
  y?: number; // Y-coordinate for positioning
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

// Interface for CueCardProps
export interface CueCardProps {
  title: string;
  content: string;
}

// Interface for CueCardDisplayProps
export interface CueCardDisplayProps {
  cueCards?: CueCard[]; // Define the type for cueCards prop
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
    'rgb(254, 159, 171)', // Light pink
    'rgb(57, 212, 192)',  // Aqua
    'rgb(1, 175, 218)'    // Bright blue
  ],
  'gray': [
    'rgb(211, 211, 211)', // Light gray for unspecified levels
  ],
};

// Define the types for the context state and the provider's children props
// Definitions.tsx

// Definitions.tsx

export interface DocumentContextType {
  nodes: ConceptNode[];
  selectedCueCards: CueCard[];
  bloomDepth: 1 | 2 | 3 | 4 | 5 | 6;
  setBloomDepth: (depth: 1 | 2 | 3 | 4 | 5 | 6) => void;
  colorTheme: ColorTheme; // Define colorTheme as part of the context state
  setColorTheme: (theme: ColorTheme) => void; // Function to set colorTheme
  addNode: (node: ConceptNode) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updatedNode: Partial<ConceptNode>) => void;
  selectCueCards: (cueCards: CueCard[]) => void;
  resetDocument: () => void;
  createNewNode: (title: string) => void;
  addCueCardToNode: (nodeId: string, cueCard: CueCard) => void;
  updateNodeTitle: (nodeId: string, newTitle: string) => void;
  initializeNewDocument: (bloomDepth: 1 | 2 | 3 | 4 | 5 | 6) => void;
}



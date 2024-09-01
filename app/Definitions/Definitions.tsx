export interface CueCard {
    id: string; // Unique identifier for the cue card
    title: string; // Title of the cue card
    content: string; // Main content of the cue card
    createdDate?: Date; // Optional: Date the cue card was created
    tags?: string[]; // Optional: Tags for categorizing cue cards
  }
  
  // Define the Concept-node interface
 // bloom-maps/Definitions/Definitions.tsx

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


// bloom-maps/app/Definitions/Definitions.ts

export interface CueStackProps {
  cueCardCount: number;
  colorTheme: string[];
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void; // Updated type for onClick to accept an event parameter
}


  export interface ConceptNodeProps {
    node: ConceptNode; // The data representing a Concept-node, including cue cards
    onClick: (cueCards: CueCard[]) => void; // Update to expect a CueCard[] argument
  }

  export interface CueCardProps {
    title: string;
    content: string;
  }

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

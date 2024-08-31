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


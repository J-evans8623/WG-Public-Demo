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


  export interface CueStackProps {
    cueCardCount: number;
    colorTheme: string[]; // Number of cue cards to display in the stack
    className?: string;
    onClick: () => void;
  }

  export interface ConceptNodeProps {
    node: ConceptNode; // The data representing a Concept-node, including cue cards
    onClick: () => void;
  }

  export interface CueCardProps {
    title: string;
    content: string;
  }

  export interface CueCardDisplayProps {
    cueCards?: CueCard[]; // Define the type for cueCards prop
  }
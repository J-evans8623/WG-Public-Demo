export interface CueCard {
    id: string; // Unique identifier for the cue card
    title: string; // Title of the cue card
    content: string; // Main content of the cue card
    createdDate?: Date; // Optional: Date the cue card was created
    tags?: string[]; // Optional: Tags for categorizing cue cards
  }
  
  // Define the Concept-node interface
  export interface ConceptNode {
    id: string; // Unique identifier for the Concept-node
    title: string; // Title of the Concept-node
    description?: string; // Optional: Brief description of the Concept-node
    cueCards: CueCard[]; // List of associated cue cards
    parentNodeId?: string; // Optional: ID of the parent node (if applicable)
    childrenNodeIds?: string[]; // Optional: IDs of the child nodes (if applicable)
  }

  export interface CueStackProps {
    cueCardCount: number;
    colorTheme: string[]; // Number of cue cards to display in the stack
    className?: string;
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
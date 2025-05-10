// deltaTypes.ts

/**
 * All supported undo/redo operations in the system.
 * Extend this union as new features introduce new reversible actions.
 */
export type Delta =
  | {
      type: 'NODE_ADD';
      nodeId: string;
      nodeData: ConceptNode;
    }
  | {
      type: 'NODE_DELETE';
      nodeId: string;
      nodeData: ConceptNode;
    }
  | {
      type: 'NODE_TITLE';
      nodeId: string;
      previousTitle: string;
      nextTitle: string;
    }
  | {
      type: 'RESOURCE_ADD';
      nodeId: string;
      card: ResourceCard;
    }
  | {
      type: 'RESOURCE_DELETE';
      nodeId: string;
      card: ResourceCard;
    }
  | {
      type: 'RESOURCE_EDIT';
      nodeId: string;
      cardId: string;
      previous: ResourceCard;
      next: ResourceCard;
    };

// Import actual definitions from your shared types
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';

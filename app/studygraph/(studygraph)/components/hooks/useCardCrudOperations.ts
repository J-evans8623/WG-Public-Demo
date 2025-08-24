// src/app/Library/hooks/useCardCrudOperations.ts

import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ResourceCard } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';

// The card types used in CardDisplay
export type CardResourceType = 'cuecard' | 'note' | 'quiz';

interface CreateResourceParams {
  nodeId: string;
  type: CardResourceType;
  title: string;
  content?: any; // For cue cards or notes
  image?: File;  // For picture resources
  description?: any; // For picture resources
  mapId?: string;
  createNode?: boolean; // Flag to create a new node
  nodeTitle?: string;   // Title for the new node if createNode is true
  citations?: Array<{ index: number; textsource: string; page_number: number }>|null;
}

// Utility function to map the CardDisplay type to the resource type used by ResourceContext.
function mapCardTypeToResourceType(type: CardResourceType): 'cueCard' | 'note' | 'picture' | 'practiceSheet' {
  switch (type) {
    case 'cuecard': return 'cueCard';
    case 'note': return 'note';
    case 'quiz': return 'practiceSheet';
    default: throw new Error(`Unknown card type: ${type}`);
  }
}

const useCardCrudOperations = () => {
  const {
    addResourcev1,
    removeResourcev1,
    editResourcev1,
  } = useResourceContext();
  
  const { saveEditwithNewNode } = useNodesContext();
   const { dispatch: layoutDispatch } = useLayoutContext();

  // Create a new resource.
  const createResource = async (params: CreateResourceParams) => {
    // Handle creating a new node if requested
    let targetNodeId = params.nodeId;
    
    if (params.createNode && params.nodeTitle) {
      // Create a new node and get its ID
      targetNodeId = saveEditwithNewNode(params.nodeTitle);
      layoutDispatch(setGetLayout(true));
    }
    
      // For non-image types, we know that the mapped type cannot be "picture".
      const mappedType = mapCardTypeToResourceType(params.type) as Exclude<ReturnType<typeof mapCardTypeToResourceType>, "picture">;
      await addResourcev1({
        nodeId: targetNodeId,
        type: mappedType,
        title: params.title,
        content: params.content,
        citations: params.citations ?? null,
      }, params.mapId);
  
  };

  const updateResource = async (
    resource: ResourceCard,
    updates: Partial<ResourceCard> & { image?: File; newImage?: boolean }
  ) => {
    // For picture resources, use editPictureResourcev1.
   
      // For cue cards, notes, or practice sheets
      const { image, newImage, ...cleanUpdates } = updates;
      const updatedResource = { ...resource, ...cleanUpdates } as ResourceCard;
      await editResourcev1(updatedResource);

  };

  const deleteResource = (nodeId: string, resourceId: string) => {
    removeResourcev1(nodeId, resourceId);
  };

  return { createResource, updateResource, deleteResource };
};

export default useCardCrudOperations;
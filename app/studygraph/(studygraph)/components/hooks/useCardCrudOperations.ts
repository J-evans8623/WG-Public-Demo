// src/app/Library/hooks/useCardCrudOperations.ts

import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ResourceCard, PictureResource } from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';

// The card types used in CardDisplay
export type CardResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

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
    case 'image': return 'picture';
    case 'quiz': return 'practiceSheet';
    default: throw new Error(`Unknown card type: ${type}`);
  }
}

const useCardCrudOperations = () => {
  const {
    addResourcev1,
    addPictureResourcev1,
    removeResourcev1,
    editResourcev1,
    editPictureResourcev1,
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
    
    if (params.type === 'image') {
      if (!params.image) {
        throw new Error('Image file is required for picture resource.');
      }
            const description = params.description ?? params.content;
      await addPictureResourcev1(
        {
          nodeId: targetNodeId,
          title: params.title,
          description: description,
        },
        params.image,
        params.mapId
      );
      console.log('Image saved...');
    } else {
      // For non-image types, we know that the mapped type cannot be "picture".
      const mappedType = mapCardTypeToResourceType(params.type) as Exclude<ReturnType<typeof mapCardTypeToResourceType>, "picture">;
      await addResourcev1({
        nodeId: targetNodeId,
        type: mappedType,
        title: params.title,
        content: params.content,
        citations: params.citations ?? null,
      }, params.mapId);
    }
  };

  const updateResource = async (
    resource: ResourceCard,
    updates: Partial<ResourceCard> & { image?: File; newImage?: boolean }
  ) => {
    // For picture resources, use editPictureResourcev1.
    if (resource.type === 'picture') {
      if (updates.newImage) {
        if (!updates.image) {
          throw new Error('New image file is required to update picture resource.');
        }
        await editPictureResourcev1(resource as PictureResource, true, updates.image);
      } else {
        const description = (updates as any).description ?? (updates as any).content;
       const updated: PictureResource = {
          ...(resource as PictureResource),
          title: updates.title ?? resource.title,
          description: description !== undefined
            ? description
            : (resource as PictureResource).description,
        };
        // newImage=false => ResourceContext will skip any upload and persist the new description.
        await editPictureResourcev1(updated, false);
      }
    } else {
      // For cue cards, notes, or practice sheets
      const { image, newImage, ...cleanUpdates } = updates;
      const updatedResource = { ...resource, ...cleanUpdates } as Exclude<ResourceCard, PictureResource>;
      await editResourcev1(updatedResource);
    }
  };

  const deleteResource = (nodeId: string, resourceId: string) => {
    removeResourcev1(nodeId, resourceId);
  };

  return { createResource, updateResource, deleteResource };
};

export default useCardCrudOperations;
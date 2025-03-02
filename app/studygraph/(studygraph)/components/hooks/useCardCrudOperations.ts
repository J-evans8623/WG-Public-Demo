// src/app/Library/hooks/useCardCrudOperations.ts

import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { ResourceCard, PictureResource } from '@/app/Library/Definitions/Definitions';


// The card types used in CardDisplay
export type CardResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

interface CreateResourceParams {
  nodeId: string;
  type: CardResourceType;
  title: string;
  content?: any; // For cue cards or notes
  image?: File;  // For picture resources
  description?: any; // For picture resources
  mapId?:string;
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

  // Create a new resource.
  const createResource = async (params: CreateResourceParams) => {
    if (params.type === 'image') {
      if (!params.image) {
        throw new Error('Image file is required for picture resource.');
      }
      await addPictureResourcev1(
        { nodeId: params.nodeId, title: params.title, description: params.description },
        params.image,
        params.mapId
      );
      console.log('Image saved...')
    } else {
      // For non-image types, we know that the mapped type cannot be "picture".
      const mappedType = mapCardTypeToResourceType(params.type) as Exclude<ReturnType<typeof mapCardTypeToResourceType>, "picture">;
      await addResourcev1({
        nodeId: params.nodeId,
        type: mappedType,
        title: params.title,
        content: params.content,
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
        const { image, newImage, ...cleanUpdates } = updates;
        const updatedResource: PictureResource = {
          ...resource,
          ...cleanUpdates,
          type: 'picture' // force correct type
        };
        await editPictureResourcev1(updatedResource, false);
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

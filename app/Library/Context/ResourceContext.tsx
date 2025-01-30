// ResourceContext.tsx

/**
 * @file ResourceContext.tsx
 * @description
 * Provides the Resource context, managing resources within the Y.Doc.
 * Decouples image file data from Y.js data structures by introducing a separate imageAssets state.
 * Ensures synchronization of image metadata and reliable image display across all replicas.
 */

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { ResourceCard,  PictureResource, PracticeSheetResource, CueCardResource, ImageMessage, PictureResourceResult, FetchError } from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';
import {
  initializeNodeHistory,
  addHistoryEntry,
  undoOperation,
  redoOperation,
  HistoryState,
  HistoryEntry,
  OperationType,
  createBinaryCompoundEntries,
  generateOperationId,
} from '@/app/Library/utils/undoredo/historyutils';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import * as Y from 'yjs';


interface ResourceContextType {
  resources: Map<string, ResourceCard[]>;
  imageAssets: Map<string, File>;
  addResource: (resource: Omit<ResourceCard, 'id'>) => Promise<void>;
  removeResource: (nodeId: string, resourceId: string) => void;
  editResource: (resource: ResourceCard) => void;
  selectResources: (nodeId: string) => Promise<ResourceCard[]>;
  selectCueCards: (nodeId: string) => CueCardResource[];
  selectPictures: (nodeId: string) => Promise<PictureResourceResult[]>;
  selectPracticeSheets: (nodeId: string) => PracticeSheetResource[];
  setResources: (newResources: Map<string, ResourceCard[]>) => void;
  transferResource: (sourceNodeId: string, targetNodeId: string, resourceIds: string[], command: 'copy' | 'cut') => void;
  resetResources: () => void;
  getResourcesByType: (type: 'cueCard' | 'picture' | 'practiceSheet') => Promise<Map<string, ResourceCard[]>>;
  fetchImageOnUpdate: (messages: ImageMessage[]) => Promise<void>;
  undo: (nodeId: string) => void;
  redo: (nodeId: string) => void;
  undoAvailable: (nodeId: string) => boolean;
  redoAvailable: (nodeId: string) => boolean;
  saveImages: () => Promise<Map<string, ArrayBuffer>>;
  loadImages: (imageData: Map<string, ArrayBuffer>) => void;
}



const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export const useResourceContext = () => {
  const context = useContext(ResourceContext);
  if (context === undefined) {
    throw new Error('useResourceContext must be used within a ResourceProvider');
  }
  return context;
};

export const ResourceProvider = ({ children }: { children: ReactNode }) => {
  const { ydoc } = useYDoc();
  const yResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>('resources');
  

  const [resources, setResourcesState] = useState<Map<string, ResourceCard[]>>(new Map());
  const [imageAssets, setImageAssets] = useState<Map<string, File>>(new Map());

  const fetchingImages = useRef<Map<string, Promise<PictureResource>>>(new Map());
  const failedFetches = useRef<Set<ImageMessage>>(new Set());

  useEffect(() => {
    const loadInitialResources = () => {
      const initialResources = new Map<string, ResourceCard[]>();
      yResourcesMap.forEach((yMap, nodeId) => {
        const nodeResources: ResourceCard[] = [];
        yMap.forEach((resource: ResourceCard) => {
          nodeResources.push(resource);
        });
        initialResources.set(nodeId, nodeResources);
      });
      setResourcesState(initialResources);
    };

    loadInitialResources();

    const updateListener = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      // Ignore system-originated updates
      if (transaction.origin?.type === 'system') {
        
        console.log('Ignoring system-origin update:', transaction.origin.action);
        return;
      }

      const updatedResources = new Map<string, ResourceCard[]>();
      yResourcesMap.forEach((yMap, nodeId) => {
        const nodeResources: ResourceCard[] = [];
        yMap.forEach((resource: ResourceCard) => {
          nodeResources.push(resource);
        });
        updatedResources.set(nodeId, nodeResources);
      });

      setResourcesState(updatedResources);

    };

    yResourcesMap.observeDeep(updateListener);

    return () => {
      yResourcesMap.unobserveDeep(updateListener);
    };
  }, [yResourcesMap, ]);

// Inside ResourceContext.tsx

const createPictureResource = (message: ImageMessage, file: File): PictureResource => {
  return {
    id: message.id,
    nodeId: message.nodeId,
    type: 'picture',
    title: message.title,
    serverUrl: message.serverUrl,
    localUrl: URL.createObjectURL(file),
    image: file,
    description: message.description,
    source: message.source
  };
};


const createFetchPromise = useCallback((message: ImageMessage): Promise<PictureResource> => {
  return new Promise<PictureResource>((resolve, reject) => {
    fetch(message.serverUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        const file = new File([blob], `image_${message.id}`, { type: blob.type });
        setImageAssets(prev => new Map(prev).set(message.id, file));
        const pictureResource: PictureResource = {
          id: message.id,
          nodeId: message.nodeId,
          type: 'picture',
          title: message.title,
          serverUrl: message.serverUrl,
          localUrl: URL.createObjectURL(file),
          image: file,
          description: message.description,
          source: message.source
        };
        resolve(pictureResource);
      })
      .catch((error) => {
        console.error(`[ResourceContext] Error fetching image with id ${message.id}:`, error);
        const fetchError: FetchError = {
          name: 'FetchError', // Add this line to fix error #4
          type: 'network_error',
          message: error.message,
          retry: () => retryFetch(message)
        };
        reject(fetchError);
      })
      .finally(() => {
        fetchingImages.current.delete(message.id);
      });
  });
}, []);

const retryFetch = useCallback(async (message: ImageMessage): Promise<PictureResource> => {
  if (fetchingImages.current.has(message.id)) {
    return fetchingImages.current.get(message.id)!;
  }
  const fetchPromise = createFetchPromise(message);
  fetchingImages.current.set(message.id, fetchPromise);
  return fetchPromise;
}, [createFetchPromise]);

const convertImageMessageToPictureResource = useCallback(async (
  message: ImageMessage,
  imageAssets: Map<string, File>
): Promise<PictureResourceResult> => {
  if (imageAssets.has(message.id)) {
    return {
      status: 'ready',
      data: createPictureResource(message, imageAssets.get(message.id)!)
    };
  }

  if (fetchingImages.current.has(message.id)) {
    return {
      status: 'pending',
      data: fetchingImages.current.get(message.id)!
    };
  }

  const fetchPromise = createFetchPromise(message);
  fetchingImages.current.set(message.id, fetchPromise);
  
  return {
    status: 'pending',
    data: fetchPromise,
    retry: () => retryFetch(message)
  };
}, [createFetchPromise, retryFetch]);

  // History map to track past and future states for each node
  const [resourceHistoryMap, setResourceHistoryMap] = useState<Map<string, HistoryState>>(new Map());


  const fetchImageOnUpdate = useCallback(async (messages: ImageMessage[]) => {
    console.log('Attempting to fetch Image');
    const newImages = new Map<string, File>();
  
    await Promise.all(messages.map(async (message) => {
      if (!imageAssets.has(message.id) && !fetchingImages.current.has(message.id)) {
        try {
          const pictureResource = await createFetchPromise(message);
          newImages.set(message.id, pictureResource.image);
        } catch (error) {
          console.error(`[ResourceContext] Failed to fetch image ${message.id}:`, error);
          if (error instanceof Error) {
            // Assuming error has a 'retry' method as per FetchError
            failedFetches.current.add(message);
          }
        }
      }
    }));
  
    if (newImages.size > 0) {
      setImageAssets(prev => new Map([...prev, ...newImages]));
    }
  }, [createFetchPromise, imageAssets]);


  useEffect(() => {
    const handleOnline = () => {
      console.log('Network reconnected. Retrying failed image fetches...');
      failedFetches.current.forEach((message) => {
        retryFetch(message);
        failedFetches.current.delete(message);
      });
    };
    
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [retryFetch]);


  /**
   * Adds a new resource to a node.
   *
   * @param resource - The resource to add (excluding the 'id' field).
   */
  const addResource = useCallback(
    async (resource: Omit<ResourceCard, 'id'>) => {
      console.log('********** Entering addResource **********');
      console.log('Initial Resources:', resources);
      console.log('Resource to Add:', resource);
      if (!resource.type) {
        throw new Error('Resource type is required');
      }

      let newResource: ResourceCard;

      switch (resource.type) {
        case 'cueCard':
          if (!('content' in resource)) {
            throw new Error('Content is required for CueCard');
          }
          newResource = { ...resource, id: uuidv4() } as CueCardResource;
          break;

        case 'picture':
          if (!('image' in resource)) {
            throw new Error('Image is required for Picture');
          }
          console.log('[ResourceContext] Processing picture in addResource:', {
            hasImage: !!resource.image,
            isFile: resource.image instanceof File
          });

          // Upload to asset server if we have a File
          if (resource.image instanceof File) {
            let initResource = resource as PictureResource;
            try {
              
              const formData = new FormData();
              formData.append('image', initResource.image);

              const response = await fetch('/api/asset', {
                method: 'POST',
                body: formData
              });

              if (!response.ok) {
                throw new Error('Failed to upload image');
              }

              const { url: serverUrl } = await response.json();

              // Create ImageMessage for Y.js
               newResource = {
                id: uuidv4(),
                nodeId: initResource.nodeId,
                type: 'picture',
                title: initResource.title,
                serverUrl,
                description: initResource.description,
                source: initResource.source
              };

              // Add to imageAssets
              setImageAssets(prev => new Map(prev).set(newResource.id, initResource.image));


            } catch (error) {
              console.error('[ResourceContext] Error uploading image:', error);
              throw error;
            }
          } else {
            throw new Error('Invalid image file');
          }
          break;

        case 'practiceSheet':
          if (!('content' in resource)) {
            throw new Error('Content is required for PracticeSheet');
          }
          newResource = { ...resource, id: uuidv4() } as PracticeSheetResource;
          break;

        default:
          throw new Error(`Unknown resource type: ${(resource as any).type}`);
      }

      const nodeId = newResource.nodeId;
      const currentResources = resources.get(nodeId) || [];

      // Update history
      const currentHistory = resourceHistoryMap.get(nodeId) || initializeNodeHistory();
      const newHistoryEntry: HistoryEntry = {
        operationId: generateOperationId(),
        type: OperationType.Atomic,
        primaryNodeId: nodeId,
        previousState: [...currentResources],
        newState: [...currentResources, newResource],
      };

      const updatedHistory = addHistoryEntry(currentHistory, newHistoryEntry);
      const newHistoryMap = new Map(resourceHistoryMap);
      newHistoryMap.set(nodeId, updatedHistory);
      setResourceHistoryMap(newHistoryMap);

      // Update Y.Map - For pictures, the File object is null
      ydoc.transact(() => {
        let yMap = yResourcesMap.get(nodeId);
        if (!yMap) {
          yMap = new Y.Map<ResourceCard>();
          yResourcesMap.set(nodeId, yMap);
        }
        console.log('[ResourceContext] Adding resource to Y.Map:', {
          nodeId,
          resource: newResource,
        });
        yMap.set(newResource.id, newResource);
      });

      console.log('********** Leaving addResource **********');
    },
    [resources, resourceHistoryMap, yResourcesMap, ydoc]
  );

  /**
   * Removes a resource from a node.
   *
   * @param nodeId - The ID of the node.
   * @param resourceId - The ID of the resource to remove.
   */
  const removeResource = useCallback(
    (nodeId: string, resourceId: string) => {
      const currentResources = resources.get(nodeId) || [];
      const resourceIndex = currentResources.findIndex((resource) => resource.id === resourceId);

      if (resourceIndex === -1) {
        return;
      }

      const resourceToRemove = currentResources[resourceIndex];

      // Update history: add current state to past
      const currentHistory = resourceHistoryMap.get(nodeId) || initializeNodeHistory();
      const newHistoryEntry: HistoryEntry = {
        operationId: generateOperationId(),
        type: OperationType.Atomic,
        primaryNodeId: nodeId,
        previousState: [...currentResources],
        newState: currentResources.filter((resource) => resource.id !== resourceId),
      };
      const updatedHistory = addHistoryEntry(currentHistory, newHistoryEntry);
      const newHistoryMap = new Map(resourceHistoryMap);
      newHistoryMap.set(nodeId, updatedHistory);
      setResourceHistoryMap(newHistoryMap);

      // Update Y.Map
      ydoc.transact(() => {
        const yMap = yResourcesMap.get(nodeId);
        if (yMap && yMap.has(resourceId)) {
          yMap.delete(resourceId);
        }
      });

      // If the removed resource was a picture, remove it from imageAssets
      if (resourceToRemove.type === 'picture') {
        setImageAssets(prev => {
          const newMap = new Map(prev);
          newMap.delete(resourceId);
          return newMap;
        });
      }
    },
    [resources, resourceHistoryMap, yResourcesMap, ydoc]
  );

  /**f
   * Edits an existing resource within the Y.Doc.
   *
   * @param updatedResource - The resource with updated fields.
   * @param newImage - Flag indicating if the image was updated.
   */
  const editResource = useCallback(async (
    updatedResource: ResourceCard, 
    newImage: boolean = false
  ) => {
    const nodeId = updatedResource.nodeId;
    const currentResources = resources.get(nodeId) || [];
    const resourceIndex = currentResources.findIndex(
      resource => resource.id === updatedResource.id
    );
  
    if (resourceIndex === -1) return;
  
    if (updatedResource.type === 'picture' && newImage) {
      const pictureResource = updatedResource as PictureResource;
      
      try {
        // Upload new image
        const formData = new FormData();
        formData.append('image', pictureResource.image);
        
        const response = await fetch('/api/asset', {
          method: 'POST',
          body: formData
        });
  
        if (!response.ok) throw new Error('Failed to upload image');
        
        const { url: serverUrl } = await response.json();
  
        // Create ImageMessage for Y.js
        const imageMessage: ImageMessage = {
          id: pictureResource.id,
          nodeId: pictureResource.nodeId,
          type: 'picture',
          title: pictureResource.title,
          serverUrl,
          description: pictureResource.description,
          source: pictureResource.source
        };
  
        // Update imageAssets
        setImageAssets(prev => new Map(prev).set(pictureResource.id, pictureResource.image));
  
        // Update Y.Map with ImageMessage
        ydoc.transact(() => {
          const yMap = yResourcesMap.get(nodeId);
          if (yMap) {
            yMap.set(imageMessage.id, imageMessage);
          }
        });
  
      } catch (error) {
        console.error('[ResourceContext] Error updating image:', error);
        throw error;
      }
    } else {
      // Handle non-image updates normally
      ydoc.transact(() => {
        const yMap = yResourcesMap.get(nodeId);
        if (yMap) {
          yMap.set(updatedResource.id, updatedResource);
        }
      });
    }
  }, [resources, yResourcesMap, ydoc]);


  /**
   * Selects all resources associated with a specific node.
   *
   * @param nodeId - The ID of the node.
   * @returns An array of resources.
   */
// Inside ResourceContext.tsx

const selectResources = useCallback(async (nodeId: string): Promise<ResourceCard[]> => {
  const nodeResources = resources.get(nodeId) || [];
  const resourceResults = await Promise.all(nodeResources.map(async (resource) => {
    if (resource.type === 'picture' && 'serverUrl' in resource) {
      const pictureResult = await convertImageMessageToPictureResource(resource as ImageMessage, imageAssets);
      return pictureResult.status === 'ready' ? pictureResult.data : resource;
    }
    return resource;
  }));
  return resourceResults;
}, [resources, convertImageMessageToPictureResource, imageAssets]);


  /**
   * Selects all cue cards associated with a specific node.
   *
   * @param nodeId - The ID of the node.
   * @returns An array of CueCard resources.
   */
  const selectCueCards = useCallback(
    (nodeId: string): CueCardResource[] => {
      return (resources.get(nodeId) || []).filter(
        (resource): resource is CueCardResource => resource.type === 'cueCard'
      );
    },
    [resources]
  );

  /**
   * Selects all pictures associated with a specific node.
   *
   * @param nodeId - The ID of the node.
   * @returns An array of Picture resources.
   */
const selectPictures = useCallback(
  async (nodeId: string): Promise<PictureResourceResult[]> => {
    const nodeResources = resources.get(nodeId) || [];
    const pictureResults = nodeResources
      .filter((resource): resource is ImageMessage => 
        resource.type === 'picture' && 'serverUrl' in resource)
      .map(message => convertImageMessageToPictureResource(message, imageAssets));
      
    return Promise.all(pictureResults);
  },
  [resources, convertImageMessageToPictureResource, imageAssets]
);


  /**
   * Selects all practice sheets associated with a specific node.
   *
   * @param nodeId - The ID of the node.
   * @returns An array of PracticeSheet resources.
   */
  const selectPracticeSheets = useCallback(
    (nodeId: string): PracticeSheetResource[] => {
      return (resources.get(nodeId) || []).filter(
        (resource): resource is PracticeSheetResource => resource.type === 'practiceSheet'
      );
    },
    [resources]
  );



  /**
   * Sets the entire resources map.
   *
   * @param newResources - The new resources map.
   */
  const setResources = useCallback((newResources: Map<string, ResourceCard[]>) => {
    console.log('********** Entering setResources **********');
    console.log('Initial Resources State:', resources);
    console.log('New Resources:', newResources);
    setResourcesState(newResources);
    setResourceHistoryMap(new Map()); // Reset history when setting new resources

    ydoc.transact(() => {
      // Clear existing Y.Maps
      yResourcesMap.forEach((yMap) => {
        yMap.clear();
      });

      // Populate Y.Maps with new resources
      newResources.forEach((resourceArray, nodeId) => {
        let yMap = yResourcesMap.get(nodeId);
        if (!yMap) {
          yMap = new Y.Map<ResourceCard>();
          yResourcesMap.set(nodeId, yMap);
        }
        resourceArray.forEach(resource => {
          yMap.set(resource.id, resource);
        });
      });
    });
    console.log('Updated Resources State:', resources);
    console.log('********** Leaving setResources **********');
  }, [ydoc, yResourcesMap, resources]);

  /**
   * Transfers resources between nodes.
   *
   * @param sourceNodeId - The ID of the source node.
   * @param targetNodeId - The ID of the target node.
   * @param resourceIds - The IDs of the resources to transfer.
   * @param command - The type of transfer: 'copy' or 'cut'.
   */
  const transferResource = useCallback(
    (
      sourceNodeId: string,
      targetNodeId: string,
      resourceIds: string[],
      command: 'copy' | 'cut' = 'cut'
    ) => {
      const sourceResources = resources.get(sourceNodeId) || [];
      const resourcesToTransfer = sourceResources.filter((resource) =>
        resourceIds.includes(resource.id)
      );

      if (resourcesToTransfer.length === 0) {
        return;
      }

      const targetCurrentResources = resources.get(targetNodeId) || [];

      if (command === 'copy') {
        // Handle copy operation: add to target without removing from source
        const transferredResources: ResourceCard[] = resourcesToTransfer.map((resource) => ({
          ...resource,
          id: uuidv4(),
          nodeId: targetNodeId,
        }));

        // Update history: add current state to past for target node
        const operationId = generateOperationId();
        const targetHistory = resourceHistoryMap.get(targetNodeId) || initializeNodeHistory();

        const newHistoryEntry: HistoryEntry = {
          operationId,
          type: OperationType.Atomic,
          primaryNodeId: targetNodeId,
          previousState: [...targetCurrentResources],
          newState: [...targetCurrentResources, ...transferredResources],
        };

        const updatedTargetHistory = addHistoryEntry(targetHistory, newHistoryEntry);
        const newHistoryMap = new Map(resourceHistoryMap);
        newHistoryMap.set(targetNodeId, updatedTargetHistory);
        setResourceHistoryMap(newHistoryMap);

        // Update Y.Map
        ydoc.transact(() => {
          let yMap = yResourcesMap.get(targetNodeId);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            yResourcesMap.set(targetNodeId, yMap);
          }
          transferredResources.forEach(resource => {
            yMap.set(resource.id, resource);
          });
        });
      } else if (command === 'cut') {
        // Handle cut operation: transfer and remove from source
        const transferredResources: ResourceCard[] = resourcesToTransfer.map((resource) => ({
          ...resource,
          id: uuidv4(),
          nodeId: targetNodeId,
        }));

        // Update history for source node
        const operationId = generateOperationId();
        const primaryHistory = resourceHistoryMap.get(sourceNodeId) || initializeNodeHistory();
        const secondaryHistory = resourceHistoryMap.get(targetNodeId) || initializeNodeHistory();

        const primaryNewState = sourceResources.filter(
          (resource) => !resourceIds.includes(resource.id)
        );
        const secondaryNewState = [...targetCurrentResources, ...transferredResources];

        const binaryEntries = createBinaryCompoundEntries(
          operationId,
          sourceNodeId,
          [...sourceResources],
          primaryNewState,
          targetNodeId,
          [...targetCurrentResources],
          secondaryNewState
        );

        // Update history for both nodes
        const updatedPrimaryHistory = addHistoryEntry(primaryHistory, binaryEntries[0]);
        const updatedSecondaryHistory = addHistoryEntry(secondaryHistory, binaryEntries[1]);

        const newHistoryMap = new Map(resourceHistoryMap);
        newHistoryMap.set(sourceNodeId, updatedPrimaryHistory);
        newHistoryMap.set(targetNodeId, updatedSecondaryHistory);
        setResourceHistoryMap(newHistoryMap);

        // Update Y.Map
        ydoc.transact(() => {
          const sourceYMap = yResourcesMap.get(sourceNodeId);
          if (sourceYMap) {
            resourceIds.forEach(resourceId => {
              const resource = sourceYMap.get(resourceId);
              if (resource) {
                // Transfer to target node
                const newResource = { ...resource, id: uuidv4(), nodeId: targetNodeId };
                let targetYMap = yResourcesMap.get(targetNodeId);
                if (!targetYMap) {
                  targetYMap = new Y.Map<ResourceCard>();
                  yResourcesMap.set(targetNodeId, targetYMap);
                }
                targetYMap.set(newResource.id, newResource);
                // Remove from source node
                sourceYMap.delete(resourceId);
              }
            });
          }
        });
      }
    },
    [resources, resourceHistoryMap, yResourcesMap, ydoc]
  );

  /**
   * Resets all resources in the Y.Doc.
   */
  const resetResources = useCallback(() => {
    setResourcesState(new Map());
    setImageAssets(new Map());
    setResourceHistoryMap(new Map());

    ydoc.transact(() => {
      yResourcesMap.forEach((yMap) => {
        yMap.clear();
      });
    });
  }, [yResourcesMap, ydoc]);

  /**
   * Retrieves all resources of a specified type.
   *
   * @param type - The type of resource to retrieve.
   * @returns A map of resources categorized by node ID.
   */
  const getResourcesByType = useCallback(async (type: 'cueCard' | 'picture' | 'practiceSheet'): Promise<Map<string, ResourceCard[]>> => {
    const resourceMap = new Map<string, ResourceCard[]>();
    
    for (const [nodeId, resourceArray] of resources.entries()) {
      const filteredResources = await Promise.all(
        resourceArray
          .filter(resource => resource.type === type)
          .map(async resource => {
            if (type === 'picture' && 'serverUrl' in resource) {
              const result = await convertImageMessageToPictureResource(resource as ImageMessage, imageAssets);
              return result.status === 'ready' ? result.data : resource;
            }
            return resource;
          })
      );
      
      if (filteredResources.length > 0) {
        resourceMap.set(nodeId, filteredResources);
      }
    }
    
    return resourceMap;
  }, [resources, imageAssets, convertImageMessageToPictureResource]);
  /**
   * Performs the undo operation for a specific node.
   *
   * @param nodeId - The ID of the node to undo.
   */
  const undo = useCallback(
    (nodeId: string) => {
      const updatedHistoryMap = new Map(resourceHistoryMap);
      const { updatedHistoryMap: newHistoryMap, revertStates } = undoOperation(updatedHistoryMap, nodeId);

      if (revertStates.size === 0) {
        return;
      }

      setResourceHistoryMap(newHistoryMap);

      // Update the resources state with the reverted states
      setResourcesState((prev) => {
        const updatedResources = new Map(prev);
        revertStates.forEach((state, id) => {
          updatedResources.set(id, state);
        });
        return updatedResources;
      });

      // Update Y.Map accordingly
      ydoc.transact(() => {
        revertStates.forEach((state, nodeId) => {
          let yMap = yResourcesMap.get(nodeId);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            yResourcesMap.set(nodeId, yMap);
          }
          yMap.clear();
          state.forEach(resource => {
            yMap.set(resource.id, resource);
          });
        });
      });
    },
    [resourceHistoryMap, yResourcesMap, ydoc]
  );

  /**
   * Performs the redo operation for a specific node.
   *
   * @param nodeId - The ID of the node to redo.
   */
  const redo = useCallback(
    (nodeId: string) => {
      const updatedHistoryMap = new Map(resourceHistoryMap);
      const { updatedHistoryMap: newHistoryMap, applyStates } = redoOperation(updatedHistoryMap, nodeId);

      if (applyStates.size === 0) {
        return;
      }

      setResourceHistoryMap(newHistoryMap);

      // Update the resources state with the applied states
      setResourcesState((prev) => {
        const updatedResources = new Map(prev);
        applyStates.forEach((state, id) => {
          updatedResources.set(id, state);
        });
        return updatedResources;
      });

      // Update Y.Map accordingly
      ydoc.transact(() => {
        applyStates.forEach((state, nodeId) => {
          let yMap = yResourcesMap.get(nodeId);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            yResourcesMap.set(nodeId, yMap);
          }
          yMap.clear();
          state.forEach(resource => {
            yMap.set(resource.id, resource);
          });
        });
      });
    },
    [resourceHistoryMap, yResourcesMap, ydoc]
  );

  /**
   * Determines if an undo action is available for a node.
   *
   * @param nodeId - The ID of the node.
   * @returns True if undo is possible, otherwise false.
   */
  const undoAvailable = useCallback(
    (nodeId: string) => {
      const history = resourceHistoryMap.get(nodeId);
      return history ? history.past.length > 0 : false;
    },
    [resourceHistoryMap]
  );

  /**
   * Determines if a redo action is available for a node.
   *
   * @param nodeId - The ID of the node.
   * @returns True if redo is possible, otherwise false.
   */
  const redoAvailable = useCallback(
    (nodeId: string) => {
      const history = resourceHistoryMap.get(nodeId);
      return history ? history.future.length > 0 : false;
    },
    [resourceHistoryMap]
  );


  const saveImages = useCallback(async (): Promise<Map<string, ArrayBuffer>> => {
    const savedImages = new Map<string, ArrayBuffer>();
    
    // Only save images that have corresponding ImageMessages in Y.map
    const imageMessages = new Set<string>();
    yResourcesMap.forEach((yMap) => {
      yMap.forEach((resource: ResourceCard) => {
        if (resource.type === 'picture' && 'serverUrl' in resource) {
          imageMessages.add(resource.id);
        }
      });
    });

    // Save only images that have corresponding messages
    for (const [imageId, imageFile] of imageAssets.entries()) {
      if (imageMessages.has(imageId)) {
        savedImages.set(imageId, await imageFile.arrayBuffer());
      }
    }
    
    return savedImages;
  }, [yResourcesMap, imageAssets]);

  const loadImages = useCallback((imageData: Map<string, ArrayBuffer>) => {
    const newImages = new Map<string, File>();
    
    imageData.forEach((buffer, imageId) => {
      const file = new File([buffer], `image_${imageId}`, { 
        type: 'image/jpeg' // You might want to store/restore actual mime types
      });
      newImages.set(imageId, file);
    });

    setImageAssets(newImages);
  }, []);

  const contextValue: ResourceContextType = useMemo(() => ({
    resources,
    imageAssets,
    addResource,
    removeResource,
    editResource,
    selectResources,
    selectCueCards,
    selectPictures,
    selectPracticeSheets,
    setResources,
    transferResource,
    resetResources,
    getResourcesByType,
    fetchImageOnUpdate,
    undo,
    redo,
    undoAvailable,
    redoAvailable,
    saveImages,
    loadImages,
  }), [
    resources,
    imageAssets,
    addResource,
    removeResource,
    editResource,
    selectResources,
    selectCueCards,
    selectPictures,
    selectPracticeSheets,
    setResources,
    transferResource,
    resetResources,
    getResourcesByType,
    fetchImageOnUpdate,
    undo,
    redo,
    undoAvailable,
    redoAvailable,
    saveImages,
    loadImages,
  ]);

  return (
    <ResourceContext.Provider
      value={contextValue}
    >
      {children}
    </ResourceContext.Provider>
  );
};

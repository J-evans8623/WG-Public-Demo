// ResourceContext.tsx

/**
 * @file ResourceContext.tsx
 * @description
 * Provides the Resource context, managing resources within the Y.Doc.
 * Decouples image file data from Y.js data structures by introducing a separate imageAssets state.
 * Ensures synchronization of image metadata and reliable image display across all replicas.
 */

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { ResourceCard,  PictureResource, PracticeSheetResource, CueCardResource, NoteResource } from '@/app/Library/Definitions/Definitions';
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
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';


interface ResourceContextType {
  resources: Map<string, ResourceCard[]>;
  removeResource: (nodeId: string, resourceId: string) => void;
  selectResources: (nodeId: string) => ResourceCard[];
  selectCueCards: (nodeId: string) => CueCardResource[];
  selectPictures: (nodeId: string) => PictureResource[];
  selectPracticeSheets: (nodeId: string) => PracticeSheetResource[];
  setResources: (newResources: Map<string, ResourceCard[]>) => void;
  transferResource: (sourceNodeId: string, targetNodeId: string, resourceIds: string[], command: 'copy' | 'cut') => void;
  resetResources: () => void;
  getResourcesByType: (type: 'cueCard' | 'picture' | 'practiceSheet') => Map<string, ResourceCard[]>;
  undo: (nodeId: string) => void;
  redo: (nodeId: string) => void;
  undoAvailable: (nodeId: string) => boolean;
  redoAvailable: (nodeId: string) => boolean;
  addResourcev1: (params: { nodeId: string; type: 'cueCard' | 'note'  |'practiceSheet'; title: string; content: any; }, mapID?:string) => Promise<void>;
  addPictureResourcev1: (params: { nodeId: string; title: string; description?: any; }, image: File, mapID?:string) => Promise<void>;
  removeResourcev1: (nodeId: string, resourceId: string) => void;
  editResourcev1: (resource: ResourceCard) => Promise<void>;
  editPictureResourcev1: (resource: PictureResource, newImage: boolean, image?: File) => Promise<void>;
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
  const { activeConceptMapId } = useLessonModule();
  const resourcesMapKey = `resources:${activeConceptMapId}`;
  const yResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(resourcesMapKey);
  const [resources, setResourcesState] = useState<Map<string, ResourceCard[]>>(new Map());

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

  // History map to track past and future states for each node
  const [resourceHistoryMap, setResourceHistoryMap] = useState<Map<string, HistoryState>>(new Map());



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
    },
    [resources, resourceHistoryMap, yResourcesMap, ydoc]
  );


    // Create a resource for cue cards or practice sheets.
    const addResourcev1 = useCallback(
      async (params: { nodeId: string; type: 'cueCard' | 'note' | 'practiceSheet'; title: string; content: any; }, mapID?:string) => {
        console.log(`addResourceV1 invoked with activeConceptMapID ${activeConceptMapId}`);
        console.log(`addResourceV1 invoked with parameter mapID ${mapID}`);
        const usedMapID = mapID || activeConceptMapId;
        const resourcesKey = `resources:${usedMapID}`;
        const yResourceMap = ydoc.getMap<Y.Map<ResourceCard>>(resourcesKey);

        let newResource: ResourceCard;
        if (params.type === 'cueCard') {
          newResource = {
            id: uuidv4(),
            nodeId: params.nodeId,
            type: 'cueCard',
            title: params.title,
            content: params.content,
          } as CueCardResource;
        } else if (params.type === 'note') {
          newResource = {
            id: uuidv4(),
            nodeId: params.nodeId,
            type: 'note',
            title: params.title,
            content: params.content,
          } as NoteResource;
        } else if (params.type === 'practiceSheet') {
          newResource = {
            id: uuidv4(),
            nodeId: params.nodeId,
            type: 'practiceSheet',
            title: params.title,
            content: params.content,
          } as PracticeSheetResource;
        } else {
          throw new Error(`Unsupported resource type: ${params.type}`);
        }
    
        // Update local state.
        setResourcesState((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(params.nodeId) || [];
          newMap.set(params.nodeId, [...current, newResource]);
          return newMap;
        });
    
        // Update the shared Y.Doc.
        ydoc.transact(() => {
          let yMap = yResourceMap.get(params.nodeId);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            yResourceMap.set(params.nodeId, yMap);
          }
          yMap.set(newResource.id, newResource);
        });
      },
      [ydoc,activeConceptMapId]
    );
  
/**
   * addPictureResourcev1
   * @description Creates a picture resource and uploads the image.
   *              It updates local state for immediate preview, then performs a secure API call to obtain a permanent image URL.
   *              The secure fetch includes credentials to send session cookies.
   * @param params - Parameters for the picture resource.
   * @param image - The image file to upload.
   * @param mapID - (Optional) Map ID override.
   */
const addPictureResourcev1 = useCallback(
  async (
    params: { nodeId: string; title: string; description?: any; },
    image: File,
    mapID?: string
  ) => {
    const usedMapID = mapID || activeConceptMapId;
    const resourcesKey = `resources:${usedMapID}`;
    const yResourceMap = ydoc.getMap<Y.Map<ResourceCard>>(resourcesKey);
    const newId = uuidv4();

    // Step 1: Create a temporary URL for immediate preview.
    const localUrl = URL.createObjectURL(image);
    const newPicture: PictureResource = {
      id: newId,
      nodeId: params.nodeId,
      type: 'picture',
      title: params.title,
      imageUrl: localUrl,
      description: params.description,
    };

    // Step 2: Update local state immediately for preview.
    setResourcesState((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(params.nodeId) || [];
      newMap.set(params.nodeId, [...current, newPicture]);
      return newMap;
    });

    // Step 3: Upload the image using a secure API call with credentials.
    try {
      const formData = new FormData();
      formData.append('image', image);
      const response = await fetch('/api/asset', {
        method: 'POST',
        body: formData,
        credentials: 'include' // Secure API call: include credentials.
      });
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      const { url: serverUrl } = await response.json();

      // Step 4: Update the picture resource with the permanent URL.
      const updatedPicture: PictureResource = {
        ...newPicture,
        imageUrl: serverUrl,
      };

      // Update local state and Y.Doc with the updated picture resource.
      setResourcesState((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(params.nodeId) || [];
        const updatedResources = current.map((res) => (res.id === newId ? updatedPicture : res));
        newMap.set(params.nodeId, updatedResources);
        return newMap;
      });

      ydoc.transact(() => {
        let yMap = yResourceMap.get(params.nodeId);
        if (!yMap) {
          yMap = new Y.Map<ResourceCard>();
          yResourceMap.set(params.nodeId, yMap);
        }
        yMap.set(updatedPicture.id, updatedPicture);
      });
    } catch (error) {
      console.error('Error in addPictureResourcev1:', error);
      throw error;
    }
  },
  [ydoc, activeConceptMapId]
);

/**
 * editPictureResourcev1
 * @description Edits a picture resource. If a new image is provided, it securely uploads the new image.
 *              The secure fetch calls include credentials.
 * @param resource - The existing picture resource.
 * @param newImage - Flag indicating whether a new image is provided.
 * @param image - (Optional) The new image file.
 */
const editPictureResourcev1 = useCallback(
  async (resource: PictureResource, newImage: boolean, image?: File) => {
    let updatedResource: PictureResource = { ...resource };
    if (newImage) {
      if (!image) {
        throw new Error('Image file must be provided when newImage is true.');
      }
      const localUrl = URL.createObjectURL(image);
      updatedResource.imageUrl = localUrl;
      // Update state immediately for preview.
      setResourcesState((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(resource.nodeId) || [];
        const updated = current.map((res) => (res.id === resource.id ? updatedResource : res));
        newMap.set(resource.nodeId, updated);
        return newMap;
      });
      // Securely upload the new image.
      try {
        const formData = new FormData();
        formData.append('image', image);
        const response = await fetch('/api/asset', {
          method: 'POST',
          body: formData,
          credentials: 'include' // Secure API call with credentials.
        });
        if (!response.ok) {
          throw new Error('Failed to upload new image');
        }
        const { url: serverUrl } = await response.json();
        updatedResource.imageUrl = serverUrl;
      } catch (error) {
        console.error('Error in editPictureResourcev1 during image upload:', error);
        throw error;
      }
    }
    // Update text fields if needed.
    setResourcesState((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(resource.nodeId) || [];
      const updated = current.map((res) => (res.id === resource.id ? updatedResource : res));
      newMap.set(resource.nodeId, updated);
      return newMap;
    });
    ydoc.transact(() => {
      let yMap = yResourcesMap.get(resource.nodeId);
      if (!yMap) {
        yMap = new Y.Map<ResourceCard>();
        yResourcesMap.set(resource.nodeId, yMap);
      }
      yMap.set(updatedResource.id, updatedResource);
    });
  },
  [ydoc, yResourcesMap]
);
    // Remove a resource.
    const removeResourcev1 = useCallback(
      (nodeId: string, resourceId: string) => {
        setResourcesState((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(nodeId) || [];
          newMap.set(nodeId, current.filter((resource) => resource.id !== resourceId));
          return newMap;
        });
        ydoc.transact(() => {
          const yMap = yResourcesMap.get(nodeId);
          if (yMap && yMap.has(resourceId)) {
            yMap.delete(resourceId);
          }
        });
      },
      [ydoc, yResourcesMap]
    );
  
    // Edit a non-picture resource.
    const editResourcev1 = useCallback(
      async (resource: ResourceCard) => {
        setResourcesState((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(resource.nodeId) || [];
          const updated = current.map((res) => (res.id === resource.id ? resource : res));
          newMap.set(resource.nodeId, updated);
          return newMap;
        });
        ydoc.transact(() => {
          let yMap = yResourcesMap.get(resource.nodeId);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            yResourcesMap.set(resource.nodeId, yMap);
          }
          yMap.set(resource.id, resource);
        });
      },
      [ydoc, yResourcesMap]
    );
  

  /**
   * Selects all resources associated with a specific node.
   *
   * @param nodeId - The ID of the node.
   * @returns An array of resources.
   */
// Inside ResourceContext.tsx

const selectResources = useCallback((nodeId: string): ResourceCard[] => {

  return resources.get(nodeId) || [];
}, [resources]);


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
 * Selects all picture resources associated with a specific node.
 * Now returns synchronously an array of PictureResource.
 *
 * @param nodeId - The ID of the node.
 * @returns An array of PictureResource objects.
 */
const selectPictures = useCallback(
    (nodeId: string): PictureResource[] => {
      const nodeResources = resources.get(nodeId) || [];
      return nodeResources.filter(
        (resource): resource is PictureResource =>
          resource.type === 'picture' && Boolean((resource as PictureResource).imageUrl)
      );
    },
    [resources]
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
  const getResourcesByType = useCallback(
    (type: 'cueCard' | 'picture' | 'practiceSheet'): Map<string, ResourceCard[]> => {
      const resourceMap = new Map<string, ResourceCard[]>();
      resources.forEach((resourceArray, nodeId) => {
        const filteredResources = resourceArray.filter(resource => resource.type === type);
        if (filteredResources.length > 0) {
          resourceMap.set(nodeId, filteredResources);
        }
      });
      return resourceMap;
    },
    [resources]
  );
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



  const contextValue: ResourceContextType = useMemo(() => ({
    resources,
    removeResource,
    selectResources,
    selectCueCards,
    selectPictures,
    selectPracticeSheets,
    setResources,
    transferResource,
    resetResources,
    getResourcesByType,
    undo,
    redo,
    undoAvailable,
    redoAvailable,
    addResourcev1,
    addPictureResourcev1,
    removeResourcev1,
    editResourcev1,
    editPictureResourcev1,
  }), [resources, removeResource, selectResources, selectCueCards, selectPictures, selectPracticeSheets, setResources, transferResource, resetResources, getResourcesByType, undo, redo, undoAvailable, redoAvailable, addResourcev1, addPictureResourcev1, removeResourcev1, editResourcev1, editPictureResourcev1]);

  return (
    <ResourceContext.Provider
      value={contextValue}
    >
      {children}
    </ResourceContext.Provider>
  );
};

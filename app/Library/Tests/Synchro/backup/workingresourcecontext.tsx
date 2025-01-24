/**
 * @file ResourceContext.tsx
 * @description
 * Provides the Resource context, managing resources within the Y.Doc.
 * Filters out system-originated updates to prevent unwanted state changes.
 */

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { ResourceCard, ResourceType, PictureResource, PracticeSheetResource, CueCardResource } from '@/app/Library/Definitions/Definitions';
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
} from '../utils/undoredo/historyutils';
import { useYDoc } from '@/app/Library/Tests/Synchro/YDocContext';
import * as Y from 'yjs';
import { SystemActionType, SystemOrigin } from '@/app/Library/Tests/Synchro/Centralize/SystemOriginTypes';

interface ResourceContextType {
  resources: Map<string, ResourceCard[]>;
  addResource: (resource: Omit<ResourceCard, 'id'>) => void;
  removeResource: (nodeId: string, resourceId: string) => void;
  editResource: (resource: ResourceCard) => void;
  selectResources: (nodeId: string) => ResourceCard[];
  selectCueCards: (nodeId: string) => CueCardResource[];
  selectPictures: (nodeId: string) => PictureResource[];
  selectPracticeSheets: (nodeId: string) => PracticeSheetResource[];
  setResources: (newResources: Map<string, ResourceCard[]>) => void;
  transferResource: (sourceNodeId: string, targetNodeId: string, resourceIds: string[], command: 'copy' | 'cut') => void;
  resetResources: () => void;
  getResourcesByType: (type: 'cueCard' | 'picture' | 'practiceSheet') => Map<string, ResourceCard[]>;
  setResourcesByMap: (
    resourceMap: Map<string, CueCardResource[] | PictureResource[] | PracticeSheetResource[]>,
    options?: { origin?: { type: 'system'; action: SystemActionType } }
  ) => void;
  undo: (nodeId: string) => void;
  redo: (nodeId: string) => void;
  undoAvailable: (nodeId: string) => boolean;
  redoAvailable: (nodeId: string) => boolean;
}

interface SetResourcesOptions {
  origin?: { type: 'system'; action: SystemActionType };
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


  const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const base64ToFile = async (base64String: string, fileName: string): Promise<File> => {
    const res = await fetch(base64String);
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type });
  };

  const convertImageForSync = async (resource: PictureResource): Promise<PictureResource> => {
    if (resource.image instanceof File) {
      // Convert File to base64 for syncing
      const base64Data = await fileToBase64(resource.image);
      return {
        ...resource,
        imageData: base64Data,
        image: null // Clear File object for sync
      };
    }
    return resource;
  };

  const convertSyncedImage = async (resource: PictureResource): Promise<PictureResource> => {
    if (resource.imageData && !resource.image) {
      // Convert base64 back to File
      const file = await base64ToFile(resource.imageData, `image_${resource.id}`);
      return {
        ...resource,
        image: file,
        imageData: undefined // Clear base64 data after conversion
      };
    }
    return resource;
  };


  useEffect(() => {
    const loadInitialResources = () => {
      const initialResources = new Map<string, ResourceCard[]>();
      yResourcesMap.forEach((yMap, nodeId) => {
        const nodeResources: ResourceCard[] = [];
        yMap.forEach((resource: ResourceCard) => {
          nodeResources.push(resource as ResourceCard);
        });
        initialResources.set(nodeId, nodeResources);
      });
      setResourcesState(initialResources);
    };

    loadInitialResources();

    const updateListener = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      // Ignore system-originated updates
      if (transaction.origin?.type === 'system') {
        console.log('[ResourceContext] Ignoring system-origin update:', transaction.origin.action);
        return;
      }

      const updatedResources = new Map<string, ResourceCard[]>();
      yResourcesMap.forEach((yMap, nodeId) => {
        const nodeResources: ResourceCard[] = [];
        yMap.forEach((resource: ResourceCard) => {
          nodeResources.push(resource as ResourceCard);
        });
        updatedResources.set(nodeId, nodeResources);
      });

      setResourcesState(updatedResources);
    };

    yResourcesMap.observeDeep(updateListener);

    return () => {
      yResourcesMap.unobserveDeep(updateListener);
    };
  }, [yResourcesMap]);

  // History map to track past and future states for each node
  const [resourceHistoryMap, setResourceHistoryMap] = useState<Map<string, HistoryState>>(new Map());

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
          newResource = { ...resource, id: uuidv4() } as PictureResource;
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

      // Update history: add current state to past
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

      // Update Y.Map
      ydoc.transact(() => {
        let yMap = yResourcesMap.get(nodeId);
        if (!yMap) {
          yMap = new Y.Map<ResourceCard>();
          yResourcesMap.set(nodeId, yMap);
        }
        yMap.set(newResource.id, newResource);
      });
      console.log('Updated Resources:', resources);
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
    },
    [resources, resourceHistoryMap, yResourcesMap, ydoc]
  );

  /**
   * Edits an existing resource within the Y.Doc.
   *
   * @param updatedResource - The resource with updated fields.
   */
  const editResource = useCallback(
    (updatedResource: ResourceCard) => {
      const nodeId = updatedResource.nodeId;
      const currentResources = resources.get(nodeId) || [];
      const resourceIndex = currentResources.findIndex((resource) => resource.id === updatedResource.id);

      if (resourceIndex === -1) {
        return;
      }

      const previousResource = currentResources[resourceIndex];

      // Update history: add current state to past
      const currentHistory = resourceHistoryMap.get(nodeId) || initializeNodeHistory();
      const newHistoryEntry: HistoryEntry = {
        operationId: generateOperationId(),
        type: OperationType.Atomic,
        primaryNodeId: nodeId,
        previousState: [...currentResources],
        newState: [
          ...currentResources.slice(0, resourceIndex),
          updatedResource,
          ...currentResources.slice(resourceIndex + 1),
        ],
      };
      const updatedHistory = addHistoryEntry(currentHistory, newHistoryEntry);
      const newHistoryMap = new Map(resourceHistoryMap);
      newHistoryMap.set(nodeId, updatedHistory);
      setResourceHistoryMap(newHistoryMap);

      // Update Y.Map
      ydoc.transact(() => {
        const yMap = yResourcesMap.get(nodeId);
        if (yMap && yMap.has(updatedResource.id)) {
          yMap.set(updatedResource.id, updatedResource);
        }
      });
    },
    [resources, resourceHistoryMap, yResourcesMap, ydoc]
  );

  /**
   * Selects all resources associated with a specific node.
   *
   * @param nodeId - The ID of the node.
   * @returns An array of resources.
   */
  const selectResources = useCallback(
    (nodeId: string): ResourceCard[] => {
      return resources.get(nodeId) || [];
    },
    [resources]
  );

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
    (nodeId: string): PictureResource[] => {
      return (resources.get(nodeId) || []).filter(
        (resource): resource is PictureResource => resource.type === 'picture'
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
    (type: 'cueCard' | 'picture' | 'practiceSheet') => {
      const resourceMap = new Map<string, ResourceCard[]>();
      resources.forEach((resourceArray, nodeId) => {
        const filteredResources = resourceArray.filter((resource) => resource.type === type);
        if (filteredResources.length > 0) {
          resourceMap.set(nodeId, filteredResources);
        }
      });
      return resourceMap;
    },
    [resources]
  );

  /**
   * Sets resources in the Y.Doc based on a provided map.
   *
   * @param resourceMap - The map containing resources categorized by node ID.
   */
  const setResourcesByMap = useCallback(
    async (
      resourceMap: Map<string, CueCardResource[] | PictureResource[] | PracticeSheetResource[]>
    ) => {
      console.log('setResourcesByMap called with:', resourceMap);
      
      // Process resources with image conversion
      const processedMap = new Map();
      for (const [nodeId, resources] of resourceMap.entries()) {
        const processedResources = await Promise.all(
          resources.map(async (resource) => {
            if (resource.type === 'picture') {
              return await convertImageForSync(resource as PictureResource);
            }
            return resource;
          })
        );
        processedMap.set(nodeId, processedResources);
      }
  
      setResourcesState((prev) => {
        const updatedResources = new Map(prev);
  
        processedMap.forEach((newResources, nodeId) => {
          const existingResources = updatedResources.get(nodeId) || [];
          
          // Determine the type of resources being added
          const resourceType = newResources[0]?.type;
          console.log(`Processing resources for nodeId: ${nodeId}, type: ${resourceType}`);
  
          // Filter existing resources to keep only those of different types
          const filteredExisting = existingResources.filter(
            resource => resource.type !== resourceType
          );
  
          // Combine filtered existing resources with new resources
          updatedResources.set(nodeId, [...filteredExisting, ...newResources]);
        });
  
        console.log('Updated resources state:', updatedResources);
        return updatedResources;
      });
  
      // Update Y.Map with processed resources
      ydoc.transact(() => {
        processedMap.forEach((newResources: (CueCardResource | PictureResource | PracticeSheetResource)[], nodeId: string) => {
          let yMap = yResourcesMap.get(nodeId);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            yResourcesMap.set(nodeId, yMap);
          }
      
          // Get the resource type with proper typing
          const firstResource = newResources[0];
          if (firstResource) {
            const resourceType = firstResource.type;
            
            // Only clear resources of the same type
            const keysToDelete: string[] = [];
            yMap.forEach((value: ResourceCard, key: string) => {
              if (value.type === resourceType) {
                keysToDelete.push(key);
              }
            });
            keysToDelete.forEach(key => yMap.delete(key));
          }
      
          // Add new processed resources
          newResources.forEach((resource: CueCardResource | PictureResource | PracticeSheetResource) => {
            yMap.set(resource.id, resource);
          });
        });
      });
    },
    [ydoc, yResourcesMap, convertImageForSync] // Add convertImageForSync to dependencies
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
    setResourcesByMap,
    undo,
    redo,
    undoAvailable,
    redoAvailable,
  }), [
    resources,
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
    setResourcesByMap,
    undo,
    redo,
    undoAvailable,
    redoAvailable,
  ]);

  return (
    <ResourceContext.Provider
      value={contextValue}
    >
      {children}
    </ResourceContext.Provider>
  );
};

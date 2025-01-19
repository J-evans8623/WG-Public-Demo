// File: src/Library/Context/ResourceContext.tsx

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
} from '../utils/undoredo/historyutils'; // Adjust the import path as necessary
import { useYDoc } from '@/app/Library/Tests/Synchro/YDocContext'; // Use YDocContext
import * as Y from 'yjs';

/**
 * Interface defining the methods available in the ResourceContext.
 */
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
  setResourcesByMap: (resourceMap: Map<string, CueCardResource[] | PictureResource[] | PracticeSheetResource[]>) => void;
  undo: (nodeId: string) => void;
  redo: (nodeId: string) => void;
  undoAvailable: (nodeId: string) => boolean;
  redoAvailable: (nodeId: string) => boolean;
}

/**
 * Create the ResourceContext with an undefined default value.
 */
const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

/**
 * Provider component for ResourceContext.
 */
export const ResourceProvider = ({ children }: { children: ReactNode }) => {
  // Consume YDocContext to access Y.Doc and WebsocketProvider
  const { ydoc } = useYDoc();
  const yResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>('resources'); // Y.Map<Y.Map<ResourceCard>>

  /**
   * Synchronize Y.Map changes with React state.
   */
  const [resources, setResourcesState] = useState<Map<string, ResourceCard[]>>(new Map());

  useEffect(() => {
    // Function to load initial resources from Y.Map
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

    /**
     * Observe Y.Map for any updates.
     */
    const updateListener = (update: any, origin: any) => {
      console.log('Y.Map update occurred:', {
        origin,
        timestamp: new Date().toISOString(),
        updateType: update.constructor.name
      });
      const updatedResources = new Map<string, ResourceCard[]>();
      yResourcesMap.forEach((yMap, nodeId) => {
        const nodeResources: ResourceCard[] = [];
        yMap.forEach((resource: ResourceCard) => {
          nodeResources.push(resource as ResourceCard);
        });
        updatedResources.set(nodeId, nodeResources);
      });

      console.log('Resources after update:', {
        resourceCount: Array.from(updatedResources.values())
          .reduce((acc, arr) => acc + arr.length, 0)
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
   * Context Functions to Manage Resources via Y.js
   */

  /**
   * Add a new resource to a node.
   * @param resource - The resource to add (excluding the 'id' field).
   */
  const addResource = useCallback(
    (resource: Omit<ResourceCard, 'id'>) => {
      console.log('********** Entering addResource **********');
      console.log('Initial Resources:', resources);
      console.log('Resource to Add:', resource);
      // Validate that the resource has a 'type' property
      if (!resource.type) {
        throw new Error('Resource type is required');
      }

      let newResource: ResourceCard;

      switch (resource.type) {
        case 'cueCard':
          // Ensure required fields for CueCard are present
          if (!('content' in resource)) {
            throw new Error('Content is required for CueCard');
          }
          newResource = { ...resource, id: uuidv4() } as CueCardResource;
          break;
        case 'picture':
          // Ensure required fields for Picture are present
          if (!('image' in resource)) {
            throw new Error('Image is required for Picture');
          }
          newResource = { ...resource, id: uuidv4() } as PictureResource;
          break;
        case 'practiceSheet':
          // Ensure required fields for PracticeSheet are present
          if (!('content' in resource)) {
            throw new Error('Content is required for PracticeSheet');
          }
          newResource = { ...resource, id: uuidv4() } as PracticeSheetResource;
          break;
        default:
          throw new Error(`Unknown resource type: ${(resource as any).type}`);
      }

      const nodeId = newResource.nodeId;

      // Get current resources for the node
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

      // Update the resources state immutably and Y.Map
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
   * Remove a resource from a node.
   * @param nodeId - The ID of the node.
   * @param resourceId - The ID of the resource to remove.
   */
  const removeResource = useCallback(
    (nodeId: string, resourceId: string) => {
      const currentResources = resources.get(nodeId) || [];
      const resourceIndex = currentResources.findIndex((resource) => resource.id === resourceId);

      if (resourceIndex === -1) {
        // Resource not found; no action needed
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

      // Update the resources state immutably and Y.Map
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
   * Edit an existing resource.
   * @param updatedResource - The resource with updated fields.
   */
  const editResource = useCallback(
    (updatedResource: ResourceCard) => {
      const nodeId = updatedResource.nodeId;
      const currentResources = resources.get(nodeId) || [];
      const resourceIndex = currentResources.findIndex((resource) => resource.id === updatedResource.id);

      if (resourceIndex === -1) {
        // Resource not found; no action needed
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

      // Update the resources state immutably and Y.Map
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
   * Sets the entire resources map (useful for loading documents).
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
  }, [ydoc, yResourcesMap]);

  /**
   * Transfers resources from one node to another.
   * Now supports 'copy' and 'cut' commands.
   * @param sourceNodeId - The ID of the source node.
   * @param targetNodeId - The ID of the target node.
   * @param resourceIds - An array of resource IDs to transfer.
   * @param command - The type of transfer: 'copy' or 'cut'. Defaults to 'cut'.
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
        // No valid resources to transfer; exit early
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
   * Resets all resources (clears the map).
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
   * Retrieves all resources of a specified type in a Map keyed by nodeId.
   * @param type - The type of resource to retrieve ('cueCard' | 'picture' | 'practiceSheet').
   * @returns Map of specified resource type arrays.
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
   * Sets resources in the ResourceContext by replacing entries with those from the provided map.
   * @param resourceMap - Map containing arrays of CueCardResource[], PictureResource[], or PracticeSheetResource[].
   */
  const setResourcesByMap = useCallback(
    (
      resourceMap: Map<string, CueCardResource[] | PictureResource[] | PracticeSheetResource[]>
    ) => {
      console.log('setResourcesByMap called with:', resourceMap);
      
      setResourcesState((prev) => {
        const updatedResources = new Map(prev);
  
        resourceMap.forEach((newResources, nodeId) => {
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
  
      // Update Y.Map
      ydoc.transact(() => {
        resourceMap.forEach((newResources, nodeId) => {
          let yMap = yResourcesMap.get(nodeId);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            yResourcesMap.set(nodeId, yMap);
          }
  
          // Get the resource type
          const resourceType = newResources[0]?.type;
          
          // Only clear resources of the same type
          if (resourceType) {
            const keysToDelete: string[] = [];
            yMap.forEach((value, key) => {
              if (value.type === resourceType) {
                keysToDelete.push(key);
              }
            });
            keysToDelete.forEach(key => yMap.delete(key));
          }
  
          // Add new resources
          newResources.forEach(resource => {
            yMap.set(resource.id, resource);
          });
        });
      });
    },
    [ydoc, yResourcesMap]
  );

  /**
   * Performs the undo operation for a specific node.
   * Handles both atomic and binary compound operations.
   * @param nodeId - The ID of the node to undo.
   */
  const undo = useCallback(
    (nodeId: string) => {
      const updatedHistoryMap = new Map(resourceHistoryMap);
      const { updatedHistoryMap: newHistoryMap, revertStates } = undoOperation(updatedHistoryMap, nodeId);

      if (revertStates.size === 0) {
        // No changes to revert
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
   * Handles both atomic and binary compound operations.
   * @param nodeId - The ID of the node to redo.
   */
  const redo = useCallback(
    (nodeId: string) => {
      const updatedHistoryMap = new Map(resourceHistoryMap);
      const { updatedHistoryMap: newHistoryMap, applyStates } = redoOperation(updatedHistoryMap, nodeId);

      if (applyStates.size === 0) {
        // No changes to apply
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

  /**
   * Context Value with Resource Management Functions
   */
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

/**
 * Custom hook to access the ResourceContext.
 */
export const useResourceContext = () => {
  const context = useContext(ResourceContext);
  if (context === undefined) {
    throw new Error('useResourceContext must be used within a ResourceProvider');
  }
  return context;
};

// bloom-maps/app/Library/Context/ResourceContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { ResourceCard, ResourceType, PictureResource, PracticeSheetResource, CueCardResource } from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';
import {
  initializeNodeHistory,
  addHistoryEntry,
  undoOperation,
  redoOperation,
  HistoryState,
  canUndoOperation,
  canRedoOperation,
  HistoryEntry,
  OperationType,
  createBinaryCompoundEntries,
  generateOperationId,
} from '../utils/undoredo/historyutils'; // Adjust the import path as necessary
import { Descendant } from 'slate';

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
  undo: (nodeId: string) => void; // New undo method
  redo: (nodeId: string) => void; // New redo method
  undoAvailable:  (nodeId: string) => boolean;
  redoAvailable:  (nodeId: string) => boolean;
}

/**
 * Create the ResourceContext with an undefined default value.
 */
const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

/**
 * Provider component for ResourceContext.
 */
export const ResourceProvider = ({ children }: { children: ReactNode }) => {
  // State holding all resources, keyed by nodeId.
  const [resources, setResourcesState] = useState<Map<string, ResourceCard[]>>(new Map());

  // History map to track past and future states for each node
  const [resourceHistoryMap, setResourceHistoryMap] = useState<Map<string, HistoryState>>(
    new Map()
  );

    useEffect(() => {
      console.log('Context state updated-resources:', resources);
    }, [resources]);

  /**
   * Adds a new resource to a node.
   * @param resource - The resource to add (excluding the 'id' field).
   */
  const addResource = useCallback(
    (resource: Omit<ResourceCard, 'id'>) => {
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

      // Update the resources state immutably
      setResourcesState((prev) => {
        const updatedResources = new Map(prev);
        const nodeResources = updatedResources.get(nodeId) || [];
        updatedResources.set(nodeId, [...nodeResources, newResource]);
        return updatedResources;
      });
    },
    [resources, resourceHistoryMap]
  );

  /**
   * Removes a resource from a node.
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

      // Update the resources state immutably
      setResourcesState((prev) => {
        const updatedResources = new Map(prev);
        const nodeResources = updatedResources.get(nodeId) || [];
        updatedResources.set(nodeId, nodeResources.filter((resource) => resource.id !== resourceId));
        return updatedResources;
      });
    },
    [resources, resourceHistoryMap]
  );

  /**
   * Edits an existing resource.
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

      // Update the resources state immutably
      setResourcesState((prev) => {
        const updatedResources = new Map(prev);
        const nodeResources = [...updatedResources.get(nodeId)!];
        nodeResources[resourceIndex] = updatedResource;
        updatedResources.set(nodeId, nodeResources);
        return updatedResources;
      });
    },
    [resources, resourceHistoryMap]
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
    setResourcesState(newResources);
    setResourceHistoryMap(new Map()); // Reset history when setting new resources
  }, []);

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

        // Create an atomic history entry for the target node
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

        // Update the resources state immutably
        setResourcesState((prev) => {
          const updatedResources = new Map(prev);
          updatedResources.set(targetNodeId, [...targetCurrentResources, ...transferredResources]);
          return updatedResources;
        });
      } else if (command === 'cut') {
        // Handle cut operation: transfer and remove from source
        const transferredResources: ResourceCard[] = resourcesToTransfer.map((resource) => ({
          ...resource,
          id: uuidv4(),
          nodeId: targetNodeId,
        }));

        // Create binary compound history entries
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

        // Update the resources state immutably
        setResourcesState((prev) => {
          const updatedResources = new Map(prev);
          // Update source node resources by removing transferred resources
          updatedResources.set(
            sourceNodeId,
            sourceResources.filter((resource) => !resourceIds.includes(resource.id))
          );
          // Update target node resources by adding transferred resources
          updatedResources.set(targetNodeId, [...targetCurrentResources, ...transferredResources]);
          return updatedResources;
        });
      }
    },
    [resources, resourceHistoryMap]
  );

  /**
   * Resets all resources (clears the map).
   */
  const resetResources = useCallback(() => {
    setResourcesState(new Map());
    setResourceHistoryMap(new Map());
  }, []);

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
      setResourcesState((prev) => {
        const updatedResources = new Map(prev);

        resourceMap.forEach((newResources, nodeId) => {
          // Retrieve existing resources for the node, default to an empty array if none exist
          const existingResources = updatedResources.get(nodeId) || [];

          // Concatenate new resources with existing resources
          updatedResources.set(nodeId, [...existingResources, ...newResources]);
        });

        // Reset history as resources have been replaced
        setResourceHistoryMap(new Map());

        return updatedResources;
      });
    },
    []
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
    },
    [resourceHistoryMap]
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
    },
    [resourceHistoryMap]
  );

  /**
   * Determines if an undo action is available for a node.
   * @param nodeId - The ID of the node.
   * @returns True if undo is possible, otherwise false.
   */
  const undoAvailable = useCallback(
    (nodeId: string) => {
      const history = resourceHistoryMap.get(nodeId);
      return history ? canUndoOperation(history) : false;
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
      return history ? canRedoOperation(history) : false;
    },
    [resourceHistoryMap]
  );

  return (
    <ResourceContext.Provider
      value={{
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
      }}
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

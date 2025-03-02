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
  addResource: (resource: Omit<ResourceCard, 'id'>) => Promise<void>;
  addPictureResource: (resource: Omit<PictureResource, 'id'|'image'>, image:File)  => void;
  removeResource: (nodeId: string, resourceId: string) => void;
  editResource: (resource: ResourceCard) => void;
  editPictureResource: (
    resource: PictureResource,
    newImage: boolean,
    image?: File
  ) => Promise<void>;
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


  const addPictureResource = useCallback(
    async (resource: Omit<PictureResource, 'id'|'image'>, image:File) => {

          let newResource:PictureResource;

            //let initResource = resource as PictureResource;
            let newID = uuidv4();
            const localUrl = URL.createObjectURL(image);

            // 2. Construct the new PictureResource using the new (refactored) shape.
            // Notice that we no longer keep a File object—only a URL.
            const newPicture: PictureResource = {
              id: newID,
              nodeId: resource.nodeId,
              type: 'picture',
              title: resource.title,
              imageUrl: localUrl, // temporary local URL for immediate preview
              description: resource.description,
              source: (resource as any).source, // if you have a source field, etc.
            };

            // Immediately update local state, using the local url. This local url can not be used in the yjs update !
            
            setResourcesState((prev) => {
              const newMap = new Map(prev);
              const current = newMap.get(resource.nodeId) || [];
              newMap.set(resource.nodeId, [...current, newPicture]);
              return newMap;
            });
            
            // Take note that y.doc is only updated using the url returned by the server. The local url in the previous
            // step is used to make an immedaite update, this avoids latency and allows the server upload to happen in the 'background'  in a second update.
            // Thus there are two state updates, the first is handled locally in a data structure that is not tracked by Y.js,           
           // this allows an immediate update. The second update has a dependency on the url returned by the server, this update is used to update the Y.Doc
            try {              
              const formData = new FormData();
              formData.append('image', image);
              
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
                id: newID,
                nodeId: resource.nodeId,
                type: 'picture',
                title: resource.title,
                imageUrl: serverUrl,
                description: resource.description,
                source: resource.source
              };

            } catch (error) {
              console.error('[ResourceContext] Error uploading image:', error);
              throw error;
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

      console.log('********** Leaving addPictureResource **********');
    },
    [resources, resourceHistoryMap, yResourcesMap, ydoc]
  );

  /**
 * @file ResourceContext.tsx
 * @description
 * This file provides the resource management context for the application. It manages various types
 * of resources (such as cue cards, pictures, and practice sheets) by maintaining local state, history
 * (for undo/redo), and a shared Y.Doc state for collaboration.
 * 
 * The editPictureResource function below is responsible for updating an existing PictureResource.
 * It handles updating text fields (such as title or description) and, optionally, replacing the image.
 * When a new image is provided, the function:
 *   - Immediately updates the local state using a temporary local URL for preview.
 *   - Uploads the new image to the server to obtain a permanent URL.
 *   - Updates the resource history and synchronizes changes with the shared Y.Doc state.
 */

const editPictureResource = useCallback(
  /**
   * Updates an existing PictureResource in the shared resource state.
   *
   * This function updates the text and optionally the image of an existing PictureResource.
   * If a new image is provided (newImage === true), the function:
   *   Step 1: Creates a temporary local URL for an immediate preview.
   *   Step 2: Updates the local state with the temporary URL.
   *   Step 3: Uploads the new image file to the server to obtain a permanent URL.
   *   Step 4: Updates the PictureResource with the server URL.
   *
   * After these steps, the function updates the resource history (to support undo/redo),
   * updates the local resource state, and synchronizes the changes with the Y.Doc shared state.
   *
   * @param {PictureResource} updatedResource - The PictureResource with updated text fields.
   * @param {boolean} newImage - Flag indicating whether a new image file is provided.
   * @param {File} [image] - The new image file; required if newImage is true.
   * @throws {Error} If newImage is true but no image file is provided, or if the image upload fails.
   */
  async (
    updatedResource: PictureResource, // The PictureResource with new title/description (and possibly image)
    newImage: boolean,                // Flag indicating whether the image is being replaced
    image?: File                      // The new image file; must be provided if newImage is true
  ) => {
    // Step 0: Create a working copy of the updated resource.
    let editedResource: PictureResource = { ...updatedResource };

    // Step 1: If a new image is provided, handle the image update.
    if (newImage) {
      // Validate that an image file is provided.
      if (!image) {
        throw new Error("Image file must be provided when newImage is true.");
      }
      
      // Step 1a: Create a temporary local URL for immediate image preview.
      const localUrl = URL.createObjectURL(image);
      editedResource.imageUrl = localUrl;

      // Step 1b: Immediately update local state so the user sees the new image preview.
      setResourcesState((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(updatedResource.nodeId) || [];
        const updatedArr = current.map((res) =>
          res.id === updatedResource.id ? editedResource : res
        );
        newMap.set(updatedResource.nodeId, updatedArr);
        return newMap;
      });

      // Step 1c: Upload the new image file to the server.
      try {
        const formData = new FormData();
        formData.append("image", image);

        const response = await fetch("/api/asset", {
          method: "POST",
          body: formData,
        });

        // Check that the server response is successful.
        if (!response.ok) {
          throw new Error("Failed to upload new image.");
        }

        // Parse the server response to retrieve the permanent image URL.
        const { url: serverUrl } = await response.json();

        // Update the resource with the permanent server URL.
        editedResource.imageUrl = serverUrl;
      } catch (error) {
        console.error(
          "[ResourceContext] Error uploading new image in editPictureResource:",
          error
        );
        throw error;
      }
    }
    
    // Step 2: Update text fields and other non-image-related updates (if any).
    const nodeId = editedResource.nodeId;
    const currentResources = resources.get(nodeId) || [];

    // Step 3: Locate the existing resource in the local state.
    const resourceIndex = currentResources.findIndex(
      (res) => res.id === editedResource.id
    );
    if (resourceIndex === -1) {
      console.error(
        `[ResourceContext] editPictureResource: resource ${editedResource.id} not found for node ${nodeId}`
      );
      return;
    }

    // Step 4: Create a new array of resources with the updated PictureResource.
    const newResourcesState = currentResources.map((res) =>
      res.id === editedResource.id ? editedResource : res
    );

    // Step 5: Update the history state for undo/redo support.
    const currentHistory = resourceHistoryMap.get(nodeId) || initializeNodeHistory();
    const newHistoryEntry: HistoryEntry = {
      operationId: generateOperationId(),
      type: OperationType.Atomic,
      primaryNodeId: nodeId,
      previousState: [...currentResources],
      newState: newResourcesState,
    };

    const updatedHistory = addHistoryEntry(currentHistory, newHistoryEntry);
    const newHistoryMap = new Map(resourceHistoryMap);
    newHistoryMap.set(nodeId, updatedHistory);
    setResourceHistoryMap(newHistoryMap);

    // Step 6: Update the local resources state with the edited resource.
    setResourcesState((prev) => {
      const newMap = new Map(prev);
      newMap.set(nodeId, newResourcesState);
      return newMap;
    });

    // Step 7: Synchronize the update with the shared Y.Doc state.
    ydoc.transact(() => {
      let yMap = yResourcesMap.get(nodeId);
      if (!yMap) {
        yMap = new Y.Map<ResourceCard>();
        yResourcesMap.set(nodeId, yMap);
      }
      yMap.set(editedResource.id, editedResource);
    });
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

  /**f
   * Edits an existing resource within the Y.Doc.
   *DEPRICIATED AF
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

      // Handle non-image updates normally
      ydoc.transact(() => {
        const yMap = yResourcesMap.get(nodeId);
        if (yMap) {
          yMap.set(updatedResource.id, updatedResource);
        }
      });
    
  }, [resources, yResourcesMap, ydoc]);


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
  
    // Create a picture resource and handle image upload.
    const addPictureResourcev1 = useCallback(
      async (
        params: { nodeId: string; title: string; description?: any; },
        image: File,
        mapID?: string
      ) => {
        const usedMapID = mapID || activeConceptMapId;
        const resourcesKey = `resources:${usedMapID}`;
        const yResourceMap = ydoc.getMap<Y.Map<ResourceCard>>(resourcesKey)
        const newId = uuidv4();
        // Create a temporary URL for immediate preview.
        const localUrl = URL.createObjectURL(image);
        const newPicture: PictureResource = {
          id: newId,
          nodeId: params.nodeId,
          type: 'picture',
          title: params.title,
          imageUrl: localUrl,
          description: params.description,
        };
  
        // Update local state immediately for preview.
        setResourcesState((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(params.nodeId) || [];
          newMap.set(params.nodeId, [...current, newPicture]);
          return newMap;
        });
  
        // Simulate image upload to obtain a permanent URL.
        try {
          const formData = new FormData();
          formData.append('image', image);
          const response = await fetch('/api/asset', { method: 'POST', body: formData });
          if (!response.ok) {
            throw new Error('Failed to upload image');
          }
          const { url: serverUrl } = await response.json();
          // Update the picture resource with the permanent URL.
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
  
    // Edit a picture resource – optionally replacing its image.
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
          // Upload the new image.
          try {
            const formData = new FormData();
            formData.append('image', image);
            const response = await fetch('/api/asset', { method: 'POST', body: formData });
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
    addResource,
    addPictureResource,
    removeResource,
    editResource,
    editPictureResource,
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

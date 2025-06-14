// ResourceContext.tsx

/**
 * @file ResourceContext.tsx
 * @description
 *   Manages all resources in a shared Y.Doc map.  
 *   Instruments every CRUD operation as a single Y.Doc transaction
 *   that also emits a global undo/redo Delta via record().
 *   Fixes a stray-quotation bug in editResourcev1 so text is passed through unchanged.
 */

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import * as Y from 'yjs';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { record } from '@/app/studygraph/(studygraph)/components/utils/deltaEngine';
import { Delta } from '@/app/Library/Definitions/deltaTypes';
import { useUndoRedo } from '@/app/studygraph/(studygraph)/components/Context/UndoRedoContext';
import {
  ResourceCard,
  PictureResource,
  PracticeSheetResource,
  CueCardResource,
  NoteResource,
  Citation,
} from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';
import NoteCard from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/NoteCard';

export interface ResourceContextType {
  resources: Map<string, ResourceCard[]>;
  addResourcev1(
    params: {
      nodeId: string;
      type: 'cueCard' | 'note' | 'practiceSheet';
      title: string;
      content: any;
      citations?: Array<{ index: number; textsource: string; page_number: number }> | null;
    },
    mapID?: string
  ): Promise<void>;
  removeResourcev1(nodeId: string, resourceId: string): void;
  editResourcev1(resource: ResourceCard): Promise<void>;
  addPictureResourcev1(
    params: { nodeId: string; title: string; description?: any },
    image: File,
    mapID?: string
  ): Promise<void>;
  editPictureResourcev1(
    resource: PictureResource,
    newImage: boolean,
    image?: File
  ): Promise<void>;
  transferResource(
    sourceNodeId: string,
    targetNodeId: string,
    resourceIds: string[],
    command?: 'copy' | 'cut'
  ): void;
  selectResources(nodeId: string): ResourceCard[];
  selectNoteCards(nodeId: string): NoteResource[]
  selectCueCards(nodeId: string): CueCardResource[];
  selectPictures(nodeId: string): PictureResource[];
  selectPracticeSheets(nodeId: string): PracticeSheetResource[];
  setResources(newResources: Map<string, ResourceCard[]>): void;
  resetResources(): void;
  getResourceCard(id: string): ResourceCard | undefined;
  // global undo/redo
  undo(): void;
  redo(): void;
}

const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export const useResourceContext = (): ResourceContextType => {
  const ctx = useContext(ResourceContext);
  if (!ctx) throw new Error('useResourceContext must be used within ResourceProvider');
  return ctx;
};

export const ResourceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ydoc } = useYDoc();
  const { activeConceptMapId } = useLessonModule();
  const mapKey = `resources:${activeConceptMapId}`;
  const yResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(mapKey);

  const [resources, setResources] = useState<Map<string, ResourceCard[]>>(new Map());
  const { undo: globalUndo, redo: globalRedo } = useUndoRedo();

  // Load initial state & subscribe to remote Y.Doc changes
  useEffect(() => {
    const load = () => {
      const m = new Map<string, ResourceCard[]>();
      yResourcesMap.forEach((yMap, nodeId) => {
        m.set(nodeId, Array.from(yMap.values()));
      });
      setResources(m);
    };
    load();
    const onUpdate = (_: Y.YEvent<any>[], tx: Y.Transaction) => {
      if (tx.origin?.type !== 'system') load();
    };
    yResourcesMap.observeDeep(onUpdate);
    return () => yResourcesMap.unobserveDeep(onUpdate);
  }, [yResourcesMap]);

  // --- CRUD + undo/redo instrumentation ---

const addResourcev1 = useCallback(
  async (
    {
      nodeId,
      type,
      title,
      content,
      /** Optional array of citations metadata to attach to this resource */
      citations,
    }: {
      nodeId: string;
      type: 'cueCard' | 'note' | 'practiceSheet';
      title: string;
      content: any;
      citations?: Citation[] | null;
    },
    mapID?: string
  ) => {
    const usedMapId = mapID || activeConceptMapId;
    const mapKey = `resources:${usedMapId}`;
    const yResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(mapKey);

    const id = uuidv4();
    let card: ResourceCard;
    if (type === 'cueCard') {
      card = {
        id,
        nodeId,
        type,
        title,
        content,
        citations: citations ?? null,
      } as CueCardResource;
    } else if (type === 'note') {
      card = {
        id,
        nodeId,
        type,
        title,
        content,
        citations: citations ?? null,
      } as NoteResource;
    } else {
      card = {
        id,
        nodeId,
        type,
        title,
        content,
        citations: citations ?? null,
      } as PracticeSheetResource;
    }

    const delta: Delta = { type: 'RESOURCE_ADD', nodeId, card };

    ydoc.transact(() => {
      record(
        delta,
        () => {
          // apply: update React state
          setResources((prev) => {
            const m = new Map(prev);
            const arr = m.get(nodeId) || [];
            m.set(nodeId, [...arr, card]);
            return m;
          });
          // Y.Doc update on the chosen map
          let yMap = yResourcesMap.get(nodeId);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            yResourcesMap.set(nodeId, yMap);
          }
          yMap.set(card.id, card);
        },
        () => {
          // inverse: revert React state
          setResources((prev) => {
            const m = new Map(prev);
            m.set(
              nodeId,
              (m.get(nodeId) || []).filter((c) => c.id !== card.id)
            );
            return m;
          });
          // revert Y.Doc
          yResourcesMap.get(nodeId)?.delete(card.id);
        }
      );
    });
  },
  [ydoc, activeConceptMapId]
);



  const removeResourcev1 = useCallback(
    (nodeId: string, resourceId: string) => {
      const current = resources.get(nodeId) || [];
      const card = current.find((c) => c.id === resourceId);
      if (!card) return;

      const delta: Delta = { type: 'RESOURCE_DELETE', nodeId, card };

      ydoc.transact(() => {
        record(
          delta,
          () => {
            setResources((prev) => {
              const m = new Map(prev);
              m.set(
                nodeId,
                (m.get(nodeId) || []).filter((c) => c.id !== card.id)
              );
              return m;
            });
            yResourcesMap.get(nodeId)?.delete(card.id);
          },
          () => {
            setResources((prev) => {
              const m = new Map(prev);
              const arr = m.get(nodeId) || [];
              m.set(nodeId, [...arr, card]);
              return m;
            });
            let yMap = yResourcesMap.get(nodeId);
            if (!yMap) {
              yMap = new Y.Map<ResourceCard>();
              yResourcesMap.set(nodeId, yMap);
            }
            yMap.set(card.id, card);
          }
        );
      });
    },
    [resources, ydoc, yResourcesMap]
  );

  const editResourcev1 = useCallback(
    async (updated: ResourceCard) => {
      // grab the pre-edit card (no extra quotes added!)
      const before = resources.get(updated.nodeId)?.find((r) => r.id === updated.id);
      if (!before) return;

      const delta: Delta = {
        type: 'RESOURCE_EDIT',
        nodeId: updated.nodeId,
        cardId: updated.id,
        previous: before,
        next: updated,
      };

      ydoc.transact(() => {
        record(
          delta,
          () => {
            setResources((prev) => {
              const m = new Map(prev);
              m.set(
                updated.nodeId,
                (m.get(updated.nodeId) || []).map((r) =>
                  r.id === updated.id ? updated : r
                )
              );
              return m;
            });
            let yMap = yResourcesMap.get(updated.nodeId);
            if (!yMap) {
              yMap = new Y.Map<ResourceCard>();
              yResourcesMap.set(updated.nodeId, yMap);
            }
            yMap.set(updated.id, updated);
          },
          () => {
            setResources((prev) => {
              const m = new Map(prev);
              m.set(
                before.nodeId,
                (m.get(before.nodeId) || []).map((r) =>
                  r.id === before.id ? before : r
                )
              );
              return m;
            });
            yResourcesMap.get(before.nodeId)?.set(before.id, before);
          }
        );
      });
    },
    [resources, ydoc, yResourcesMap]
  );

const addPictureResourcev1 = useCallback(
  async (
    params: { nodeId: string; title: string; description?: any },
    image: File,
    mapID?: string
  ) => {
    // Determine which Y.Doc map to use
    const usedMapId = mapID || activeConceptMapId;
    const mapKey = `resources:${usedMapId}`;
    const yResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(mapKey);

    try {
      // 1) Upload the image to our backend and await the server URL
      const formData = new FormData();
      formData.append('image', image);
      const response = await fetch('/api/asset', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      const { url: serverUrl } = await response.json();

      // 2) Construct a new PictureResource using only the server URL
      const newId = uuidv4();
      const card: PictureResource = {
        id: newId,
        nodeId: params.nodeId,
        type: 'picture',
        title: params.title,
        imageUrl: serverUrl,
        description: params.description,
      };

      // 3) Create a single Y.Doc transaction to persist the new card
      const delta: Delta = {
        type: 'RESOURCE_ADD',
        nodeId: params.nodeId,
        card,
      };

      ydoc.transact(() => {
        record(
          delta,
          () => {
            // Apply: update React local state
            setResources((prev) => {
              const m = new Map(prev);
              const arr = m.get(params.nodeId) || [];
              m.set(params.nodeId, [...arr, card]);
              return m;
            });
            // Apply: update Y.Doc map
            let yMap = yResourcesMap.get(params.nodeId);
            if (!yMap) {
              yMap = new Y.Map<ResourceCard>();
              yResourcesMap.set(params.nodeId, yMap);
            }
            yMap.set(card.id, card);
          },
          () => {
            // Inverse: rollback React local state
            setResources((prev) => {
              const m = new Map(prev);
              m.set(
                params.nodeId,
                (m.get(params.nodeId) || []).filter((c) => c.id !== newId)
              );
              return m;
            });
            // Inverse: rollback Y.Doc map
            yResourcesMap.get(params.nodeId)?.delete(newId);
          }
        );
      });
    } catch (error) {
      console.error('addPictureResourcev1 error:', error);
      throw error;
    }
  },
  [ydoc, activeConceptMapId]
);

const editPictureResourcev1 = useCallback(
  async (resource: PictureResource, newImage: boolean, image?: File) => {
    // Clone the existing resource for “previous” state
    const before = { ...resource };
    let updated: PictureResource = { ...resource };

    // Determine which Y.Doc map to use
    const usedMapId = activeConceptMapId;
    const mapKey = `resources:${usedMapId}`;
    const yResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(mapKey);

    if (newImage) {
      if (!image) {
        throw new Error('File required when newImage=true');
      }

      try {
        // 1) Upload the new image to backend and await the server URL
        const form = new FormData();
        form.append('image', image);
        const res = await fetch('/api/asset', {
          method: 'POST',
          body: form,
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Upload failed');
        }
        const { url: serverUrl } = await res.json();

        // 2) Update only the imageUrl field to the server URL
        updated = { ...updated, imageUrl: serverUrl };
      } catch (err) {
        console.error('editPictureResourcev1 upload error:', err);
        throw err;
      }
    }

    // 3) Perform a single Y.Doc transaction to persist the edit
    const delta: Delta = {
      type: 'RESOURCE_EDIT',
      nodeId: updated.nodeId,
      cardId: updated.id,
      previous: before,
      next: updated,
    };

    ydoc.transact(() => {
      record(
        delta,
        () => {
          // Apply: update React local state
          setResources((prev) => {
            const m = new Map(prev);
            m.set(
              updated.nodeId,
              (m.get(updated.nodeId) || []).map((c) =>
                c.id === updated.id ? updated : c
              )
            );
            return m;
          });
          // Apply: update Y.Doc map
          yResourcesMap.get(updated.nodeId)?.set(updated.id, updated);
        },
        () => {
          // Inverse: rollback React local state to the “before” version
          setResources((prev) => {
            const m = new Map(prev);
            m.set(
              before.nodeId,
              (m.get(before.nodeId) || []).map((c) =>
                c.id === before.id ? before : c
              )
            );
            return m;
          });
          // Inverse: rollback Y.Doc map to the “before” version
          yResourcesMap.get(before.nodeId)?.set(before.id, before);
        }
      );
    });
  },
  [ydoc, activeConceptMapId]
);

  const transferResource = useCallback(
    (
      sourceNodeId: string,
      targetNodeId: string,
      resourceIds: string[],
      command: 'copy' | 'cut' = 'cut'
    ) => {
      const sourceArr = resources.get(sourceNodeId) || [];
      const toMove = sourceArr.filter((r) => resourceIds.includes(r.id));
      if (toMove.length === 0) return;

      const targetArr = resources.get(targetNodeId) || [];

      ydoc.transact(() => {
        toMove.forEach((orig) => {
          const newCard = {
            ...orig,
            id: uuidv4(),
            nodeId: targetNodeId,
          } as ResourceCard;

          // record add
          const deltaAdd: Delta = {
            type: 'RESOURCE_ADD',
            nodeId: targetNodeId,
            card: newCard,
          };
          record(
            deltaAdd,
            () => {
              setResources((prev) => {
                const m = new Map(prev);
                const arr = m.get(targetNodeId) || [];
                m.set(targetNodeId, [...arr, newCard]);
                return m;
              });
              let yMapT = yResourcesMap.get(targetNodeId);
              if (!yMapT) {
                yMapT = new Y.Map<ResourceCard>();
                yResourcesMap.set(targetNodeId, yMapT);
              }
              yMapT.set(newCard.id, newCard);
            },
            () => {
              setResources((prev) => {
                const m = new Map(prev);
                m.set(
                  targetNodeId,
                  (m.get(targetNodeId) || []).filter((c) => c.id !== newCard.id)
                );
                return m;
              });
              yResourcesMap.get(targetNodeId)?.delete(newCard.id);
            }
          );

          if (command === 'cut') {
            // record delete
            const deltaDel: Delta = { type: 'RESOURCE_DELETE', nodeId: sourceNodeId, card: orig };
            record(
              deltaDel,
              () => {
                setResources((prev) => {
                  const m = new Map(prev);
                  m.set(
                    sourceNodeId,
                    (m.get(sourceNodeId) || []).filter((c) => c.id !== orig.id)
                  );
                  return m;
                });
                yResourcesMap.get(sourceNodeId)?.delete(orig.id);
              },
              () => {
                setResources((prev) => {
                  const m = new Map(prev);
                  const arr = m.get(sourceNodeId) || [];
                  m.set(sourceNodeId, [...arr, orig]);
                  return m;
                });
                let yMapS = yResourcesMap.get(sourceNodeId);
                if (!yMapS) {
                  yMapS = new Y.Map<ResourceCard>();
                  yResourcesMap.set(sourceNodeId, yMapS);
                }
                yMapS.set(orig.id, orig);
              }
            );
          }
        });
      });
    },
    [resources, ydoc, yResourcesMap]
  );

  // --- Selectors & bulk ops ---


  const selectNoteCards = useCallback((nodeId:string) => {
    const data = resources.get(nodeId) || [];
    const cards = data.filter((r): r is NoteResource => r.type === 'note');
    return cards
  },[resources])  

const selectResourcesFn = useCallback(
  (nodeId: string) => {
    const arr = resources.get(nodeId) || [];

    // Sort order: 0-Note, 1-Picture, 2-CueCard, 3-PracticeSheet
    const order: Record<ResourceCard['type'], number> = {
      note: 0,
      picture: 1,
      cueCard: 2,
      practiceSheet: 3,
    };

    // Return a new array ordered by the mapping above
    return [...arr].sort(
      (a, b) => (order[a.type] ?? Number.MAX_SAFE_INTEGER) - (order[b.type] ?? Number.MAX_SAFE_INTEGER),
    );
  },
  [resources],
);

  const selectCueCards = useCallback(
    (nodeId: string) =>
      (resources.get(nodeId) || []).filter((r): r is CueCardResource => r.type === 'cueCard'),
    [resources]
  );
  const selectPictures = useCallback(
    (nodeId: string) =>
      (resources.get(nodeId) || []).filter(
        (r): r is PictureResource => r.type === 'picture' && Boolean(r.imageUrl)
      ),
    [resources]
  );
  const selectPracticeSheets = useCallback(
    (nodeId: string) =>
      (resources.get(nodeId) || []).filter(
        (r): r is PracticeSheetResource => r.type === 'practiceSheet'
      ),
    [resources]
  );

  const setResourcesFn = useCallback(
    (newMap: Map<string, ResourceCard[]>) => {
      ydoc.transact(() => {
        setResources(newMap);
        yResourcesMap.forEach((ym) => ym.clear());
        newMap.forEach((arr, nodeId) => {
          let ym = yResourcesMap.get(nodeId);
          if (!ym) {
            ym = new Y.Map<ResourceCard>();
            yResourcesMap.set(nodeId, ym);
          }
          arr.forEach((c) => ym!.set(c.id, c));
        });
      });
    },
    [ydoc, yResourcesMap]
  );

  const resetResources = useCallback(() => {
    ydoc.transact(() => {
      setResources(new Map());
      yResourcesMap.forEach((ym) => ym.clear());
    });
  }, [ydoc, yResourcesMap]);

  const getResourceCard = useCallback(
    (id: string) => {
      for (const arr of resources.values()) {
        const found = arr.find((r) => r.id === id);
        if (found) return found;
      }
    },
    [resources]
  );

  // global undo/redo
  const undo = useCallback(() => globalUndo(), [globalUndo]);
  const redo = useCallback(() => globalRedo(), [globalRedo]);

  const value = useMemo<ResourceContextType>(
    () => ({
      resources,
      addResourcev1,
      removeResourcev1,
      editResourcev1,
      addPictureResourcev1,
      editPictureResourcev1,
      transferResource,
      selectResources: selectResourcesFn,
      selectNoteCards,
      selectCueCards,
      selectPictures,
      selectPracticeSheets,
      setResources: setResourcesFn,
      resetResources,
      getResourceCard,
      undo,
      redo,
    }),
    [
      resources,
      addResourcev1,
      removeResourcev1,
      editResourcev1,
      addPictureResourcev1,
      editPictureResourcev1,
      transferResource,
      selectResourcesFn,
      selectNoteCards,
      selectCueCards,
      selectPictures,
      selectPracticeSheets,
      setResourcesFn,
      resetResources,
      getResourceCard,
      undo,
      redo,
    ]
  );

  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  );
};

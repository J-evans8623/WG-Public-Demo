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
import { record } from '@/app/workspace/(studygraph)/components/utils/deltaEngine';
import { Delta } from '@/app/Library/Definitions/deltaTypes';
import { useUndoRedo } from '@/app/workspace/(studygraph)/components/Context/UndoRedoContext';
import {
  ResourceCard,
  PracticeSheetResource,
  CueCardResource,
  NoteResource,
  Citation,LOCAL_ORIGIN,
  GLOBAL_ASSESSMENTS_NODE_ID, 
  QuizAssessmentResource,      
  QuizBinding,
  IQuizQuestion,
} from '@/app/Library/Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';


export interface ResourceContextType {
  resources: Map<string, ResourceCard[]>;
  addResourcev1(
    params: {
      nodeId: string;
      type: 'cueCard' | 'note' | 'practiceSheet' | 'quizAssessment';
      title: string;
      content: any;
      citations?: Array<{ index: number; textsource: string; page_number: number }> | null;
    },
    mapID?: string
  ): Promise<void>;
  removeResourcev1(nodeId: string, resourceId: string): void; //  removeAssignedQuiz = useCallback((resourceId: string)
  removeAssignedQuiz(resourceId:string): void;
  editResourcev1(resource: ResourceCard): Promise<void>;
  /**addPictureResourcev1(
    params: { nodeId: string; title: string; description?: any },
    image: File,
    mapID?: string
  ): Promise<void>; */
  restoreResource: (card: ResourceCard) => void;
  /**editPictureResourcev1(
    resource: PictureResource,
    newImage: boolean,
    image?: File
  ): Promise<void>; */
  transferResource(
    sourceNodeId: string,
    targetNodeId: string,
    resourceIds: string[],
    command?: 'copy' | 'cut'
  ): void;
  selectResources(nodeId: string): ResourceCard[];
  selectNoteCards(nodeId: string): NoteResource[]
  selectCueCards(nodeId: string): CueCardResource[];
  //selectPictures(nodeId: string): PictureResource[];
  selectPracticeSheets(nodeId: string): PracticeSheetResource[];
  setResources(newResources: Map<string, ResourceCard[]>): void;
  selectQuizAssessments(): QuizAssessmentResource[];
  getQuizAssessmentById: (assignmentId: string, mapId?: string) => QuizAssessmentResource | undefined;
  resetResources(): void;
  getResourceCard(id: string): ResourceCard | undefined;
  assignQuizUpdateSignal: number;
  triggerQuizUpdate: () => void;
  updateQuizContent(resourceId: string, updatedQuestions: IQuizQuestion[]): Promise<void>;
  // global undo/redo
  undo(): void;
  redo(): void;
  updatedRivisonCard:boolean;
  selectAllQuizAssessmentsGlobal: () => QuizAssessmentResource[];
  setupdatedRivisionCard: (flag:boolean) => void,
  getGlobalResourceCard: (
    mapId: string,
    nodeId: string,
    resourceId: string
  ) => ResourceCard | undefined;
   createQuizAssignmentCard: (args: {
    mapId: string;
    title: string;
    binding: QuizBinding | any; // tolerant of inline bindings
    window?: { startAt?: string; endAt?: string };
    attemptLimit?: number;
    instructions?: string;
    createdByEmail?: string;
  }) => Promise<QuizAssessmentResource>;

  createFeedbackQuizCard: (args: {
    mapId: string;
    title: string;
    binding: QuizBinding;
    window?: { startAt?: string; endAt?: string };
    attemptLimit?: number;
    quizResultFeedback?: 'immediately' | 'after_close';
    instructions?: string;
    createdByEmail?: string;
  }) => Promise<QuizAssessmentResource>;
}


/**
 * globalResourceCardLookup
 * Utility function to retrieve a ResourceCard from any Y.Doc by specifying
 * the concept‐map ID (`mapId`), the `nodeId` key, and the `resourceId`. This
 * hides all Yjs map traversal logic behind a single function, and is
 * exported for straightforward unit testing.
 *
 * @param ydocInstance - The Y.Doc to query.
 * @param mapId         - ID of the concept map (used for Yjs map key).
 * @param nodeId        - Node within the map to look up.
 * @param resourceId    - Specific ResourceCard ID.
 * @returns             - The ResourceCard if found; otherwise undefined.
 */
export function globalResourceCardLookup(
  ydocInstance: Y.Doc,
  mapId: string,
  nodeId: string,
  resourceId: string
): ResourceCard | undefined {
  const resourcesKey = `resources:${mapId}`;
  const outer = ydocInstance.getMap<Y.Map<ResourceCard>>(resourcesKey);
  const inner = outer.get(nodeId);
  return inner?.get(resourceId);
}
const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

export const useResourceContext = (): ResourceContextType => {
  const ctx = useContext(ResourceContext);
  if (!ctx) throw new Error('useResourceContext must be used within ResourceProvider');
  return ctx;
};

export const ResourceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ydoc , isReadOnly, snapshotYDoc } = useYDoc();
  const { activeConceptMapId } = useLessonModule();
  const mapKey = `resources:${activeConceptMapId}`;
   const activeDoc = snapshotYDoc ?? ydoc;
  const yResourcesMap =  activeDoc.getMap<Y.Map<ResourceCard>>(mapKey);


  const [resources, setResources] = useState<Map<string, ResourceCard[]>>(new Map());
  const { undo: globalUndo, redo: globalRedo } = useUndoRedo();
   const [updatedRivisonCard, setupdatedRivisionCard] = useState(false);
   const [assignQuizUpdateSignal, setAssignQuizUpdateSignal] = useState(0);


   const triggerQuizUpdate = useCallback(() => {
    setAssignQuizUpdateSignal(prev => prev + 1);
  }, []);

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
        citations,
      }: {
        nodeId: string;
        type: 'cueCard' | 'note' | 'practiceSheet' | 'quizAssessment'; // update - 6
        title: string;
        content: any;
        citations?: Citation[] | null;
      },
      mapID?: string
    ) => {
      if (isReadOnly) {
        console.warn('ResourceContext.tsx[2003] › Read-only mode: addResourcev1 blocked');
        return;
      }
      const usedMapId = mapID || activeConceptMapId;
      const dynamicMapKey = `resources:${usedMapId}`;
      const localYResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(dynamicMapKey);

      const id = uuidv4();
      let card: ResourceCard;

      // update - 7
      // 1) Construct the concrete card per type. For quizAssessment we override nodeId
      //    with the sentinel node to keep global scope and ensure O(1) access via Yjs.
      if (type === 'cueCard') {
        card = {
          id,
          nodeId,
          type,
          title,
          content,
          citations: citations ?? null,
          mapId: usedMapId,
        } as CueCardResource;
        setupdatedRivisionCard(true);
      } else if (type === 'note') {
        card = {
          id,
          nodeId,
          type,
          title,
          content,
          citations: citations ?? null,
          mapId: usedMapId,
        } as NoteResource;
      } else if (type === 'practiceSheet') {
        card = {
          id,
          nodeId,
          type,
          title,
          content,
          citations: citations ?? null,
          mapId: usedMapId,
        } as PracticeSheetResource;
        setupdatedRivisionCard(true);
      } else {
        // type === 'quizAssessment'
        // Content must include a `binding` that reuses existing quiz interfaces.
        const {
          binding,
          window,
          attemptLimit,
          instructions,
          createdByEmail,
          createdAt,
          updatedAt,
        }: {
          binding: QuizBinding;
          window?: { startAt?: string; endAt?: string };
          attemptLimit?: number;
          instructions?: string;
          createdByEmail?: string;
          createdAt?: string;
          updatedAt?: string;
        } = content || {};

        card = {
          id,
          nodeId: GLOBAL_ASSESSMENTS_NODE_ID,
          type: 'quizAssessment',
          title,
          citations: citations ?? null,
          mapId: usedMapId,
          assignmentId: id,
          binding,
          window,
          attemptLimit,
          instructions,
          createdByEmail,
          createdAt,
          updatedAt,
        } as QuizAssessmentResource;

        // console.log('ResourceContext.tsx[2101] › add quizAssessment assignmentId=', id, 'mapId=', usedMapId);
      }

      const effectiveNodeId = (card as ResourceCard).nodeId;
      const delta: Delta = { type: 'RESOURCE_ADD', nodeId: effectiveNodeId, card };
      setupdatedRivisionCard(true);

      ydoc.transact(() => {
        record(
          delta,
          () => {
            setResources((prev) => {
              const m = new Map(prev);
              const arr = m.get(effectiveNodeId) || [];
              m.set(effectiveNodeId, [...arr, card]);
              return m;
            });
            let yMap = localYResourcesMap.get(effectiveNodeId);
            if (!yMap) {
              yMap = new Y.Map<ResourceCard>();
              localYResourcesMap.set(effectiveNodeId, yMap);
            }
            yMap.set((card as ResourceCard).id, card);
          },
          () => {
            setResources((prev) => {
              const m = new Map(prev);
              m.set(
                effectiveNodeId,
                (m.get(effectiveNodeId) || []).filter((c) => c.id !== (card as ResourceCard).id)
              );
              return m;
            });
            localYResourcesMap.get(effectiveNodeId)?.delete((card as ResourceCard).id);
          }
        );
      }, LOCAL_ORIGIN);
    },
    [ydoc, activeConceptMapId, isReadOnly]
  );


 /**
   * @function restoreResource
   * @description
   *   Re-inserts a ResourceCard (with its exact ID, nodeId, and fields) into the live Y.Doc,
   *   skipping read-only restrictions. Updates both the Y.Map and React state in a single
   *   Y.Doc transaction with origin `{type:'system',action:'restoreResource'}`. Emits logs
   *   at start (8101), mid (8102), and completion (8103).
   *
   * @param card - The full ResourceCard snapshot to restore.
   */
// ResourceContext.tsx
const restoreResource = useCallback(
  (card: ResourceCard): void => {

    // Always write into the *live* Y.Doc map:
    const liveMap = ydoc.getMap<Y.Map<ResourceCard>>(mapKey);
    const yMapForNode = liveMap.get(card.nodeId) ?? new Y.Map<ResourceCard>();

    ydoc.transact(
      () => {
        if (!liveMap.has(card.nodeId)) {
          liveMap.set(card.nodeId, yMapForNode);

        }
        yMapForNode.set(card.id, card);

      },
      { type: 'system', action: 'restoreResource' }
    );


  },
  [ydoc, mapKey]
);


  const removeResourcev1 = useCallback(
    (nodeId: string, resourceId: string) => {
          if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
      const current = resources.get(nodeId) || [];
      const card = current.find((c) => c.id === resourceId);
      if (!card) return;

      const delta: Delta = { type: 'RESOURCE_DELETE', nodeId, card };
      setupdatedRivisionCard(true);
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
      }, LOCAL_ORIGIN );
    },
    [resources, ydoc, yResourcesMap, isReadOnly]
  );

  const editResourcev1 = useCallback(
    async (updated: ResourceCard) => {

      if (isReadOnly) {
      console.warn('NodesProvider.tsx 2003 › Read-only mode: initNewDocument blocked');
      return;
    }
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
      },  LOCAL_ORIGIN);
    },
    [resources, ydoc, yResourcesMap, isReadOnly]
  );

  const transferResource = useCallback(
    (
      sourceNodeId: string,
      targetNodeId: string,
      resourceIds: string[],
      command: 'copy' | 'cut' = 'cut'
    ) => {
        if (isReadOnly) {
        console.warn('ResourceContext.tsx 3008 › Read-only mode: addPictureResourcev1 blocked');
        return;
      }
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
    [resources, ydoc, yResourcesMap, isReadOnly]
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
      const filtered = arr.filter(
        (r) => r.type !== 'quizAssessment'
      );


      // Only order the standard card types that appear in this view.
      const order: Record<'note' | 'cueCard' | 'practiceSheet', number> = {
        note: 0,
        cueCard: 1,
        practiceSheet: 2,
      };

      return [...filtered].sort(
        (a, b) => (order[a.type as keyof typeof order] ?? Number.MAX_SAFE_INTEGER) -
                  (order[b.type as keyof typeof order] ?? Number.MAX_SAFE_INTEGER)
      );
    },
    [resources]
  );

  const selectCueCards = useCallback(
    (nodeId: string) =>
      (resources.get(nodeId) || []).filter((r): r is CueCardResource => r.type === 'cueCard'),
    [resources]
  );
 /**  const selectPictures = useCallback(
    (nodeId: string) =>
      (resources.get(nodeId) || []).filter(
        (r): r is PictureResource => r.type === 'picture' && Boolean(r.imageUrl)
      ),
    [resources]
  );*/
  const selectPracticeSheets = useCallback(
    (nodeId: string) =>
      (resources.get(nodeId) || []).filter(
        (r): r is PracticeSheetResource => r.type === 'practiceSheet'
      ),
    [resources]
  );

  const setResourcesFn = useCallback(
    (newMap: Map<string, ResourceCard[]>) => {
        if (isReadOnly) {
        console.warn('ResourceContext.tsx 3008 › Read-only mode: addPictureResourcev1 blocked');
        return;
      }
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
    [ydoc, yResourcesMap, isReadOnly]
  );

 /**
   * @function selectQuizAssessments
   * @description
   * Returns all QuizAssessmentResource cards stored under the sentinel node id for the active map.
   * This selector is used by the “Start review” modal to list global assignments in real-time.
   * @complexity O(k) where k is number of assessments (linear scan of that node map).
   */
  const selectQuizAssessments = useCallback((): QuizAssessmentResource[] => {
    const list = (resources.get(GLOBAL_ASSESSMENTS_NODE_ID) || []).filter(
      (r): r is QuizAssessmentResource => r.type === 'quizAssessment'
    );
     console.log('ResourceContext.tsx[3301] › selectQuizAssessments count=', list.length);
    return list;
  }, [resources]);


  /**
   * @function getQuizAssessmentById
   * @description
   * Helper to fetch a quiz assessment by assignmentId in O(1) using the sentinel node id.
   * The mapId defaults to the active concept map if not provided explicitly.
   */
  const getQuizAssessmentById = useCallback(
    (assignmentId: string, mapId?: string): QuizAssessmentResource | undefined => {
      const m = mapId || activeConceptMapId;
      const card = globalResourceCardLookup(ydoc, m, GLOBAL_ASSESSMENTS_NODE_ID, assignmentId);
      if (card && card.type === 'quizAssessment') {
        // console.log('ResourceContext.tsx[3401] › getQuizAssessmentById hit', assignmentId);
        return card as QuizAssessmentResource;
      }
      // console.log('ResourceContext.tsx[3402] › getQuizAssessmentById miss', assignmentId);
      return undefined;
    },
    [activeConceptMapId, ydoc]
  );
  

  const resetResources = useCallback(() => {
      if (isReadOnly) {
        console.warn('ResourceContext.tsx 3008 › Read-only mode: addPictureResourcev1 blocked');
        return;
      }
    ydoc.transact(() => {
      setResources(new Map());
      yResourcesMap.forEach((ym) => ym.clear());
    });
  }, [ydoc, yResourcesMap, isReadOnly]);

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

  /**
   * getGlobalResourceCard
   * Retrieves a ResourceCard from the live Y.Doc by mapId, nodeId, and resourceId.
   * Logs entry/exit for observability and hides Yjs traversal details.
   *
   * @param mapId       - The concept‑map identifier.
   * @param nodeId      - The node within that map.
   * @param resourceId  - The resource card’s ID.
   * @returns           - The matching ResourceCard or undefined.
   */
  const getGlobalResourceCard = useCallback(
    (
      mapId: string,
      nodeId: string,
      resourceId: string
    ): ResourceCard | undefined => {

      const card = globalResourceCardLookup(
        activeDoc,
        mapId,
        nodeId,
        resourceId
      );

      return card;
    },
    [activeDoc]
  );



  /**
   * createQuizAssignmentCard
   * @description
   *   Creates a global `quizAssessment` card (under the sentinel node) and returns the created
   *   card immediately so callers can persist meta using its authoritative `assignmentId`. This
   *   mirrors the internal `addResourcev1` logic for quizAssessment but exposes the result. Work
   *   is O(1). Logs [9201–9204].
   */
  const createQuizAssignmentCard = useCallback(async (args: {
    mapId: string;
    title: string;
    binding: QuizBinding | any;
    window?: { startAt?: string; endAt?: string };
    attemptLimit?: number;
    instructions?: string;
    createdByEmail?: string;
  }): Promise<QuizAssessmentResource> => {
    if (isReadOnly) {
      console.warn('ResourceContext.tsx[9200] › Read-only mode: createQuizAssignmentCard blocked');
      throw new Error('Read-only mode');
    }
    const usedMapId = args.mapId || activeConceptMapId;
    const dynamicMapKey = `resources:${usedMapId}`;
    const localYResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(dynamicMapKey);

    const id = uuidv4();
    const card: QuizAssessmentResource = {
      id,
      nodeId: GLOBAL_ASSESSMENTS_NODE_ID,
      type: 'quizAssessment',
      title: args.title,
      citations: null,
      mapId: usedMapId,
      assignmentId: id,
      binding: args.binding,
      window: args.window,
      attemptLimit: args.attemptLimit,
      instructions: args.instructions,
      createdByEmail: args.createdByEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // console.log('ResourceContext.tsx[9201] › createQuizAssignmentCard start', { assignmentId: id, mapId: usedMapId });

    const delta: Delta = { type: 'RESOURCE_ADD', nodeId: GLOBAL_ASSESSMENTS_NODE_ID, card };
    ydoc.transact(() => {
      record(
        delta,
        () => {
          // React state
          setResources((prev) => {
            const m = new Map(prev);
            const arr = m.get(GLOBAL_ASSESSMENTS_NODE_ID) || [];
            m.set(GLOBAL_ASSESSMENTS_NODE_ID, [...arr, card]);
            return m;
          });
          // Y.Doc
          let yMap = localYResourcesMap.get(GLOBAL_ASSESSMENTS_NODE_ID);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            localYResourcesMap.set(GLOBAL_ASSESSMENTS_NODE_ID, yMap);
          }
          yMap.set(card.id, card);
          triggerQuizUpdate();
        },
        () => {
          setResources((prev) => {
            const m = new Map(prev);
            m.set(
              GLOBAL_ASSESSMENTS_NODE_ID,
              (m.get(GLOBAL_ASSESSMENTS_NODE_ID) || []).filter((c) => c.id !== card.id)
            );
            return m;
          });
          localYResourcesMap.get(GLOBAL_ASSESSMENTS_NODE_ID)?.delete(card.id);
        }
      );
    }, LOCAL_ORIGIN);

    // console.log('ResourceContext.tsx[9202] › createQuizAssignmentCard ok', { assignmentId: id });
    return card;
  }, [isReadOnly, activeConceptMapId, ydoc, triggerQuizUpdate]);

  const removeAssignedQuiz = useCallback((resourceId: string)=>{
    removeResourcev1(GLOBAL_ASSESSMENTS_NODE_ID,  resourceId);
    triggerQuizUpdate()
  }, [removeResourcev1, triggerQuizUpdate])


  // Aggregates quizzes from ALL maps in the document, not just the active one.
  const selectAllQuizAssessmentsGlobal = useCallback((): QuizAssessmentResource[] => {
    const allQuizzes: QuizAssessmentResource[] = [];
    
    // 1. Iterate over the raw shared types in the YDoc
    // ydoc.share is a Map<string, AbstractType<any>>
    for (const [key, abstractType] of activeDoc.share.entries()) {
      
      // We only care about keys that start with "resources:"
      if (key.startsWith('resources:')) {

        // We first cast to 'unknown' to opt-out of the AbstractType check,
        // then cast to the specific Y.Map structure we know we used.
        const mapResources = abstractType as unknown as Y.Map<Y.Map<ResourceCard>>;
        
        // 2. Check for the sentinel node ID
        // Because Y.Map methods are available on the object, this is now type-safe
        if ( typeof mapResources.has === 'function' && mapResources.has(GLOBAL_ASSESSMENTS_NODE_ID)) {
           const assessmentMap = mapResources.get(GLOBAL_ASSESSMENTS_NODE_ID);
           
           if (assessmentMap) {
             // 3. Iterate the inner map to find quiz cards
             // We can use forEach or Array.from(values())
             assessmentMap.forEach((card) => {
               if (card.type === 'quizAssessment') {
                 allQuizzes.push(card as QuizAssessmentResource);
               }
             });
           }
        }
      }
    }
    const dep = assignQuizUpdateSignal; // needed dependency to update list when a new quiz is addedd to give responsive ux after quiz creation.
    
    // Sort by creation date (newest first usually, or oldest first)
    // Here we sort oldest to newest based on createdAt string
    return allQuizzes.sort((a, b) => 
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [activeDoc, assignQuizUpdateSignal]);



  /**
   * @function updateQuizContent
   * @description
   * This function provides an authoritative, transactional pathway to modify the internal 
   * question array of a Quiz resource. It determines the resource type (Practice vs Assessment), 
   * validates existence, and performs a deep update within a Yjs transaction. By utilizing 
   * the Delta Engine's record function, it ensures that mass edits or deletions within a 
   * quiz session can be reverted by the user. Complexity is O(1) for resource lookup and 
   * O(N) for state reconciliation, where N is the number of questions.
   */
  const updateQuizContent = useCallback(
    async (resourceId: string, updatedQuestions: IQuizQuestion[]) => {
      // 1. Guard: Block updates if the document is in read-only mode
      if (isReadOnly) {
        console.warn('[ResourceContext.tsx][9300] updateQuizContent blocked: Read-Only');
        return;
      }

      if (updatedQuestions.length === 0) {
        console.log('[ResourceContext.tsx][9310] Cascading delete triggered: Quiz array is empty');
        const cardToRemove = getResourceCard(resourceId);
        if (cardToRemove) {
          removeResourcev1(cardToRemove.nodeId, resourceId);
        }
        return;
      }

      // 2. Locate the existing card across all nodes (O(nodeCount * avgResourcesPerNode))
      let originalCard: ResourceCard | undefined = getResourceCard(resourceId);
      
      if (!originalCard) {
        console.error('[ResourceContext.tsx][9301] Update failed: Resource not found', { resourceId });
        return;
      }

      // 3. Create a deep clone for the "Next" state to avoid mutating references prematurely
      const updatedCard = JSON.parse(JSON.stringify(originalCard)) as ResourceCard;

      // 4. Target the correct internal array path based on resource type (UPDATE - 1.3)
      if (updatedCard.type === 'practiceSheet') {
        updatedCard.content.quizContent = updatedQuestions;
      } else if (updatedCard.type === 'quizAssessment') {
        updatedCard.binding.spec.quizContent = updatedQuestions;
      } else {
        console.warn('[ResourceContext.tsx][9304] Resource is not a quiz type', { type: updatedCard.type });
        return;
      }

      // 5. Define the Delta for the Undo/Redo engine
      const delta: Delta = {
        type: 'RESOURCE_EDIT',
        nodeId: originalCard.nodeId,
        cardId: resourceId,
        previous: originalCard,
        next: updatedCard,
      };

      // 6. Execute atomic Yjs transaction
      ydoc.transact(() => {
        record(
          delta,
          () => {
            // APPLY: Update local React state and Y.Map
            setResources((prev) => {
              const m = new Map(prev);
              const nodeArr = m.get(updatedCard.nodeId) || [];
              m.set(
                updatedCard.nodeId,
                nodeArr.map((c) => (c.id === resourceId ? updatedCard : c))
              );
              return m;
            });

            const yMap = yResourcesMap.get(updatedCard.nodeId);
            if (yMap) {
              yMap.set(resourceId, updatedCard);
              console.log('[ResourceContext.tsx][9302] Quiz update committed', { resourceId, count: updatedQuestions.length });
            }
          },
          () => {
            // REVERT: Restore the original card state
            setResources((prev) => {
              const m = new Map(prev);
              const nodeArr = m.get(originalCard!.nodeId) || [];
              m.set(
                originalCard!.nodeId,
                nodeArr.map((c) => (c.id === resourceId ? originalCard! : c))
              );
              return m;
            });

            yResourcesMap.get(originalCard!.nodeId)?.set(resourceId, originalCard!);
            console.log('[ResourceContext.tsx][9303] Quiz update reverted (Undo)');
          }
        );
      }, LOCAL_ORIGIN);
    },
    [isReadOnly, getResourceCard, ydoc, removeResourcev1, yResourcesMap]
  );



  /**
   * createFeedbackQuizCard
   * @description
   * This function provides a specialized, atomic pathway for Educators to create assigned quizzes 
   * that contain evidence-based feedback. It mirrors createQuizAssignmentCard by targeting the 
   * GLOBAL_ASSESSMENTS_NODE_ID, but extends the payload to include the topicMapping dictionary 
   * and preserves the explanation/citation fields generated by the AI.
   * @param args - Object containing assignment metadata, binding, and the token-to-UUID mapping.
   * @returns A promise resolving to the created enriched QuizAssessmentResource.
   */
  // UPDATE - 3.2: Implementation of the mirrored creation logic for feedback assignments
  const createFeedbackQuizCard = useCallback(async (args: {
    mapId: string;
    title: string;
    binding: QuizBinding;
    window?: { startAt?: string; endAt?: string };
    attemptLimit?: number;
    quizResultFeedback?: 'immediately' | 'after_close';
    instructions?: string;
    createdByEmail?: string;
  }): Promise<QuizAssessmentResource> => {
    // 1. Step 1: Security guard against unauthorized document modification
    if (isReadOnly) {
      console.warn('[ResourceContext.tsx][3040] createFeedbackQuizCard blocked: Read-Only');
      throw new Error('Read-only mode');
    }

    const usedMapId = args.mapId || activeConceptMapId;
    const dynamicMapKey = `resources:${usedMapId}`;
    const localYResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(dynamicMapKey);

    // 2. Step 2: Generate authoritative ID used for both Resource ID and Assignment ID
    const id = uuidv4();
    
    // 3. Step 3: Construct the enriched card mirroring the createQuizAssignmentCard structure
    const card: QuizAssessmentResource = {
      id,
      nodeId: GLOBAL_ASSESSMENTS_NODE_ID,
      type: 'quizAssessment',
      title: args.title,
      citations: null, // Remediation citations are embedded within question objects in the binding
      mapId: usedMapId,
      assignmentId: id,
      binding: {
        ...args.binding,
        spec: {
          ...args.binding.spec,
        }
      },
      window: args.window,
      attemptLimit: args.attemptLimit,
      quizResultFeedback: args.quizResultFeedback,
      instructions: args.instructions,
      createdByEmail: args.createdByEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const delta: Delta = { type: 'RESOURCE_ADD', nodeId: GLOBAL_ASSESSMENTS_NODE_ID, card };

    // 5. Step 5: Execute atomic transaction to sync Educator data to all invited Students
    ydoc.transact(() => {
      record(
        delta,
        () => {
          // APPLY: Synchronize local React state
          setResources((prev) => {
            const m = new Map(prev);
            const arr = m.get(GLOBAL_ASSESSMENTS_NODE_ID) || [];
            m.set(GLOBAL_ASSESSMENTS_NODE_ID, [...arr, card]);
            return m;
          });

          // APPLY: Synchronize Yjs Map for real-time collaboration
          let yMap = localYResourcesMap.get(GLOBAL_ASSESSMENTS_NODE_ID);
          if (!yMap) {
            yMap = new Y.Map<ResourceCard>();
            localYResourcesMap.set(GLOBAL_ASSESSMENTS_NODE_ID, yMap);
          }
          yMap.set(card.id, card);
          triggerQuizUpdate();
        },
        () => {
          // REVERT: Handle standard Undo/Redo logic
          setResources((prev) => {
            const m = new Map(prev);
            m.set(
              GLOBAL_ASSESSMENTS_NODE_ID,
              (m.get(GLOBAL_ASSESSMENTS_NODE_ID) || []).filter((c) => c.id !== card.id)
            );
            return m;
          });
          localYResourcesMap.get(GLOBAL_ASSESSMENTS_NODE_ID)?.delete(card.id);
        }
      );
    }, LOCAL_ORIGIN);

    console.log('[ResourceContext.tsx][3041] Enriched Feedback Assignment created:', id);
    return card;
  }, [isReadOnly, activeConceptMapId, ydoc, triggerQuizUpdate]);




  const value = useMemo<ResourceContextType>(
    () => ({
      resources,
      addResourcev1,
      removeResourcev1,
      editResourcev1,
      transferResource,
      selectResources: selectResourcesFn,
      selectNoteCards,
      selectCueCards,
      removeAssignedQuiz,
      selectPracticeSheets,
      setResources: setResourcesFn,
      resetResources,
      getResourceCard,
      undo,
      redo,
      restoreResource,
      getGlobalResourceCard,
      updatedRivisonCard,
      setupdatedRivisionCard,
      selectQuizAssessments,
      getQuizAssessmentById,
       createQuizAssignmentCard,
       selectAllQuizAssessmentsGlobal,
       assignQuizUpdateSignal,
       triggerQuizUpdate,
       updateQuizContent,
       createFeedbackQuizCard
    }),
    [resources, addResourcev1,createFeedbackQuizCard, removeResourcev1, editResourcev1, transferResource, selectResourcesFn, selectNoteCards, selectCueCards, removeAssignedQuiz, selectPracticeSheets, setResourcesFn, resetResources, getResourceCard, undo, redo, restoreResource, getGlobalResourceCard, updatedRivisonCard, selectQuizAssessments, getQuizAssessmentById, createQuizAssignmentCard, selectAllQuizAssessmentsGlobal, assignQuizUpdateSignal, triggerQuizUpdate, updateQuizContent]
  );

  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  );
};

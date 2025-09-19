/**
 * @file LessonModuleContext.tsx
 * @description
 *   This context is responsible for managing the lesson module state.
 *   It provides services for:
 *     - Retrieving the lesson module metadata (module title and list of concept maps).
 *     - Creating new concept maps (lessons) with a unique identifier and initializing a namespaced nodes map for each.
 *         Each new concept map automatically receives a default root node.
 *     - Updating and deleting concept maps.
 *     - Maintaining the active concept map selection.
 *     - Tracking the loading (generation) status of lesson modules.
 *
 *   New:
 *     - Maintains a set of module IDs that are currently being generated.
 *     - Exposes methods to add or remove a module from the loading set.
 *     - Exposes a derived boolean (isGeneratingLesson) indicating if any lesson module is loading.
 *
 *   Note: The lesson module title (i.e. file name) is managed by YDocContext.
 *         Any updates to the module title should be done via YDocContext’s API (updateFileName).
 *
 * @author  
 * @date    
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useYDoc } from './YDocContext';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import { ConceptNode, LOCAL_ORIGIN } from '@/app/Library/Definitions/Definitions';
import { useDeepMapMirror } from '@/app/studygraph/(studygraph)/components/utils/useDeepMapMirror';

export interface ConceptMap {
  id: string;
  title: string;
  createdAt: string;
  // New fields for additional lesson metadata:
  topic?: string;
  summary?: string;
}

export interface LessonModule {
  title: string;
  conceptMaps: ConceptMap[];
}

export interface LessonModuleContextType {
  activeConceptMapId: string;
  setActiveConceptMapId: (id: string) => void;
  getLessonModule: () => LessonModule;
  addConceptMap: (title: string, id: string) => { id: string; nodesMap: Y.Map<ConceptNode> };
  getExistingLessonModules: () => string[];
  updateConceptMapTitle: (conceptMapId: string, newTitle: string) => void;
  updateLessonModule: (moduleId: string, details: { topic?: string; summary?: string }) => void;
  deleteConceptMap: (conceptMapId: string) => void;
  isMapEmpty: (mapId: string) => boolean;
  getModuleSummary: (moduleId: string) => { hasSummary: boolean; summary: string | null };
  // New state: indicates if any lesson module is in the process of being generated.
  isGeneratingLesson: boolean;
  addLoadingLesson: (moduleId: string) => void;
  removeLoadingLesson: (moduleId: string) => void;
  setDefaultMap: () => void;
}

const LessonModuleContext = createContext<LessonModuleContextType | undefined>(undefined);

export const LessonModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { ydoc } = useYDoc();
  // Get the shared lesson module Y.Map from Y.Doc
  const lessonModuleYMap = ydoc.getMap('lessonModule');
  // Default active concept map is "map-1"
  const [activeConceptMapId, setActiveConceptMapId] = useState('map-1');

  // Reactive state for the lesson module.
  const [lessonModuleState, setLessonModuleState] = useState<LessonModule>(() => {
    const title = (lessonModuleYMap.get('title') as string) || 'Untitled Lesson Module';
    const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
    const conceptMaps: ConceptMap[] = conceptMapsYArray ? conceptMapsYArray.toArray() : [];
    return { title, conceptMaps };
  });

  // New state: Set of module IDs currently generating.
  const [loadingLessonModules, setLoadingLessonModules] = useState<Set<string>>(new Set());

  // Derived boolean: true if any lesson module is being generated.
  const isGeneratingLesson = loadingLessonModules.size > 0;

  // Methods to update the loading set.
  const addLoadingLesson = useCallback((moduleId: string) => {
    setLoadingLessonModules(prev => new Set(prev).add(moduleId));
  }, []);

  const removeLoadingLesson = useCallback((moduleId: string) => {
    setLoadingLessonModules(prev => {
      const updated = new Set(prev);
      updated.delete(moduleId);
      return updated;
    });
  }, []);

  // Reinitialize the reactive state whenever Y.Doc updates.
  useEffect(() => {
    const lessonModuleYMap = ydoc.getMap('lessonModule');
    const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
    if (!conceptMapsYArray) {
      setLessonModuleState({
        title: (lessonModuleYMap.get('title') as string) || 'Untitled Lesson Module',
        conceptMaps: [],
      });
      return;
    }
    const observer = () => {
      setLessonModuleState({
        title: (lessonModuleYMap.get('title') as string) || 'Untitled Lesson Module',
        conceptMaps: conceptMapsYArray.toArray(),
      });
    };
    conceptMapsYArray.observe(observer);
    lessonModuleYMap.observe(observer);
    observer();
    return () => {
      conceptMapsYArray.unobserve(observer);
      lessonModuleYMap.unobserve(observer);
    };
  }, [ydoc]);

  // Returns the current lesson module state.
  const getLessonModule = useCallback((): LessonModule => {
    return lessonModuleState;
  }, [lessonModuleState]);


  
  /**
   * @function readFromYDoc
   * @description
   *   Rebuilds the React snapshot of the lesson module directly from the Y.Doc. This projector reads
   *   the module title and the `conceptMaps` array (if present), falling back to safe defaults otherwise.
   *   It is intentionally side-effect free except for setting state. The function is designed to be used
   *   by the deep-observer initialization helper so cached bytes and live updates are always visible.
   *   Complexity is O(N) where N equals the number of concept maps; all map lookups are O(1).
   */
  const readFromYDoc = useCallback(() => { // update - 4
    const title = (lessonModuleYMap.get('title') as string) || 'Untitled Lesson Module';
    const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
    const conceptMaps: ConceptMap[] = conceptMapsYArray ? conceptMapsYArray.toArray() : [];
    setLessonModuleState({ title, conceptMaps });
    // [LessonModuleContext.tsx][6101]
    // eslint-disable-next-line no-console
    console.log('[LessonModuleContext.tsx][6101] readFromYDoc snapshot', { count: conceptMaps.length });
  }, [lessonModuleYMap]);

  // [update - 5] Adopt the NodesProvider-style init and subscription via reusable helper.
  useDeepMapMirror(lessonModuleYMap as Y.Map<any>, readFromYDoc); // update - 5


  /**
   * addConceptMap
   * Creates a new lesson module (concept map) with the given title.
   * If an id is provided, it will be used; otherwise, a new id is generated.
   * Initializes a namespaced nodes map with a default root node.
   *
   * @param title - The title for the new lesson module.
   * @param id - Optional externally provided module id.
   * @returns An object containing the id of the new lesson module and its nodes map.
   */
const addConceptMap = useCallback(
  (title: string, id?: string): { id: string; nodesMap: Y.Map<ConceptNode> } => {
    const newId = id || `map-${uuidv4()}`;
    let createdNodesMap!: Y.Map<ConceptNode>; // set inside transact

    ydoc.transact(() => {
      const newConceptMap: ConceptMap = {
        id: newId,
        title,
        createdAt: new Date().toISOString(),
      };

      // ensure conceptMaps array exists
      let conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any> | undefined;
      if (!(conceptMapsYArray instanceof Y.Array)) {
        conceptMapsYArray = new Y.Array();
        lessonModuleYMap.set('conceptMaps', conceptMapsYArray);
      }
      conceptMapsYArray.push([newConceptMap]);

      // namespaced nodes map for this concept map
      const nodesKey = `nodes:${newId}`;
      const nodesMap = ydoc.getMap<ConceptNode>(nodesKey);
      nodesMap.clear();

      const rootNode: ConceptNode = {
        id: 'node-1',
        title: 'Root Concept',
        parentNodeId: undefined,
        childrenNodeIds: [],
        x: 0,
        y: 0,
        isRoot: true,
        depth: 0,
      };
      nodesMap.set(rootNode.id, rootNode);

      createdNodesMap = nodesMap;
    }, LOCAL_ORIGIN);

    return { id: newId, nodesMap: createdNodesMap };
  },
  [lessonModuleYMap, ydoc]
);

  /**
   * getExistingLessonModules
   * Returns an array of all existing lesson module ids from the concept maps.
   */
  const getExistingLessonModules = useCallback((): string[] => {
    const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
    if (!conceptMapsYArray) return [];
    const maps = conceptMapsYArray.toArray() as ConceptMap[];
    return maps.map(cm => cm.id);
  }, [lessonModuleYMap]);

  /**
   * updateConceptMapTitle
   * Updates the title property of an existing concept map.
   *
   * @param conceptMapId - The id of the concept map to update.
   * @param newTitle - The new title.
   */
  const updateConceptMapTitle = useCallback((conceptMapId: string, newTitle: string) => {
    const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
    if (conceptMapsYArray) {
      const maps = conceptMapsYArray.toArray();
      const index = maps.findIndex((cm: any) => cm.id === conceptMapId);
      if (index !== -1) {
        const updatedMap = { ...maps[index], title: newTitle };
        conceptMapsYArray.delete(index, 1);
        conceptMapsYArray.insert(index, [updatedMap]);
      }
    }
  }, [lessonModuleYMap]);

  /**
   * updateLessonModule
   * Updates additional metadata (such as topic and summary) for the lesson module identified by moduleId.
   *
   * @param moduleId - The id of the lesson module to update.
   * @param details - An object containing metadata properties to update.
   */
  const updateLessonModule = useCallback((moduleId: string, details: { topic?: string; summary?: string }) => {
    const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
    if (conceptMapsYArray) {
      const maps = conceptMapsYArray.toArray();
      const index = maps.findIndex((cm: any) => cm.id === moduleId);
      if (index !== -1) {
        const updatedMap = { ...maps[index], ...details };
        conceptMapsYArray.delete(index, 1);
        conceptMapsYArray.insert(index, [updatedMap]);
      }
    }
  }, [lessonModuleYMap]);

  const deleteConceptMap = useCallback((conceptMapId: string) => {
    const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
    if (conceptMapsYArray) {
      const maps = conceptMapsYArray.toArray();
      const index = maps.findIndex((cm: any) => cm.id === conceptMapId);
      if (index !== -1) {
        conceptMapsYArray.delete(index, 1);
        // Clear the namespaced nodes map for the deleted lesson module.
        const nodesKey = `nodes:${conceptMapId}`;
        const nodesMap = ydoc.getMap(nodesKey);
        nodesMap.clear();
        if (activeConceptMapId === conceptMapId) {
          const newActive = maps[0]?.id || '';
          setActiveConceptMapId(newActive);
        }
      }
    }
  }, [lessonModuleYMap, ydoc, activeConceptMapId]);

  /**
   * isMapEmpty
   * Checks whether the lesson module (concept map) with the given id is empty.
   * An empty map is defined as having exactly one node (the default root node with id 'node-1')
   * and no resources in its corresponding resources map.
   *
   * @param mapId - The id of the lesson module to check.
   * @returns True if the map is empty; false otherwise.
   */
  const isMapEmpty = useCallback((mapId: string): boolean => {
    // Get the nodes map for the lesson module.
    const nodesKey = `nodes:${mapId}`;
    const nodesMap = ydoc.getMap(nodesKey);
    const isNodesEmpty = nodesMap.size === 1 && nodesMap.has('node-1');

    // Get the resources map for the lesson module.
    const resourcesKey = `resources:${mapId}`;
    const resourcesMap = ydoc.getMap(resourcesKey);
    const isResourcesEmpty = !resourcesMap || resourcesMap.size === 0;

    return isNodesEmpty && isResourcesEmpty;
  }, [ydoc]);

  /**
   * getModuleSummary
   * Retrieves the summary for a given lesson module (concept map) based on its moduleId.
   * It returns an object indicating whether a summary is present along with the summary text.
   *
   * @param moduleId - The id of the lesson module.
   * @returns An object with a boolean flag `hasSummary` and the summary text (or null if not present).
   */
  const getModuleSummary = useCallback((moduleId: string): { hasSummary: boolean; summary: string | null } => {
    const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
    if (!conceptMapsYArray) return { hasSummary: false, summary: null };
    const maps = conceptMapsYArray.toArray() as ConceptMap[];
    const Lmodule = maps.find(cm => cm.id === moduleId);
    if (Lmodule && Lmodule.summary && Lmodule.summary.trim().length > 0) {
      return { hasSummary: true, summary: Lmodule.summary.trim() };
    }
    return { hasSummary: false, summary: null };
  }, [lessonModuleYMap]);

  /**
   * Pick the first lesson from the *React* state array and activate it.
   * This now exactly matches what your navigation panel sees.
   */
const setDefaultMap = useCallback(() => {
  // Read directly from Y.Doc instead of React state
  const conceptMapsYArray = lessonModuleYMap.get('conceptMaps') as Y.Array<any>;
  const maps = conceptMapsYArray ? conceptMapsYArray.toArray() : [];
  const ids = maps.map((m: ConceptMap) => m.id);
  
  console.log('[LessonModule] setDefaultMap – maps from Y.Doc →', ids);
  if (ids.length > 0) {
    console.log('[LessonModule] setDefaultMap – activating →', ids[0]);
    setActiveConceptMapId(ids[0]);
  } else {
    console.log('[LessonModule] setDefaultMap – no maps found in Y.Doc');
  }
}, [lessonModuleYMap]);

  return (
    <LessonModuleContext.Provider
      value={{
        activeConceptMapId,
        setActiveConceptMapId,
        getLessonModule,
        addConceptMap,
        getExistingLessonModules,
        updateConceptMapTitle,
        updateLessonModule,
        deleteConceptMap,
        isMapEmpty,
        getModuleSummary,
        isGeneratingLesson,
        addLoadingLesson,
        removeLoadingLesson,
        setDefaultMap,
      }}
    >
      {children}
    </LessonModuleContext.Provider>
  );
};

export const useLessonModule = () => {
  const context = useContext(LessonModuleContext);
  if (!context) {
    throw new Error('useLessonModule must be used within a LessonModuleProvider');
  }
  return context;
};

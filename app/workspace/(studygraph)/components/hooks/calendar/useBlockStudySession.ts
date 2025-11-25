/**
 * @file useBlockStudySession.ts
 * @description
 *   Hook for generating ordered ResourceCard slides from lesson units using cross-file resource traversal
 *   patterns. This module extends the proven useLessonUnitOrder pattern to work with external lesson units
 *   and global resource lookups, enabling block session generation from multiple notebooks for calendar
 *   scheduling. The implementation handles concept node tree traversal, resource collection ordering
 *   (notes → pictures → cue cards → recurse children → quizzes), and proper sorting of primary node
 *   children based on lesson order properties. The hook integrates with existing global lookup functions
 *   from NodesContext and ResourceContext to maintain consistency with current resource management patterns.
 *   It supports the calendar system's requirement for generating study sessions from atomic lesson units
 *   while preserving the established slideshow content ordering and resource presentation standards used
 *   throughout BloomMap's learning interfaces.
 */

import { useCallback } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import type { ResourceCard, ConceptNode } from '@/app/Library/Definitions/Definitions';
import type { LessonUnit } from '@/app/Library/Definitions/CalendarDefinitions';
import * as Y from 'yjs';
import { useYDoc } from '@/app/Library/Context/YDocContext';

/**
 * Hook that generates ordered ResourceCard slides for a specific set of LessonUnits.
 * Based on useLessonUnitOrder logic but accepts external lesson units and mapIds,
 * enabling cross-file session generation for calendar scheduling system.
 */
export function useBlockStudySession() {
  const { getGlobalNode } = useNodesContext();
  const { getGlobalResourceCard } = useResourceContext();
  const { ydoc } = useYDoc();

  /**
   * Generates a complete block study session from an array of lesson units.
   * Each lesson unit is treated as a root for traversal, collecting all descendant
   * resources in proper order for an effective learning sequence.
   */
  const generateBlockSession = useCallback((lessonUnits: LessonUnit[]): ResourceCard[] => {
    console.log('[useBlockStudySession.ts][4001] › Generating block session for', lessonUnits.length, 'lesson units');
    
    if (!lessonUnits || lessonUnits.length === 0) {
      console.warn('[useBlockStudySession.ts][4002] › No lesson units provided for session generation');
      return [];
    }
    
    const result: ResourceCard[] = [];
    
    // Step 1: Process each lesson unit as a root node
    lessonUnits.forEach((unit, index) => {
      console.log('[useBlockStudySession.ts][4003] › Processing lesson unit', index + 1, ':', unit.conceptNodeTitle);
      
      // Step 2: Traverse from the primary concept node
      traverseUnit(
        unit.primaryConceptNodeID,
        result,
        unit.mapID,
        getGlobalNode,
        ydoc,
        unit.primaryConceptNodeID // Pass as root ID for proper sorting
      );
    });
    
    console.log('[useBlockStudySession.ts][4004] › Generated', result.length, 'total slides for block session');
    return result;
  }, [getGlobalNode, ydoc]);

  return { generateBlockSession };
}

/**
 * Traverses a concept node tree starting from nodeId, collecting resources in the
 * established order: notes → pictures → cue cards → recurse children → quizzes.
 * Handles proper sorting of primary node children based on lesson order property.
 */
function traverseUnit(
  nodeId: string,
  accumulator: ResourceCard[],
  mapId: string,
  getGlobalNode: (mapId: string, nodeId: string) => ConceptNode | undefined,
  ydoc: Y.Doc,
  rootId?: string
) {
  console.log('[useBlockStudySession.ts][4005] › Traversing node:', nodeId, 'in map:', mapId);
  
  // Step 1: Get the node from global context
  const node = getGlobalNode(mapId, nodeId);
  if (!node) {
    console.warn('[useBlockStudySession.ts][4006] › Node not found:', nodeId, 'in map:', mapId);
    return;
  }
  
  const title = node.title || 'Untitled';
  console.log('[useBlockStudySession.ts][4007] › Processing node:', title);
  
  // Step 2: Collect resources in order: Notes → Pictures → Cue Cards
  const notes = getNodeResources(mapId, nodeId, 'note', ydoc, title);
  const pictures = getNodeResources(mapId, nodeId, 'picture', ydoc, title);
  const cueCards = getNodeResources(mapId, nodeId, 'cueCard', ydoc, title);
  
  console.log('[useBlockStudySession.ts][4008] › Collected resources for', title, '- notes:', notes.length, 'pictures:', pictures.length, 'cues:', cueCards.length);
  
  accumulator.push(...notes, ...pictures, ...cueCards);
  
  // Step 3: Handle children recursion with sorting for primary nodes
  if (node.childrenNodeIds && node.childrenNodeIds.length > 0) {
    let childrenToProcess = [...node.childrenNodeIds];
    
    // Step 4: Sort children if this is the root (primary node level)
    if (nodeId === rootId) {
      console.log('[useBlockStudySession.ts][4009] › Sorting children for primary node:', title);
      
      childrenToProcess.sort((idA, idB) => {
        const nodeA = getGlobalNode(mapId, idA);
        const nodeB = getGlobalNode(mapId, idB);
        const orderA = (nodeA as any)?.lessonOrder || '';
        const orderB = (nodeB as any)?.lessonOrder || '';
        return orderA.localeCompare(orderB);
      });
    }
    
    // Step 5: Recurse into children
    childrenToProcess.forEach(childId => {
      traverseUnit(childId, accumulator, mapId, getGlobalNode, ydoc);
    });
  }
  
  // Step 6: Collect practice sheets (quizzes) after processing subtree
  const quizzes = getNodeResources(mapId, nodeId, 'practiceSheet', ydoc, title);
  console.log('[useBlockStudySession.ts][4010] › Collected', quizzes.length, 'quizzes for', title);
  accumulator.push(...quizzes);
}

/**
 * Helper function to collect resources of a specific type for a node by directly
 * accessing the Y.Doc resources map. Returns resources with conceptNodeTitle
 * property added for proper slideshow display formatting.
 */
function getNodeResources(
  mapId: string,
  nodeId: string,
  resourceType: 'note' | 'picture' | 'cueCard' | 'practiceSheet',
  ydoc: Y.Doc,
  conceptNodeTitle: string
): ResourceCard[] {
  console.log('[useBlockStudySession.ts][4011] › Getting', resourceType, 'resources for node:', nodeId);
  
  try {
    // Step 1: Access the resources map for this concept map
    const resourcesKey = `resources:${mapId}`;
    const outerResourcesMap = ydoc.getMap<Y.Map<ResourceCard>>(resourcesKey);
    
    if (!outerResourcesMap || !outerResourcesMap.has(nodeId)) {
      console.log('[useBlockStudySession.ts][4012] › No resources found for node:', nodeId);
      return [];
    }
    
    // Step 2: Get the inner resources map for this specific node
    const innerResourcesMap = outerResourcesMap.get(nodeId);
    if (!innerResourcesMap) {
      console.log('[useBlockStudySession.ts][4013] › No inner resources map for node:', nodeId);
      return [];
    }
    
    // Step 3: Filter resources by type and add concept node title
    const resources: ResourceCard[] = [];
    innerResourcesMap.forEach((resource, resourceId) => {
      if (resource.type === resourceType) {
        resources.push({
          ...resource,
          conceptNodeTitle
        });
      }
    });
    
    console.log('[useBlockStudySession.ts][4014] › Found', resources.length, resourceType, 'resources for', conceptNodeTitle);
    return resources;
    
  } catch (error) {
    console.error('[useBlockStudySession.ts][4015] › Error getting resources for node:', nodeId, error);
    return [];
  }
}
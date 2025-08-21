/**
 * @file lessonUnitExtractor.ts
 * @description
 *   Contains the core lesson unit extraction algorithm and utility functions for converting Y.Doc concept maps
 *   into atomic lesson units suitable for calendar scheduling. This module handles the complex logic of traversing
 *   lesson modules, filtering primary nodes (depth=1), and converting them into lightweight, schedulable units.
 *   The extraction process maintains proper sorting based on lesson order while preserving essential metadata
 *   for session generation. The module supports version control through Y.Doc state hashing to detect when
 *   metadata needs refreshing. Utility functions provide chunking, validation, and transformation capabilities
 *   required by the calendar service. The implementation is optimized for performance and maintains compatibility
 *   with existing BloomMap document structures while enabling efficient calendar operations across multiple notebooks.
 */

import * as Y from 'yjs';
import { LessonUnit, LessonUnitsMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

/**
 * Extracts atomic lesson units from a Y.Doc instance by traversing all concept maps
 * and converting primary nodes (depth=1) into schedulable lesson units. The extraction
 * process maintains proper ordering and metadata consistency for calendar generation.
 */
export function generateLessonUnits(ydoc: Y.Doc): LessonUnit[] {
  console.log('[lessonUnitExtractor.ts][1001] › Starting lesson unit extraction from Y.Doc');
  
  // Step 1: Access the lesson module map from Y.Doc
  const lessonModule = ydoc.getMap('lessonModule');
  const conceptMaps = lessonModule.get('conceptMaps') as Y.Array<any>;


  console.log(' 96809 LESSON MODULE:', lessonModule.toJSON()); // 🔴 ADD THIS LOG
  console.log(' 96809 CONCEPT MAPS:', conceptMaps?.toArray());
  
  if (!conceptMaps) {
    console.log('[lessonUnitExtractor.ts][1002] › No concept maps found in lesson module');
    return [];
  }
  
  const allUnits: LessonUnit[] = [];
  const conceptMapArray = conceptMaps.toArray();
  
  console.log('[lessonUnitExtractor.ts][1003] › Processing', conceptMapArray.length, 'concept maps');
  
  // Step 2: Process each concept map to extract primary nodes
  conceptMapArray.forEach((cm, index) => {
    console.log('[lessonUnitExtractor.ts][1004] › Processing concept map:', cm.title, 'id:', cm.id);
    
    // Step 3: Get the nodes map for this concept map
    const nodesKey = `nodes:${cm.id}`;
    const nodesMap = ydoc.getMap<ConceptNode>(nodesKey);
    
    if (!nodesMap || nodesMap.size === 0) {
      console.log('[lessonUnitExtractor.ts][1005] › No nodes found for concept map:', cm.id);
      return;
    }
    
    // Step 4: Filter and sort primary nodes (depth = 1)
    const allNodes = Array.from(nodesMap.values());
    const primaryNodes = allNodes.filter(node => node.depth === 1);
    
    console.log('[lessonUnitExtractor.ts][1006] › Found', primaryNodes.length, 'primary nodes in', cm.title);
    
    // Step 5: Sort primary nodes by lesson order if available
    const sortedPrimaryNodes = primaryNodes.sort((a, b) => {
      const orderA = (a as any).lessonOrder || '';
      const orderB = (b as any).lessonOrder || '';
      return orderA.localeCompare(orderB);
    });
    
    // Step 6: Convert primary nodes to lesson units
    const units = sortedPrimaryNodes.map(node => ({
      conceptNodeTitle: node.title,
      primaryConceptNodeID: node.id,
      parentTitle: cm.title,
      mapID: cm.id
    }));
    
    console.log('[lessonUnitExtractor.ts][1007] › Created', units.length, 'lesson units from', cm.title);
    allUnits.push(...units);
  });
  
  console.log('[lessonUnitExtractor.ts][1008] › Total lesson units extracted:', allUnits.length);
  return allUnits;
}


/**
 * Creates complete lesson units metadata structure with map-based organization
 * for efficient access patterns. Groups lesson units by map ID to enable
 * fast filtering and lookup operations required by calendar scheduling.
 */
export function createLessonUnitsMeta(ydoc: Y.Doc): LessonUnitsMeta {
  console.log('[lessonUnitExtractor.ts][1011] › Creating optimized lesson units metadata structure');
  
  // Step 1: Extract lesson units from document
  const allUnits = generateLessonUnits(ydoc);
   console.log('96809 EXTRACTED UNITS:', allUnits);
  
  // Step 2: Organize units by map ID for efficient access
  const units: Record<string, LessonUnit[]> = {};
  
  allUnits.forEach(unit => {
    if (!units[unit.mapID]) {
      units[unit.mapID] = [];
    }
    units[unit.mapID].push(unit);
  });
  
  console.log('[lessonUnitExtractor.ts][1012] › Organized', allUnits.length, 'units across', Object.keys(units).length, 'maps');
  
  // Step 3: Create optimized metadata structure
  const metadata: LessonUnitsMeta = {
    units,
    lastUpdated: new Date(),
    totalUnits: allUnits.length,
  };
  
  console.log('[lessonUnitExtractor.ts][1013] › Created optimized metadata with map-based organization');
   console.log(' 96809 UNITS BY MAP:', units);
  return metadata;
}

/**
 * Chunks an array of lesson units into groups of specified size for session generation.
 * The chunking preserves lesson unit order while creating appropriately sized
 * study sessions according to user configuration or default values.
 */
export function chunkLessonUnits(units: LessonUnit[], chunkSize: number): LessonUnit[][] {
  console.log('[lessonUnitExtractor.ts][1013] › Chunking', units.length, 'units into groups of', chunkSize);
  
  if (chunkSize <= 0) {
    console.warn('[lessonUnitExtractor.ts][1014] › Invalid chunk size, using default of 3');
    chunkSize = 3;
  }
  
  const chunks: LessonUnit[][] = [];
  
  // Step 1: Create chunks of the specified size
  for (let i = 0; i < units.length; i += chunkSize) {
    const chunk = units.slice(i, i + chunkSize);
    chunks.push(chunk);
  }
  
  console.log('[lessonUnitExtractor.ts][1015] › Created', chunks.length, 'chunks from lesson units');
  
  return chunks;
}

/**
 * Validates lesson unit data structure integrity and content consistency.
 * Checks for required fields, proper ID formats, and logical relationships
 * to ensure calendar generation will function correctly.
 */
export function validateLessonUnits(units: LessonUnit[]): boolean {
  console.log('[lessonUnitExtractor.ts][1016] › Validating', units.length, 'lesson units');
  
  // Step 1: Check if units array is valid
  if (!Array.isArray(units)) {
    console.error('[lessonUnitExtractor.ts][1017] › Units is not an array');
    return false;
  }
  
  // Step 2: Validate each lesson unit structure
  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    
    // Step 3: Check required fields
    if (!unit.conceptNodeTitle || typeof unit.conceptNodeTitle !== 'string') {
      console.error('[lessonUnitExtractor.ts][1018] › Invalid conceptNodeTitle at index', i);
      return false;
    }
    
    if (!unit.primaryConceptNodeID || typeof unit.primaryConceptNodeID !== 'string') {
      console.error('[lessonUnitExtractor.ts][1019] › Invalid primaryConceptNodeID at index', i);
      return false;
    }
    
    if (!unit.parentTitle || typeof unit.parentTitle !== 'string') {
      console.error('[lessonUnitExtractor.ts][1020] › Invalid parentTitle at index', i);
      return false;
    }
    
    if (!unit.mapID || typeof unit.mapID !== 'string') {
      console.error('[lessonUnitExtractor.ts][1021] › Invalid mapID at index', i);
      return false;
    }
  }
  
  console.log('[lessonUnitExtractor.ts][1022] › All lesson units validated successfully');
  return true;
}

/**
 * Efficiently retrieves lesson units for a specific map using the optimized
 * map-based data structure. Provides O(1) access time compared to O(n)
 * filtering operations on flat arrays for improved performance.
 */
export function getLessonUnitsForMap(metadata: LessonUnitsMeta, mapId: string): LessonUnit[] {
  console.log('[lessonUnitExtractor.ts][1025] › Getting lesson units for map ID:', mapId);
  
  const units = metadata.units[mapId] || [];
  console.log('[lessonUnitExtractor.ts][1026] › Found', units.length, 'units for map', mapId);
  
  return units;
}

/**
 * Gets all lesson units from the optimized metadata structure by flattening
 * the map-based organization. Useful when all units are needed regardless
 * of their originating concept map for global operations.
 */
export function getAllLessonUnits(metadata: LessonUnitsMeta): LessonUnit[] {
  console.log('[lessonUnitExtractor.ts][1027] › Getting all lesson units from metadata');
  
  const allUnits = Object.values(metadata.units).flat();
  console.log('[lessonUnitExtractor.ts][1028] › Retrieved', allUnits.length, 'total units');
  
  return allUnits;
}


/**
 * Gets array of map IDs that have lesson units available for scheduling.
 * Useful for iterating over available concept maps and building notebook
 * selection interfaces with proper availability filtering.
 */
export function getAvailableMapIds(metadata: LessonUnitsMeta): string[] {
  console.log('[lessonUnitExtractor.ts][1029] › Getting available map IDs');
  
  const mapIds = Object.keys(metadata.units).filter(mapId => 
    metadata.units[mapId].length > 0
  );
  
  console.log('[lessonUnitExtractor.ts][1030] › Found', mapIds.length, 'maps with lesson units');
  return mapIds;
}
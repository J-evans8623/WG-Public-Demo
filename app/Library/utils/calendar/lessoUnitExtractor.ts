/**
 * @file lessonUnitExtractor.ts
 * @description
 *   This module converts BloomMap Y.Doc concept maps into atomic lesson units and provides utility
 *   functions used by the calendar scheduler. In this sprint’s migration we add a strict, deterministic
 *   grouping helper `groupByLesson` that organizes a notebook’s flat `LessonUnit[]` into a stable
 *   per-lesson (per mapID) dictionary. The grouping preserves a reproducible order by sorting
 *   lesson keys and leaves unit order intact inside each lesson. This enables the learning-set
 *   scheduler to chunk content strictly within lessons (never across), build LB queues, and mirror
 *   RB sessions per block. The functions in this file are pure, free of side effects, and only return
 *   serializable data structures, which keeps them safe to use in append-only planning and makes
 *   testing simpler. Purposeful logs mark the start and end of expensive operations for observability.
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
  const lessonModule = ydoc.getMap('lessonModule');
  const conceptMaps = lessonModule.get('conceptMaps') as Y.Array<any>;

  console.log('[lessonUnitExtractor.ts][9681] › LESSON MODULE(JSON):', lessonModule?.toJSON());
  console.log('[lessonUnitExtractor.ts][9682] › CONCEPT MAPS(len):', conceptMaps?.length || 0);

  if (!conceptMaps) {
    console.log('[lessonUnitExtractor.ts][1002] › No concept maps found in lesson module');
    return [];
  }

  const allUnits: LessonUnit[] = [];
  const conceptMapArray = conceptMaps.toArray();

  console.log('[lessonUnitExtractor.ts][1003] › Processing', conceptMapArray.length, 'concept maps');

  conceptMapArray.forEach((cm) => {
    console.log('[lessonUnitExtractor.ts][1004] › Processing map:', cm.title, 'id:', cm.id);
    const nodesKey = `nodes:${cm.id}`;
    const nodesMap = ydoc.getMap<ConceptNode>(nodesKey);

    if (!nodesMap || nodesMap.size === 0) {
      console.log('[lessonUnitExtractor.ts][1005] › No nodes for map:', cm.id);
      return;
    }

    const allNodes = Array.from(nodesMap.values());
    const primary = allNodes.filter((n) => n.depth === 1);
    console.log('[lessonUnitExtractor.ts][1006] › Primary nodes found:', primary.length);

    const sortedPrimary = primary.sort((a, b) => {
      const oa = (a as any).lessonOrder || '';
      const ob = (b as any).lessonOrder || '';
      return oa.localeCompare(ob);
    });

    const units = sortedPrimary.map((node) => ({
      conceptNodeTitle: node.title,
      primaryConceptNodeID: node.id,
      parentTitle: cm.title,
      mapID: cm.id,
      LessonOrder: Number(node.lessonOrder!),
    }));

    console.log('[lessonUnitExtractor.ts][1007] › Units created for map:', units.length);
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
  const allUnits = generateLessonUnits(ydoc);
  console.log('[lessonUnitExtractor.ts][9683] › Units extracted (count):', allUnits.length);

  const units: Record<string, LessonUnit[]> = {};
  allUnits.forEach((u) => {
    if (!units[u.mapID]) units[u.mapID] = [];
    units[u.mapID].push(u);
  });

  console.log('[lessonUnitExtractor.ts][1012] › Organized', allUnits.length, 'units across', Object.keys(units).length, 'maps');
  return { units, lastUpdated: new Date(), totalUnits: allUnits.length };
}

/**
 * Chunks an array of lesson units into groups of specified size for session generation.
 * The chunking preserves lesson unit order while creating appropriately sized sessions.
 */
export function chunkLessonUnits(units: LessonUnit[], chunkSize: number): LessonUnit[][] {
  console.log('[lessonUnitExtractor.ts][1013] › Chunking', units.length, 'units into size', chunkSize);
  const size = Math.max(1, chunkSize);
  const chunks: LessonUnit[][] = [];
  for (let i = 0; i < units.length; i += size) chunks.push(units.slice(i, i + size));
  console.log('[lessonUnitExtractor.ts][1015] › Created', chunks.length, 'chunks');
  return chunks;
}

/**
 * Validates lesson unit data structure integrity and content consistency.
 */
export function validateLessonUnits(units: LessonUnit[]): boolean {
  console.log('[lessonUnitExtractor.ts][1016] › Validating', units.length, 'lesson units');
  if (!Array.isArray(units)) {
    console.error('[lessonUnitExtractor.ts][1017] › Units is not an array');
    return false;
  }
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u.conceptNodeTitle || !u.primaryConceptNodeID || !u.parentTitle || !u.mapID) {
      console.error('[lessonUnitExtractor.ts][1018] › Invalid unit at index', i);
      return false;
    }
  }
  console.log('[lessonUnitExtractor.ts][1022] › Validation OK');
  return true;
}

/**
 * Efficiently retrieves lesson units for a specific map using the optimized structure.
 */
export function getLessonUnitsForMap(metadata: LessonUnitsMeta, mapId: string): LessonUnit[] {
  console.log('[lessonUnitExtractor.ts][1025] › Get units for map:', mapId);
  return metadata.units[mapId] || [];
}

/**
 * Flattens all units from metadata into one array.
 */
export function getAllLessonUnits(metadata: LessonUnitsMeta): LessonUnit[] {
  console.log('[lessonUnitExtractor.ts][1027] › Flattening all lesson units');
  return Object.values(metadata.units).flat();
}

/**
 * Gets array of map IDs that have lesson units available for scheduling.
 */
export function getAvailableMapIds(metadata: LessonUnitsMeta): string[] {
  console.log('[lessonUnitExtractor.ts][1029] › Listing available map IDs');
  return Object.keys(metadata.units).filter((id) => metadata.units[id].length > 0);
}

/**
 * Groups a flat array of lesson units by lesson (mapID) with a stable, deterministic order.
 * 1) Units are grouped by their mapID.
 * 2) Lesson keys are sorted alphabetically to make the scheduler deterministic.
 * 3) Original order is preserved within each lesson to respect authoring order.
 */
export function groupByLesson(units: LessonUnit[]): Record<string, LessonUnit[]> {
  console.log('[lessonUnitExtractor.ts][1041] › Grouping units by lesson (mapID). count:', units.length);
  const tmp: Record<string, LessonUnit[]> = {};
  for (const u of units) {
    if (!tmp[u.mapID]) tmp[u.mapID] = [];
    tmp[u.mapID].push(u);
  }
  const sortedKeys = Object.keys(tmp).sort();
  const grouped: Record<string, LessonUnit[]> = {};
  for (const key of sortedKeys) grouped[key] = tmp[key];
  console.log('[lessonUnitExtractor.ts][1042] › Grouped into lessons:', sortedKeys.length);
  return grouped;
}

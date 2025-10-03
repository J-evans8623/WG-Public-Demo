// bloom-maps/app/src/services/calendar/NotebooksApi.ts

/**
 * @file NotebooksApi.ts
 * @description
 * [Responsibility & Scope]
 * This module provides a tiny, production-ready network client dedicated to notebook-related
 * operations used by the calendar and study plan features. Its responsibility is intentionally
 * narrow: issue HTTP requests to backend endpoints, validate basic response shapes, and map
 * raw payloads into the strongly-typed UI models consumed by the app. This keeps React context
 * files free of fetch logic and simplifies testing (mock this class instead of wiring global
 * fetch). The design emphasizes: (1) zero caching (caller decides), (2) clear errors with
 * useful metadata for observability, and (3) O(N) transformations without hidden side effects.
 * The module currently exposes two methods: `list()` returns `NotebookSummary[]` for selectors,
 * and `details(fileIds)` returns `NotebookMeta[]` with full lesson unit arrays for scheduling.
 * Each public call logs start/success/failure with a unique tag so production logs are actionable.
 * Time complexity: List and detail requests are O(N) for mapping and filtering returned items.
 */

import type { NotebookSummary, NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';


type OwnedFile = {
  fileId: string;
  fileName: string;
  updatedAt: string;
  lessonUnitsMeta?: {
    totalUnits?: number;
    unitsByMap?: Record<string, unknown[]>;
  };
};

interface LessonUnit {
  /** Display title of the primary concept node */
  conceptNodeTitle: string;
  /** Unique identifier of the primary concept node within its map */
  primaryConceptNodeID: string;
  /** Title of the parent notebook/lesson containing this unit */
  parentTitle: string;
  /** Concept map identifier where this lesson unit originates */
  mapID: string;
  LessonOrder:number;
}

type NotebookDetailsWire = {
  fileId: string;
  filePath: string;
  fileName: string;
  lastUpdated: string;
  lessonUnits: LessonUnit[];
  version?: string;
  color?: string;
};

export class NotebooksApi {
  /**
   * @function list
   * @description
   * 1) Fetches the user's owned files from /api/files/list (credentials included).
   * 2) Computes total unit counts from either `totalUnits` or by summing array lengths within `unitsByMap`.
   * 3) Maps to `NotebookSummary[]`, filters out notebooks with zero units, and returns.
   * 4) Logs entry, total count, and errors with unique codes for troubleshooting.
   * Time complexity is O(N + U) where N = files, U = accumulated units traversal.
   */
  public async list(): Promise<NotebookSummary[]> {
    const loc = 'NotebooksApi.ts[7001]';
    // Step 1: Request list
    console.log(`[${loc}] list() begin`);
    const res = await fetch('/api/files/list', { method: 'GET', credentials: 'include' });
    if (!res.ok) {
      console.error(`[${loc}] list() http_error status=${res.status}`);
      throw new Error(`NotebooksApi.list failed: ${res.status}`);
    }

    // Step 2: Parse
    const body = await res.json();
    const ownedFiles: OwnedFile[] = Array.isArray(body?.ownedFiles) ? body.ownedFiles : [];
    console.log(`[${loc}] list() fetched files=${ownedFiles.length}`);

    // Step 3: Compute units with fallbacks (O(N + U))
    const calcUnits = (meta?: OwnedFile['lessonUnitsMeta']): number => {
      if (!meta) return 0;
      if (typeof meta.totalUnits === 'number') return meta.totalUnits;
      if (meta.unitsByMap && typeof meta.unitsByMap === 'object') {
        let total = 0;
        for (const arr of Object.values(meta.unitsByMap)) {
          if (Array.isArray(arr)) total += arr.length;
        }
        return total;
      }
      return 0;
    };

    // Step 4: Map → summaries; filter zero-unit notebooks
    const summaries: NotebookSummary[] = ownedFiles
      .map((f) => ({
        fileId: f.fileId,
        fileName: f.fileName,
        totalUnits: calcUnits(f.lessonUnitsMeta),
        lastUpdated: new Date(f.updatedAt),
        hasLessonMeta: !!f.lessonUnitsMeta,
      }))
      .filter((n) => n.totalUnits > 0);

    console.log(`[${loc}] list() success notebooks=${summaries.length}`);
    return summaries;
  }

/**
   * @function details
   * @description
   * 1) POST `fileIds` to /api/calendar/notebook-details for complete metadata.
   * 2) Validate and narrow response to strong types.
   * 3) Map to `NotebookMeta[]`, including `color` passthrough for UI consistency.
   *    // update - 2
   */
  public async details(fileIds: string[]): Promise<NotebookMeta[]> {
    const loc = 'NotebooksApi.ts[7002]';
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      console.log(`[${loc}] details() empty_ids; returning []`);
      return [];
    }

    console.log(`[${loc}] details() begin ids=${fileIds.length}`);
    const res = await fetch('/api/calendar/notebook-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ fileIds }),
    });

    if (!res.ok) {
      console.error(`[${loc}] details() http_error status=${res.status}`);
      throw new Error(`NotebooksApi.details failed: ${res.status}`);
    }

    const body = await res.json();
    const notebooks: NotebookDetailsWire[] = Array.isArray(body?.notebooks) ? body.notebooks : [];
    console.log(`[${loc}] details() fetched notebooks=${notebooks.length}`);

    const mapped: NotebookMeta[] = notebooks
      .filter((nb) => Array.isArray(nb.lessonUnits) && nb.lessonUnits.length > 0)
      .map((nb) => ({
        fileId: nb.fileId,
        filePath: nb.filePath,
        fileName: nb.fileName,
        lessonUnits: nb.lessonUnits,
        lastUpdated: new Date(nb.lastUpdated),
        version: nb.version ?? 'unknown',
        color: nb.color ?? '#3B82F6', // default color if backend omitted
      }));

    console.log(`[${loc}] details() success valid=${mapped.length}`);
    return mapped;
  }
}

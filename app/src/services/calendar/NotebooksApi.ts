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
import { supersedingCall } from '../../net/SupersedingCaller';
import { getFileListCache } from '@/app/workspace/(studygraph)/services/fileListCache';

const NOTEBOOKS_LIST_LANE = 'files:list:notebooks';

type OwnedFile = {
  fileId: string;
  fileName: string;
  updatedAt: string;
  lessonUnitsMeta?: {
    totalUnits?: number;
    unitsByMap?: Record<string, unknown[]>;
  };
  colorCode:string
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
  colorCode: string;
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
  console.log(`[${loc}] list() begin (via SupersedingCaller)`);

  const makeRequest = async (signal: AbortSignal): Promise<Response> => {
    return fetch('/api/files/list', { method: 'GET', credentials: 'include', signal });
  };

  const resp = await supersedingCall(NOTEBOOKS_LIST_LANE, /*payload*/ null, makeRequest);

  if (!resp) {
    // deferred (429) or superseded by a newer list()
    const err: any = new Error('LIST_DEFERRED');
    err.deferred = true;
    console.log(`[${loc}] list() deferred/superseded; upstream should tolerate this.`);
    throw err;
  }

  if (!resp.ok) {
    console.error(`[${loc}] list() http_error status=${resp.status}`);
    throw new Error(`NotebooksApi.list failed: ${resp.status}`);
  }

  const body = await resp.json();
  const ownedFiles: OwnedFile[] = Array.isArray(body?.ownedFiles) ? body.ownedFiles : [];
  console.log(`[${loc}] list() fetched files=${ownedFiles.length}`);

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

  const summaries: NotebookSummary[] = ownedFiles
    .map((f) => ({
      fileId: f.fileId,
      fileName: f.fileName,
      totalUnits: calcUnits(f.lessonUnitsMeta),
      lastUpdated: new Date(f.updatedAt),
      hasLessonMeta: !!f.lessonUnitsMeta,
      colorCode: f.colorCode,
    }))
    .filter((n) => n.totalUnits > 0);

  console.log(`[${loc}] list() success notebooks=${summaries.length}`);
  return summaries;
}


/**
   * @function details
   * @description
   * Retrieves detailed metadata (including lesson units) for specific notebooks.
   * * UPDATE: Implements Cache-First logic.
   * 1. Checks `fileListCache` using `userEmail`.
   * 2. If a requested file exists in cache AND has `lessonUnitsMeta`, use it.
   * 3. Only fetch IDs that are missing from cache or missing lesson data.
   * 4. Merge results and return.
   */
  public async details(fileIds: string[], userEmail?: string): Promise<NotebookMeta[]> { // update - 2
    const loc = 'NotebooksApi.ts[7002]';
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(fileIds));
    const result: NotebookMeta[] = [];
    const missingIds: string[] = [];

    // Step 1: Try Cache (if userEmail provided)
    if (userEmail) {
      try {
        const cache = getFileListCache(userEmail);
        if (cache) {
          const allCached = [...cache.ownedFiles, ...cache.sharedFiles];
          console.log(`NotebooksAPI read the following from the cache ${JSON.stringify(allCached)}`)
          
          for (const id of uniqueIds) {
            const hit = allCached.find(f => f.fileId === id);
            
            // We only use the cache if it actually has the lesson units we need
            if (hit && hit.lessonUnitsMeta && hit.lessonUnitsMeta.units) {
              // Convert UserFileMetadata (Cache) -> NotebookMeta (Service)
              const unitsFlat = Object.values(hit.lessonUnitsMeta.units).flat() as any[];
              
              result.push({
                fileId: hit.fileId,
                filePath: hit.fileStoragePath,
                fileName: hit.fileName,
                colorCode: hit.colorCode || '#3B82F6',
                version: String(hit.version),
                lastUpdated: new Date(hit.updatedAt),
                lessonUnits: unitsFlat,
              });
              console.log(`[${loc}] Cache HIT for ${hit.fileName} (${unitsFlat.length} units)`);
            } else {
              missingIds.push(id);
            }
          }
        } else {
          missingIds.push(...uniqueIds);
        }
      } catch (e) {
        console.warn(`[${loc}] Cache read error`, e);
        missingIds.push(...uniqueIds);
      }
    } else {
      missingIds.push(...uniqueIds);
    }

    // Step 2: Fetch missing items from Network
    if (missingIds.length > 0) {
      console.log(`[${loc}] details() fetching missing ids=${missingIds.length}`);
      const res = await fetch('/api/calendar/notebook-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileIds: missingIds }),
      });

      if (!res.ok) {
        console.error(`[${loc}] details() http_error status=${res.status}`);
        throw new Error(`NotebooksApi.details failed: ${res.status}`);
      }

      const body = await res.json();
      const notebooks: NotebookDetailsWire[] = Array.isArray(body?.notebooks) ? body.notebooks : [];
      
      const mapped: NotebookMeta[] = notebooks
        .filter((nb) => Array.isArray(nb.lessonUnits) && nb.lessonUnits.length > 0)
        .map((nb) => ({
          fileId: nb.fileId,
          filePath: nb.filePath,
          fileName: nb.fileName,
          lessonUnits: nb.lessonUnits,
          lastUpdated: new Date(nb.lastUpdated),
          version: nb.version ?? 'unknown',
          colorCode: nb.colorCode ?? '#3B82F6',
        }));
      
      result.push(...mapped);
    }

    console.log(`[${loc}] details() success total=${result.length} (cached=${result.length - missingIds.length})`);
    return result;
  }

}

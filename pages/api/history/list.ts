/***********************************************************************************************
 * @file pages/api/history/list.ts
 * @description
 *   GET /api/history/list returns snapshot metadata for a document. It supports:
 *   (a) default mode: list snapshots (optionally filtered by `mapId`) ordered by `ts` desc,
 *   and (b) “deleted” mode: the most recent snapshot per map that is no longer in the live set.
 *   In Phase 2 this handler was refactored to use the VersionHistoryFB adapter for Firestore
 *   reads and to apply the NP rate-limit wrapper. Grouping and “deleted” semantics remain in
 *   the endpoint, keeping the adapter single-responsibility. Logs mark major decision points.
 *
 * Responsibilities:
 *   1) Authenticate requests via NextAuth.
 *   2) Parse and validate `docId`, optional `mapId`, optional `mode`, and `liveMapIds` in deleted mode.
 *   3) Use adapter list calls to fetch raw metadata.
 *   4) In deleted mode, group by mapId, pick latest by timestamp, exclude live IDs, and sort desc.
 *   5) Return JSON or appropriate error codes with useful diagnostics.
 ***********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { listSnapshots, listAllSnapshots, SnapshotMeta as AdapterSnapshotMeta } from'@/app/src/services/calendar/versionhistory/VersionHistoryFb';
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP';

interface SnapshotMeta {
  snapshotId: string;
  mapId: string;
  ts: string;
  title: string;
  author: string;
  size: number;
  path: string;
}

/**
 * @function handler
 * @description
 *   Lists version-history snapshots in two modes. Default mode returns all snapshots (optionally
 *   filtered by `mapId`) sorted by timestamp desc. Deleted mode returns one latest snapshot per
 *   deleted map (i.e., not present in `liveMapIds`). All Firestore reads are delegated to the
 *   adapter for testability and separation of concerns. Complexity is O(N) over retrieved rows.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) { // update - 3
  if (req.method !== 'GET') {
    console.log('list.ts 2001 › Invalid method:', req.method);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('list.ts 2002 › Unauthenticated request');
    return;
  }

  const docId = Array.isArray(req.query.docId) ? req.query.docId[0] : req.query.docId;
  const mapId = Array.isArray(req.query.mapId) ? req.query.mapId[0] : req.query.mapId;
  const mode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;
  const isDeletedMode = mode === 'deleted';
  console.log('list.ts 2003 › Parameters parsed', { docId, mapId, mode });

  if (!docId) {
    console.log('list.ts 2004 › Missing docId');
    return res.status(400).json({ error: 'Missing docId query parameter' });
  }

  // update - 4: robustly normalize liveMapIds (supports array or comma-delimited string)
  let liveMapIds: string[] = [];
  if (isDeletedMode) {
    const raw = req.query.liveMapIds;
    if (!raw) {
      console.log('list.ts 2005 › Missing liveMapIds for deleted mode');
      return res.status(400).json({ error: 'Missing liveMapIds query parameters for deleted mode' });
    }
    const arr = Array.isArray(raw) ? raw : [raw];
    liveMapIds = arr.flatMap(s => (s || '').split(',')).map(s => s.trim()).filter(Boolean);
    console.log('list.ts 2006 › liveMapIds received', liveMapIds);
  }

  try {
    // update - 5: use adapter for reads
    if (!isDeletedMode) {
      if (mapId) {
        console.log('list.ts 2007 › Fetching snapshots filtered by mapId');
        const rows = await listSnapshots(docId, { mapId });
        const snapshots: SnapshotMeta[] = rows.map(toPublicMeta);
        console.log('list.ts 2008 › Retrieved', snapshots.length, 'snapshots');
        return res.status(200).json({ snapshots });
      }

      // default mode with no mapId: return all snapshots sorted by ts desc
      const all = await listAllSnapshots(docId);
      const snapshots = all
        .slice()
        .sort((a, b) => b.ts.localeCompare(a.ts))
        .map(toPublicMeta);
      console.log('list.ts 2014 › Retrieved all snapshots (no filter)', { count: snapshots.length });
      return res.status(200).json({ snapshots });
    }

    // deleted mode: fetch all, group, pick latest per map, exclude live, sort desc
    const allSnaps: AdapterSnapshotMeta[] = await listAllSnapshots(docId);
    console.log('list.ts 2009 › Fetched all snapshots for deleted-mode grouping', { total: allSnaps.length });

    const latestByMap = new Map<string, AdapterSnapshotMeta>();
    for (const s of allSnaps) {
      const key = s.mapId || '';
      const existing = latestByMap.get(key);
      if (!existing || s.ts > existing.ts) latestByMap.set(key, s);
    }
    console.log('list.ts 2010 › Grouped snapshots, maps found=', latestByMap.size);

    const deletedSnapshots = Array.from(latestByMap.values())
      .filter(s => !!s.mapId && !liveMapIds.includes(s.mapId!))
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .map(toPublicMeta);

    console.log('list.ts 2011 › After excluding live maps, deleted count=', deletedSnapshots.length);
    console.log('list.ts 2012 › Deleted snapshots sorted, ready to return');

    return res.status(200).json({ snapshots: deletedSnapshots });
  } catch (err) {
    console.error('list.ts 2013 › Error querying snapshots:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// update - 6
function toPublicMeta(m: AdapterSnapshotMeta): SnapshotMeta {
  return {
    snapshotId: m.snapshotId,
    mapId: m.mapId || '',
    ts: m.ts,
    title: m.title || '',
    author: m.author,
    size: m.size,
    path: m.path,
  };
}

// update - 7: apply NP rate-limit wrapper for list scope
export default withRateLimitNP('np:vhList')(handler);

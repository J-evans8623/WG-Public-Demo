// File: pages/api/history/list.ts

/***********************************************************************************************
 * @file pages/api/history/list.ts
 * @description
 *   This file implements the GET /api/history/list endpoint for the Bloom-Maps Version-History
 *   service. It supports two modes of operation: the default mode returns all snapshots
 *   (optionally filtered by a specific mapId), and the new “deleted” mode which returns
 *   exactly one (the most recent) snapshot per map that is no longer live in the document.
 *   To determine liveness, the client must supply the current live map IDs as `liveMapIds`
 *   query parameters. In “deleted” mode, the handler fetches all snapshots for the document,
 *   groups them by mapId, picks each group’s latest snapshot by timestamp, excludes any
 *   mapId present in the supplied liveMapIds array, and returns the remainder sorted by
 *   descending timestamp. This file handles authentication, parameter validation, Firestore
 *   queries, grouping logic, and error handling. Purposeful console.log statements with
 *   unique 4-digit codes facilitate observability for each major step.
 *
 * Responsibilities:
 *   • Authenticate incoming requests via NextAuth.
 *   • Parse and validate `docId`, optional `mapId`, `mode`, and `liveMapIds` parameters.
 *   • In default mode:
 *     – Query and return snapshots filtered by `mapId` (if provided), ordered by timestamp.
 *   • In deleted mode:
 *     – Require `liveMapIds` parameters to identify maps still present.
 *     – Query all snapshots for the document.
 *     – Group snapshots by mapId in memory.
 *     – Select the most recent snapshot per map.
 *     – Exclude any mapId in the liveMapIds list.
 *     – Return the remaining snapshots sorted by descending timestamp.
 *   • Emit structured console logs with unique 4-digit codes for traceability.
 *   • Respond with JSON or proper HTTP error codes on failure.
 ***********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { firestore } from '@/app/src/services/firebase';

interface SnapshotMeta {
  snapshotId: string;
  mapId: string;
  ts: string;
  title:string;
  author: string;
  size: number;
  path: string;
}

/**
 * @function handler
 * @description
 *   Handles authenticated GET requests to list version-history snapshots. Supports two modes:
 *   default mode returns all snapshots (optionally filtered by mapId) ordered by descending
 *   timestamp; deleted mode returns exactly one snapshot per deleted map (most recent),
 *   excluding any maps whose IDs are provided as liveMapIds. Responds with JSON or appropriate
 *   HTTP error statuses. Ensures robust observability via console.log at key flow points.
 * @param req Next.js API request object
 * @param res Next.js API response object
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    console.log('list.ts 2001 › Invalid method:', req.method);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Authenticate the request
  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('list.ts 2002 › Unauthenticated request');
    return; // authenticateRequest has already responded
  }

  // Parse and validate required parameters
  const docId = Array.isArray(req.query.docId) ? req.query.docId[0] : req.query.docId;
  const mapId = Array.isArray(req.query.mapId) ? req.query.mapId[0] : req.query.mapId;
  const mode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;
  const isDeletedMode = mode === 'deleted';
  console.log('list.ts 2003 › Parameters parsed', { docId, mapId, mode });

  if (!docId) {
    console.log('list.ts 2004 › Missing docId');
    return res.status(400).json({ error: 'Missing docId query parameter' });
  }

  // In deleted mode, require liveMapIds array
  let liveMapIds: string[] = [];
  if (isDeletedMode) {
    const raw = req.query.liveMapIds;
    if (!raw) {
      console.log('list.ts 2005 › Missing liveMapIds for deleted mode');
      return res.status(400).json({ error: 'Missing liveMapIds query parameters for deleted mode' });
    }
    liveMapIds = Array.isArray(raw) ? raw : [raw];
    console.log('list.ts 2006 › liveMapIds received', liveMapIds);
  }

  try {
    // Reference to snapshots sub-collection
    const snapsCol = firestore.collection('documents').doc(docId).collection('snapshots');
    let snapDocs;

    if (!isDeletedMode && mapId) {
      // Default mode: filter by mapId if provided
      console.log('list.ts 2007 › Fetching snapshots filtered by mapId');
      snapDocs = await snapsCol.where('mapId', '==', mapId).orderBy('ts', 'desc').get();
      const snapshots: SnapshotMeta[] = snapDocs.docs.map(d => {
        const data = d.data();
        return {
          snapshotId: d.id,
          mapId: data.mapId,
          ts: data.ts.toDate().toISOString(),
          title:data.title,
          author: data.author,
          size: data.size,
          path: data.path
        };
      });
      console.log('list.ts 2008 › Retrieved', snapshots.length, 'snapshots');
      return res.status(200).json({ snapshots });
    }

    // Deleted mode: fetch all, group, pick latest per map, exclude live
    snapDocs = await snapsCol.get();
    const allSnaps: SnapshotMeta[] = snapDocs.docs.map(d => {
      const data = d.data();
      console.log(`list.ts 2009 › Fetching all snapshots for deleted-mode grouping ${JSON.stringify(data)}`);
      return {
        snapshotId: d.id,
        mapId: data.mapId,
        ts: data.ts.toDate().toISOString(),
        title:data.title,
        author: data.author,
        size: data.size,
        path: data.path
      };
    });

    // Group by mapId, pick most recent snapshot per map
    const latestByMap = new Map<string, SnapshotMeta>();
    allSnaps.forEach(snap => {
      const existing = latestByMap.get(snap.mapId);
      if (!existing || snap.ts > existing.ts) {
        latestByMap.set(snap.mapId, snap);
      }
    });
    console.log('list.ts 2010 › Grouped snapshots, maps found=', latestByMap.size);

    // Filter out any maps still live
    const deletedSnapshots = Array.from(latestByMap.values()).filter(snap => !liveMapIds.includes(snap.mapId));
    console.log('list.ts 2011 › After excluding live maps, deleted count=', deletedSnapshots.length);

    // Sort by descending timestamp
    deletedSnapshots.sort((a, b) => b.ts.localeCompare(a.ts));
    console.log('list.ts 2012 › Deleted snapshots sorted, ready to return');

    return res.status(200).json({ snapshots: deletedSnapshots });
  } catch (err) {
    console.error('list.ts 2013 › Error querying snapshots:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

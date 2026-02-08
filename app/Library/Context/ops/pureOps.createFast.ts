/***********************************************************************************************
 * @file /src/context/ops/pureOps.createFast.ts
 * @responsibility
 *   PURE helpers that split the create flow into:
 *     1) opCreateLocal() — build a fresh Y.Doc locally (no network) and return {ydoc, bytes, docId}
 *     2) opBootstrapNewDoc() — perform initial uploads + /api/document/save and return authoritative
 *        identifiers and access envelope.
 *   These functions DO NOT mutate provider/React state; the YDocContext driver commits results.
 ***********************************************************************************************/

import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import { initialUpload } from '@/app/workspace/(studygraph)/components/utils/storageUrls';
import { saveDocBytes } from '@/app/workspace/(studygraph)/services/localCacheStore';
import { getRandomColor } from '../../utils/colorSet';
import type { AccessEnvelope } from '@/app/workspace/(studygraph)/types/access';

/**
 * update - 1
 * @function opCreateLocal
 * @purpose
 *   Materialize a brand-new document locally without any network calls.
 *   Returns { ydoc, bytes, docId } for immediate UI paint.
 * @steps
 *   1) Allocate fresh Y.Doc and clear/init core maps.
 *   2) Stamp metadata (docFileID, fileName, visibility, version, persist map).
 *   3) Seed a default lesson & root concept node.
 *   4) Encode bytes (Uint8Array).
 *   5) Return { ydoc, bytes, docId }.
 */
export function opCreateLocal(): {
  ydoc: Y.Doc;
  bytes: Uint8Array;
  docId: string;
  fileName: string;
  visibility: 'private';
  version: number;
} {

  // (1)
  const ydoc = new Y.Doc();
  const meta = ydoc.getMap<any>('metadata');

  // (2)
  const docId = uuidv4();
    console.log(`Debug: 3245 Inconsistent Ids: Inital doc id when created ${docId}`)
  const fileName = 'Untitled Document';
  const visibility: 'private' = 'private';
  const version = 1;



  ydoc.transact(() => {
    meta.clear();
    meta.set('docFileID', docId);
    meta.set('fileName', fileName);
    meta.set('visibility', visibility);
    meta.set('version', version);
    if (!(meta.get('persist') instanceof Y.Map)) {
      meta.set('persist', new Y.Map());
    }

    // Clean known maps
    ydoc.getMap('resources').clear();
    ydoc.getMap('subtrees').clear();
    ydoc.getMap('posts').clear();

    // Lesson shell
    const lessonModule = ydoc.getMap('lessonModule');
    lessonModule.clear();
    lessonModule.set('title', 'Default Lesson Module');

    // (3) Default concept map & root
    const defaultMapId = 'map-1';
    const conceptMaps = new Y.Array<any>();
    conceptMaps.push([{ id: defaultMapId, title: 'Untitled Lesson', createdAt: new Date().toISOString() }]);
    lessonModule.set('conceptMaps', conceptMaps);

    const nodesKey = `nodes:${defaultMapId}`;
    const nodesMap = ydoc.getMap(nodesKey) as Y.Map<any>;
    nodesMap.clear();
    nodesMap.set('node-1', {
      id: 'node-1',
      title: 'Root Concept',
      parentNodeId: undefined,
      childrenNodeIds: [],
      x: 0,
      y: 0,
      isRoot: true,
      depth: 0,
    });

    ydoc.getMap('subtrees').set('sentinel-node', {
      minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, position: { x: 0, y: 0 }
    });
  }, { type: 'system', action: 'create-local' });

  // (4)
  const bytes = Y.encodeStateAsUpdate(ydoc);

  // (5)
  return { ydoc, bytes, docId, fileName, visibility, version };
}

/**
 * update - 1
 * @function opBootstrapNewDoc
 * @purpose
 *   Perform the network bootstrap for a locally-created doc:
 *   PUT doc bytes, PUT empty chat, POST /api/document/save.
 *   Returns authoritative identifiers + access envelope. PURE: no provider mutations.
 * @steps
 *   1) Request initialUpload (doc & chat URL pair).
 *   2) PUT document bytes and cache locally.
 *   3) PUT empty chat array.
 *   4) POST /api/document/save and parse identifiers/access.
 *   5) Return { identifiers, accessEnvelope, chat=[], chatFresh=true, paths }.
 */
export async function opBootstrapNewDoc(args: {
  docId: string;
  bytes: Uint8Array;
  isEducator: boolean;
}): Promise<{
  identifiers: { storageGeneration: string | null; versionNumber: number | null };
  accessEnvelope: AccessEnvelope;
  chat: any[];
  chatFresh: boolean;
  fileStoragePath: string;
  chatPath: string;
  colorCode: string;
  isEducatorWorkspace: boolean;
}> {
  // (1)
  const { doc: docTicket, chat: chatTicket, access: uploadAccess } = await initialUpload(args.docId);

  // (2)
  const putDoc = await fetch(docTicket.uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(args.bytes),
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (!putDoc.ok) {
    throw new Error(`opBootstrapNewDoc: doc upload failed: ${putDoc.status} ${putDoc.statusText}`);
  }
  //await saveDocBytes(args.docId, args.bytes);

  // (3)
  const putChat = await fetch(chatTicket.uploadUrl, {
    method: 'PUT',
    body: JSON.stringify([]),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!putChat.ok) {
    throw new Error(`opBootstrapNewDoc: chat upload failed: ${putChat.status} ${putChat.statusText}`);
  }

  // (4)
  const colorCode = getRandomColor();
  const resp = await fetch('/api/document/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      fileName: 'Untitled Document',
      docFileID: args.docId,
      fileStoragePath: docTicket.fileStoragePath,
      chatPath: chatTicket.fileStoragePath,
      fileSize: args.bytes.byteLength,
      colorCode,
      version: 1,
    }),
  });
  if (!resp.ok) {
    throw new Error(`opBootstrapNewDoc: metadata sync failed: ${resp.status} ${resp.statusText}`);
  }
  const saveSeed = await resp.json();

  // (5)
  const identifiers = {
    storageGeneration: saveSeed?.storageGeneration ?? null,
    versionNumber: typeof saveSeed?.versionNumber === 'number' ? saveSeed.versionNumber : 1,
  };

  const accessEnvelope: AccessEnvelope = uploadAccess ?? {
    docId: args.docId,
    role: 'Owner',
    signal: 'GRANT_EDIT',
    source: 'upload',
    at: new Date().toISOString(),
    publicView: false,
    publicEdit: false,
  };

  return {
    identifiers,
    accessEnvelope,
    chat: [],
    chatFresh: true,
    fileStoragePath: docTicket.fileStoragePath,
    chatPath: chatTicket.fileStoragePath,
    colorCode,
    isEducatorWorkspace: args.isEducator
  };
}

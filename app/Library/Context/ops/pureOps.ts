/***********************************************************************************************
 * @file src/context/ops/pureOps.ts
 * @responsibility
 *   Implements **pure** document operations used by YDocContext’s state-machine driver.
 *   These functions perform network/cache I/O and Y.Doc computations but **never** mutate
 *   React/provider state, never call access-layer functions, and never emit UI signals.
 *   They return typed results which the driver commits atomically.
 *
 *   Implemented ops:
 *     - opHydrateFromBytes: materialize bytes → Y.Doc + normalized metadata (PURE)
 *     - opLoadAuth: authoritative download + identifiers + ALWAYS fetch chat (PURE)
 *     - opCreate: new doc initialization + upload + save.ts identifiers (PURE)
 *
 *   Telemetry/logging is handled **internally** here and excluded from outputs.
 ***********************************************************************************************/

import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';

// Helpers already present in the app; paths mirror your current project layout.
import { getDownloadUrl, initialUpload } from '@/app/workspace/(studygraph)/components/utils/storageUrls';
import { saveDocBytes } from '@/app/workspace/(studygraph)/services/localCacheStore';
import { getRandomColor } from '../../utils/colorSet';
import type { Visibility } from '../../Definitions/Definitions';
// Shared types imported from original sources (type-only to avoid runtime cycles).
import type { AccessEnvelope } from '@/app/workspace/(studygraph)/types/access';
import type { ChatMessage } from '../ChatHistoryContext';
export { opCreateLocal, opBootstrapNewDoc } from './pureOps.createFast';

// Local op contracts
import type {
  OpHydrateFromBytesParams,
  OpHydrateFromBytesOutput,
  OpLoadAuthParams,
  OpLoadAuthOutput,
  OpCreateParams,
  OpCreateOutput,
} from './pureOps.types';
import { supersedingCallAwait } from '@/app/src/net/SupersedingAwait';

/* ------------------------------------------------------------------------------------------------
 * Internal utility (PURE): robust version read
 * - Reads metadata.version as number (accepts numeric string); defaults to 1 if missing/invalid.
 * ------------------------------------------------------------------------------------------------ */
function _readVersionFromMetadata(doc: Y.Doc): number {
  const raw = doc.getMap('metadata').get('version');
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() && !Number.isNaN(Number(raw))) return Number(raw);
  return 1;
}

/* ------------------------------------------------------------------------------------------------
 * Internal utility (PURE): ensure & return the metadata.persist map
 * ------------------------------------------------------------------------------------------------ */
function _ensurePersistMap(doc: Y.Doc): Y.Map<any> {
  const meta = doc.getMap('metadata');
  let persist = meta.get('persist') as Y.Map<any> | undefined;
  if (!(persist instanceof Y.Map)) {
    persist = new Y.Map();
    meta.set('persist', persist);
  }
  return persist;
}

/* ------------------------------------------------------------------------------------------------
 * update - 1
 * @function opHydrateFromBytes
 * @purpose
 *   Materialize authoritative Yjs bytes into a fresh Y.Doc and **normalize** metadata fields
 *   used by the provider: docId, fileName, visibility, version. This function is PURE with
 *   respect to provider state; it only returns facts for the driver to commit.
 *
 * @steps
 *   (1) Create fresh Y.Doc and apply bytes.
 *   (2) Resolve metadata map and default visibility to 'private' if missing.
 *   (3) Compute canonical docId using docIdHint → embedded docFileID → legacy fileId.
 *   (4) Migrate legacy 'fileId' → 'docFileID' if needed; stamp canonical id.
 *   (5) Compute fileName (prefer embedded; fallback if missing).
 *   (6) Ensure persist map exists and return a persistReset marker for the driver.
 *   (7) Read robust version from metadata.
 *   (8) Return typed output.
 * ------------------------------------------------------------------------------------------------ */
export async function opHydrateFromBytes(params: OpHydrateFromBytesParams): Promise<OpHydrateFromBytesOutput> {
  const { bytes, fileNameFallback = 'Untitled Document', docIdHint = null } = params;

  // (1)
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, bytes);

  // (2)
  const meta = ydoc.getMap<any>('metadata');
  if (!meta.has('visibility')) meta.set('visibility', 'private');
  const visibility: Visibility = (meta.get('visibility') as Visibility) ?? 'private';

  // (3)
  const embeddedDocId = (meta.get('docFileID') as string | undefined) ?? null;

  const canonicalDocId: string | null = docIdHint ?? embeddedDocId ?? null;

  // (4)
  ydoc.transact(() => {
    if (canonicalDocId) {
      meta.set('docFileID', canonicalDocId);
    }
  }, { type: 'system', action: 'open-doc-stamp' });

  // (5)
  const embeddedName = (meta.get('fileName') as string | undefined) ?? '';
  const fileName = embeddedName.trim() ? embeddedName : fileNameFallback;

  // (6)
  _ensurePersistMap(ydoc);
  const persistReset = { storageGeneration: null, versionNumber: null } as const;

  // (7)
  const version = _readVersionFromMetadata(ydoc);

  // (8)
  return { ydoc, fileName, docId: canonicalDocId, visibility, version, persistReset };
}

/* ------------------------------------------------------------------------------------------------
 * update - 2
 * @function opLoadAuth
 * @purpose
 *   Download the authoritative document bytes and ALWAYS fetch chat. Gather server-returned
 *   identifiers and access envelope. This function is PURE w.r.t. provider; it performs I/O
 *   (download + cache write) and returns data for the driver to commit.
 *
 * @steps
 *   (1) Resolve signed download URL for the doc; capture identifiers + accessEnvelope.
 *   (2) Fetch bytes and write to local cache.
 *   (3) Resolve signed URL for chat; ALWAYS fetch chat; if 404 → chatFresh=true & chat=[].
 *   (4) Build and return the typed OpLoadAuthOutput.
 * ------------------------------------------------------------------------------------------------ */
export async function opLoadAuth(params: OpLoadAuthParams): Promise<OpLoadAuthOutput> {
  const { docId } = params;

  // (1)
  const { downloadUrl: docUrl, storageGeneration, versionNumber, access , isEducatorWorkspace} = await getDownloadUrl(docId, 'doc');
  // telemetry (internal only)
  // console.log('[pureOps] opLoadAuth: resolved doc URL', { docId, storageGeneration, versionNumber });

  // (2)
  const docResp = await fetch(docUrl);
  if (!docResp.ok) {
    throw new Error(`opLoadAuth: doc download failed: ${docResp.status} ${docResp.statusText}`);
  }
  const docBytes = new Uint8Array(await docResp.arrayBuffer());
  await saveDocBytes(docId, docBytes);

  // (3)
  const { downloadUrl: chatUrl } = await getDownloadUrl(docId, 'chat');
  let chat: ChatMessage[] = [];
  let chatFresh = false;
  try {
    const chatResp = await fetch(chatUrl);
    if (chatResp.ok) {
      chat = await chatResp.json();
    } else if (chatResp.status === 404) {
      chatFresh = true;
      chat = [];
    } else {
      throw new Error(`opLoadAuth: chat download failed: ${chatResp.status} ${chatResp.statusText}`);
    }
  } catch (err) {
    // We treat chat failures as non-fatal; driver can still proceed.
    console.warn('[pureOps] opLoadAuth: chat fetch non-fatal error', err);
  }

  // (4)
  return {
    docId,
    identifiers: {
      storageGeneration: storageGeneration ?? null,
      versionNumber: typeof versionNumber === 'number' ? versionNumber : null,
    },
    bytes: docBytes,
    accessEnvelope: access as AccessEnvelope,
    chat,
    chatFresh,
    isEducatorWorkspace: !!isEducatorWorkspace,
  };
}

/* ------------------------------------------------------------------------------------------------
 * update - 4
 * @function opCreate
 * @purpose
 *   Create a new Y.Doc, upload bytes + empty chat, then finalize via /api/document/save. The
 *   finalization call uses the new `supersedingCallAwait` so we align with NP rate limiting:
 *   `429` is respected with a single scheduled retry, and the Promise resolves only on the next
 *   successful server response. Complexity: O(N) for upload; O(1) for control logic.
 * ------------------------------------------------------------------------------------------------ */
export async function opCreate(_: OpCreateParams): Promise<OpCreateOutput> {
  const newDocId = uuidv4();
  const ydoc = new Y.Doc();
  const meta = ydoc.getMap<any>('metadata');

  const defaultVersion = 1;
  const defaultFileName = 'Untitled Document';
  const defaultVisibility: Visibility = 'private';
  const defaultConceptMapId = 'map-1';

  ydoc.transact(() => {
    meta.clear();
    meta.set('docFileID', newDocId);
    meta.set('fileName', defaultFileName);
    meta.set('visibility', defaultVisibility);
    meta.set('version', defaultVersion);
    if (!(meta.get('persist') instanceof Y.Map)) {
      meta.set('persist', new Y.Map());
    }

    ydoc.getMap('resources').clear();
    ydoc.getMap('subtrees').clear();

    const postsMap = ydoc.getMap<Y.Map<any>>('posts');
    postsMap.clear();

    const lessonModule = ydoc.getMap('lessonModule');
    lessonModule.clear();
    lessonModule.set('title', 'Default Lesson Module');

    const conceptMaps = new Y.Array<any>();
    const defaultConceptMap = {
      id: defaultConceptMapId,
      title: 'Untitled Lesson',
      createdAt: new Date().toISOString(),
    };
    conceptMaps.push([defaultConceptMap]);
    lessonModule.set('conceptMaps', conceptMaps);

    const nodesKey = `nodes:${defaultConceptMapId}`;
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
  }, { type: 'system', action: 'reset' });

  const bytes = Y.encodeStateAsUpdate(ydoc);
  const fileSize = bytes.byteLength;
  const colorCode = getRandomColor();

  const { doc, chat, access: uploadAccess } = await initialUpload(newDocId);
  // console.log('[pureOps.ts][5203] opCreate › initialUpload', { newDocId, fileSize });

  const putDoc = await fetch(doc.uploadUrl, {
    method: 'PUT',
    body: new Uint8Array(bytes),
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (!putDoc.ok) {
    throw new Error(`opCreate: doc upload failed: ${putDoc.status} ${putDoc.statusText}`);
  }
  await saveDocBytes(newDocId, bytes);

  const putChat = await fetch(chat.uploadUrl, {
    method: 'PUT',
    body: JSON.stringify([]),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!putChat.ok) {
    throw new Error(`opCreate: chat upload failed: ${putChat.status} ${putChat.statusText}`);
  }

  // update - 5: use awaitable superseder for /api/document/save
  const key = `docSave:${newDocId}`;
  const payload = {
    fileName: defaultFileName,
    docFileID: newDocId,
    fileStoragePath: doc.fileStoragePath,
    chatPath: chat.fileStoragePath,
    fileSize,
    colorCode,
    version: defaultVersion,
  };

  const resp = await supersedingCallAwait(key, payload, (signal, body) =>
    fetch('/api/document/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal,
      body: JSON.stringify(body),
    })
  );

  if (!resp.ok) {
    throw new Error(`opCreate: metadata sync failed: ${resp.status} ${resp.statusText}`);
  }

  const saveSeed = await resp.json();
  const seedStorageGen: string | null = saveSeed?.storageGeneration ?? null;
  const seedVersionNum: number = typeof saveSeed?.versionNumber === 'number'
    ? saveSeed.versionNumber
    : defaultVersion;

  const accessEnvelope: AccessEnvelope = uploadAccess ?? {
    docId: newDocId,
    role: 'Owner',
    signal: 'GRANT_EDIT',
    source: 'upload',
    at: new Date().toISOString(),
    publicView: false,
    publicEdit: false,
  };

  return {
    docId: newDocId,
    ydoc,
    bytes,
    identifiers: { storageGeneration: seedStorageGen, versionNumber: seedVersionNum },
    accessEnvelope,
    chat: [],
    chatFresh: true,
  };
}

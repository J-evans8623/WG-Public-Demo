/***********************************************************************************************
 * @file src/context/ops/pureOps.types.ts
 * @responsibility
 *   Centralized TypeScript contracts (params/outputs) for the **pure ops** used by the
 *   YDoc provider’s state machine. These types define the input/output shapes for:
 *     - opHydrateFromBytes
 *     - opLoadAuth
 *     - opCreate
 *   This file keeps the API surface precise and independent from implementation details.
 *   It **does not** re-declare shared types; it imports them from their original sources.
 ***********************************************************************************************/

import type * as Y from 'yjs';

// NOTE: Import shared types from their original sources.
// - AccessEnvelope: the access/role envelope produced by backend
// - Visibility: 'private' | 'public' flags used in metadata
// - ChatMessage: app’s chat record
//
// If your project exposes these from different modules, update the paths below.
// These are type-only imports, so they will not introduce runtime cycles.
import type { AccessEnvelope } from '@/app/workspace/(studygraph)/types/access';


type Visibility = "private" | "public";

interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * 1) Pure hydrate-from-bytes (replaces mutating loadData)
 *    - No provider mutations. Returns normalized facts the driver will commit.
 * ────────────────────────────────────────────────────────────────────────── */
export interface OpHydrateFromBytesParams {
  /** Authoritative Yjs bytes to materialize. */
  bytes: Uint8Array;
  /** Used if no fileName is found inside the bytes. */
  fileNameFallback?: string;
  /** If provided, overrides/migrates embedded id (e.g., legacy 'fileId' → 'docFileID'). */
  docIdHint?: string | null;
}

export interface OpHydrateFromBytesOutput {
  /** Fully materialized Y.Doc with bytes applied and metadata normalized. */
  ydoc: Y.Doc;
  /** Resolved fileName (from metadata or fallback). */
  fileName: string;
  /** Canonical docId after hint/migration; may be null for malformed bytes. */
  docId: string | null;
  /** Normalized visibility. */
  visibility: Visibility;
  /** Robust version coerced to number (defaults to 1 when missing). */
  version: number;
  /** Signal to reset persist identifiers on commit to avoid cross-file reuse. */
  persistReset: { storageGeneration: null; versionNumber: null };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2) Pure authoritative load (replaces mutating loadFromFirebase)
 *    - ALWAYS fetches chat (per requirement).
 *    - No provider mutations. Telemetry/logging stays internal to impl.
 * ────────────────────────────────────────────────────────────────────────── */
export interface OpLoadAuthParams {
  /** Canonical document id (or id extracted from storage path). */
  docId: string;
}

export interface OpLoadAuthOutput {
  /** Canonical doc id (echo). */
  docId: string;
  /** Storage identifiers returned by the server to seed persist state. */
  identifiers: { storageGeneration: string | null; versionNumber: number | null };
  /** Authoritative doc bytes for hydration. */
  bytes: Uint8Array;
  /** Access/role envelope from server (e.g., Owner/Editor/Viewer). */
  accessEnvelope: AccessEnvelope;
  /** The chat array for this doc; empty if missing. */
  chat: ChatMessage[];
  /** True when chat.json was missing (404). */
  chatFresh: boolean;
}

/* ──────────────────────────────────────────────────────────────────────────
 * 3) Pure create (replaces mutating createNewDocument)
 *    - No params (accuracy with original).
 *    - accessEnvelope is REQUIRED and Owner for new docs.
 * ────────────────────────────────────────────────────────────────────────── */
export interface OpCreateParams {} // intentionally empty

export interface OpCreateOutput {
  /** New canonical doc id (uuid). */
  docId: string;
  /** Fully initialized Y.Doc with default structures and metadata. */
  ydoc: Y.Doc;
  /** Encoded bytes that were uploaded. */
  bytes: Uint8Array;
  /** Storage identifiers returned by the server (save.ts). */
  identifiers: { storageGeneration: string | null; versionNumber: number };
  /** REQUIRED: Access envelope (Owner for creator). */
  accessEnvelope: AccessEnvelope;
  /** Chat payload for a new doc (empty). */
  chat: ChatMessage[];
  /** Always true for newly created docs. */
  chatFresh: true;
}

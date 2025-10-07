here’s the sprint doc + the “minimal-integration” guide you asked for. it’s written so you can drop it in the repo (e.g., `/docs/migrate-init-helpers-to-ydoc-v2.md`) and then visit files one-by-one.

---

# Migration: remove init helpers → adopt YDocContextv2 signals

## Why this sprint exists

Legacy “init utility helpers” scattered lifecycle work (close/open, cache, auth load, autosave, collab, readiness flags) across many consumers. That made order-of-operations brittle and caused race conditions.

**Now:** `YDocContextv2` is the single source of truth. Components **express intent** (`requestCreateDocument`, `requestSelectDocument`) and **react to signals**:

* `bootPhase: 'IDLE' | 'CLOSING' | 'SELECTING' | 'AUTH_LOADING' | 'ACTIVE' | 'ERROR'`
* `renderReady: boolean` – cached-first paint is safe
* `saveReady: boolean` – authoritative state is ready (IDs seeded, storage gen/version reconciled)
* Access/visibility utilities: `getVisibility()`, `updateVisibility(v)`
* Persistence API (pure): `saveToFirebase(chat?) → { persistIds, accessEnvelope, fileStoragePath }`
* Snapshots and versioning: `takeMapSnapshot(mapId)`, `incrementVersion()`, `version`
* Chat readiness event: `addChatReadyListener(cb)`, `removeChatReadyListener(cb)`

The provider’s state machine already handles: **Close → (CacheCheck) → AuthoritativeLoad** for *select*, and **Close → Create** for *create*.

---

## Scope of this sprint

* **Remove all imports/usages** of the old init helpers across UI, services, and hooks.
* **Refactor consumers** to rely only on the YDocContextv2 signals + intents.
* **Standardize side-effects** (autosave, collab, data hydration, overlays) on those signals.
* **Do not re-implement closing or sequencing** in consumers—let the provider drive it.

### Definition of Done (per file / consumer)

* No legacy init helper imports remain.
* All open/create flows use `requestSelectDocument(id)` or `requestCreateDocument()`.
* UI flip to renderable view is gated by `renderReady`.
* Any authoritative side-effects (user data hydration, ID-dependent work) are gated by `saveReady`.
* Any live collaboration or autosave is gated by `bootPhase==='ACTIVE' && saveReady===true`.
* Visibility/privileges read from `getVisibility()` (and the AccessLayer where relevant).
* Pure save path uses `saveToFirebase(...)` and the result is **not** mutating provider state.

---

## What changes for common consumers

### 1) “Open or Create” entry points

**Before:** ad-hoc helper pipelines.
**Now:** call intent, show a lightweight overlay, then let signals drive the UI.

```ts
const { requestSelectDocument, requestCreateDocument } = useYDoc();

function onPick(docId: string) {
  showOverlay('Opening Notebook…');
  requestSelectDocument(docId); // machine: Close → CacheCheck → AuthLoad
}

function onCreate() {
  showOverlay('Creating Notebook…');
  requestCreateDocument(); // machine: Close → Create
}
```

### 2) First paint vs. authoritative work

* **Flip UI to map/canvas** on `renderReady`.
* **Run per-user hydration, seed autosave, show collab affordances** on `saveReady`.

```ts
useEffect(() => {
  if (renderReady) {
    setView('map');
    hideOverlay();
  }
  if (saveReady && docFileID) {
    hydrateUserData(docFileID);
  }
}, [renderReady, saveReady, docFileID]);
```

### 3) Collaboration

Connect **only** when the machine is stable and authoritative:

```ts
const ok = bootPhase === 'ACTIVE' && saveReady && view==='map' && ydoc;
ok ? collab.connect(docFileID!, ydoc!, getVisibility()) : collab.disconnect();
```

### 4) Autosave

Gate by the same condition; use the **pure** save op. Do not mutate provider from here.

```ts
if (bootPhase==='ACTIVE' && saveReady) {
  const result = await saveToFirebase(chatDirty ? messages : undefined);
  // Optionally use result.persistIds / result.accessEnvelope for UI only.
}
```

### 5) ReadOnly / privileges

* Snapshots imply read-only: `isSnapshotActive()` or `snapshotYDoc !== null`.
* Ambient privileges: AccessLayer; visibility via `getVisibility()`.

---

## Anti-patterns to remove

* ❌ manually closing docs or sequencing “load steps”
* ❌ reading/writing internal `metadata.persist` directly
* ❌ gating on bespoke booleans instead of `renderReady`/`saveReady`/`bootPhase`
* ❌ performing collab or autosave work before `bootPhase==='ACTIVE' && saveReady`

---

## Migration checklist (use this when you open each file)

1. Delete legacy init helper imports.
2. Import `useYDoc()` and read only the signals/intents you need.
3. Replace “open/create” logic with `requestSelectDocument()` / `requestCreateDocument()` and a temporary overlay.
4. Gate UI flip on `renderReady`; gate authoritative side-effects on `saveReady`.
5. Move collaboration and autosave behind `bootPhase==='ACTIVE' && saveReady`.
6. Replace any manual visibility/privilege plumbing with `getVisibility()` + AccessLayer.

---

## Worked example: `app.tsx` (already migrated)

Key patterns you should replicate elsewhere:

* Landing and picker flows call only **intent**.
* Map view flip on `renderReady`; user data hydration on `saveReady`.
* Collab connection lifecycle: `ACTIVE && saveReady && currentView==='map'`.
* Autosave lifecycle: same gate, using **pure** `saveToFirebase`.
* No direct orchestration of cache/network/closing.

This file can be used as a reference template when migrating similar consumers.

---

## Minimal integration guide (4–6 steps, with justification)

> **Goal:** the fewest possible steps that still ensure correct sequencing, fast first paint, correctness of data, and safe collaboration.

1. **Express intent only.**
   Use `requestSelectDocument(docId)` or `requestCreateDocument()`.
   *Why minimal:* the provider owns all teardown, cache check, and authoritative load. No other call is required.

2. **Flip UI on `renderReady`.**
   As soon as `renderReady===true`, render the map/view and dismiss loading UI.
   *Why minimal:* guarantees cached-first paint without waiting for network; anything earlier risks blank or stale UI.

3. **Run authoritative side-effects on `saveReady`.**
   Kick off per-user hydration, ID-dependent reads/writes, or feature toggles only when `saveReady===true`.
   *Why minimal:* ensures storage generation/version and IDs are reconciled; any earlier side-effect risks conflicts.

4. **Gate collaboration and autosave with `bootPhase==='ACTIVE' && saveReady`.**
   Connect collab and enable autosave only under this compound condition; disconnect otherwise.
   *Why minimal:* one predicate covers stability + authority and prevents thrash/races.

5. **Read privileges/visibility from the source.**
   Use `getVisibility()` and your AccessLayer signals to decide readOnly/edit affordances; treat snapshots as read-only.
   *Why minimal:* avoids duplicating access logic; ensures a single authoritative path for permissions.

(That’s **5 steps**—each is necessary and sufficient; any omission breaks either correctness or UX, and anything extra would duplicate the provider’s state machine.)

---

## Notes for special consumers

* **Version history / snapshots:** if mounting `snapshotYDoc`, treat the canvas as read-only; write paths must be no-ops.
* **Search/pickers:** do not preload Y.Doc yourself—always call the intent and let the machine drive cache/auth load.
* **Chat panels:** subscribe with `addChatReadyListener` to initialize; never block view flip on chat I/O.

---

## Rollout plan

1. Migrate top-level screens (already done in `app.tsx`) → use as exemplar.
2. Migrate canvas-adjacent components (autosave hooks, collab hooks).
3. Migrate panels and modals (history, search, user info) to the readiness gates.
4. Remove dead code & delete legacy helper modules.
5. Run smoke tests: open via picker, via shared link, create new; verify fast paint, autosave, collab connect/disconnect.

---

## QA checklist (quick)

* Open existing doc with warm cache → **map paints before network**, then data hydrates.
* Open existing doc with cold cache → overlay → **map paints after auth load**.
* Create new doc → map paints immediately; autosave first tick succeeds.
* Toggle between docs rapidly → no mixed bytes; collab sockets don’t thrash.
* Viewer link → edit controls hidden; `getVisibility()` and AccessLayer reflect correctly.

---

Ping me when you start walking the files—if you paste a snippet I’ll point out the exact gate to use (`renderReady` vs `saveReady` vs `ACTIVE`).

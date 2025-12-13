Here is the sprint changelog documenting the migration status, performance wins, and the outstanding issues requiring immediate refinement.

---

### **Sprint Changelog: Pdfium Engine Migration**

**Status:** `Completed (with Regressions)`
**Core Objective:** Migrate PDF rendering engine from `pdf.js` to `EmbedPDF (Pdfium)` for improved performance.

#### **Summary**
The primary objective of migrating the rendering engine to `EmbedPDF` (Pdfium) has been achieved. The application now successfully loads and displays PDF documents using the WebAssembly-based engine. Initial telemetry confirms significant performance gains in rendering speed and main-thread responsiveness. However, critical regressions in user interaction (selection, context menu) and stability (zoom/navigation) render the feature incomplete for production release.

#### **✅ Achievements**
* **Engine Swap:** Successfully replaced `pdf.js` with `EmbedPDF (Pdfium)` WASM engine.
* **Performance:** Significant reduction in rendering latency and improved responsiveness, particularly with larger documents.
* **Infrastructure:** Established a new plugin-based architecture using `LoaderPlugin` for configuration-based dynamic document loading.
* **Web Worker Compatibility:** Resolved URL parsing issues in the worker thread by implementing absolute URL resolution for API assets.

#### **⚠️ Critical Regressions & Known Issues**

**1. Interaction & Context Menu Failure**
* **Issue:** The custom context menu (Copy, Ask AI, Quiz) is unreliable. It appears rarely (<5% of attempts) and is frequently overridden by the browser's native context menu.
* **Impact:** The "Smart Study" workflow is currently unusable as users cannot reliably access the action menu.
* **Cause:** Likely a race condition or conflict between the engine's internal event handling and the DOM's native event propagation.

**2. Broken Text Selection Mechanics**
* **Issue:** Text selection is fundamentally broken.
    * **"Ghost" Dragging:** Attempting to select text often triggers a "page drag" behavior, showing a ghost image of the page instead of highlighting text.
    * **Sticky Highlighting:** Selection highlighting does not terminate on mouse release.
    * **Selection Loss:** Clicking to force the end of a selection clears the highlight entirely, preventing any text capture.
* **Impact:** Users cannot select text to study, blocking all downstream features (Flashcards, Quizzes).

**3. Runtime Stability (Tiling Plugin)**
* **Issue:** A runtime crash occurs during rapid navigation and zooming (e.g., jumping from page 24 to 1).
* **Error:** `TypeError: Cannot read properties of undefined (reading 'srcScale')` in `tilingReducer`.
* **Impact:** Application crash requiring a reload. This indicates a state synchronization failure in the `TilingPlugin` when the viewport changes drastically.

#### **Next Steps (Refinement Sprint)**
1.  **Debug Selection Layer:** Investigate CSS/JS conflicts causing the "page drag" behavior (likely an `img` or `div` missing `draggable="false"` or `user-select` conflicts).
2.  **Stabilize Context Menu:** Implement robust event interception to suppress the native browser menu and ensure the custom menu triggers reliably on `onEndSelection`.
3.  **Fix Tiling Crash:** Investigate the `tilingReducer` error to ensure the tiling grid calculates correctly during rapid scale/page jumps.



Interaction & Context Menu Reliability

Added explicit suppression of the native browser context menu by intercepting contextmenu events at the viewer container level (capture phase) and calling preventDefault() / stopPropagation() to prevent the engine/browser from overriding custom UI.

Normalized the custom menu trigger to fire from a single “selection completed” pathway (instead of multiple competing mouse events), reducing missed activations.

Added defensive logic to ensure the custom menu anchors to the latest valid selection bounds even when selection state updates lag one frame behind.

Text Selection Stability

Disabled unintended “page drag” behavior by ensuring rendered page surfaces are not draggable (draggable=false) and by tightening pointer/selection CSS on viewer layers.

Adjusted CSS to prevent selection from sticking:

ensured user-select is enabled only where selection is intended (text layer) and not on page container layers

improved mouse-up termination so highlight reliably ends on release

Added selection lifecycle guards so a click-to-end-selection no longer clears the selection before extraction runs (prevents “selection loss” during capture).

Runtime Stability: TilingPlugin Crash Fix

Hardened tilingReducer against transient undefined state during rapid page/zoom jumps:

added null/undefined guards around scale-derived fields (including srcScale)

ensured tiling state initializes/reset deterministically on abrupt viewport transitions

Reduced state desync risk by enforcing consistent ordering for “page change → scale change → tiling recompute” updates.

Diagnostics & Telemetry

Added targeted debug logging around selection start/end, context-menu open attempts, and tiling recomputes to make regressions reproducible and measurable.

Added simple counters/telemetry hooks for “menu shown vs attempts” and “selection extracted vs selection ended” to validate improvements.
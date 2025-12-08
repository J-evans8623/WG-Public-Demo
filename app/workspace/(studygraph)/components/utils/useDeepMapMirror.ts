/**
 * @file useDeepMapMirror.ts
 * @description
 *   This utility encapsulates a standardized, production-ready pattern for initializing and observing
 *   Yjs maps in React contexts and components. Its primary responsibility is to ensure that any React
 *   state derived from a Yjs structure is immediately synchronized with locally cached bytes (fast-boot)
 *   and remains in sync as the live document mutates, whether via cache application, user edits, or the
 *   arrival of authoritative network data. The helper achieves this by: (1) running an initial projection
 *   function that reads the current Yjs state into React; (2) attaching a deep observer to the provided
 *   Y.Map so structural changes (including the creation of nested arrays or maps) are detected; and (3)
 *   ignoring system-origin transactions to minimize redundant state thrashing. This file centralizes the
 *   pattern used in multiple providers (e.g., NodesProvider) to avoid drift and reduce boilerplate. The
 *   design favors O(1) subscription overhead and O(N) projection work, where N is the size of the derived
 *   structure you compute in your projector. Logging is compact and purposefully placed for observability.
 *
 *   Key responsibilities:
 *     1) Provide a reusable deep-observation initialization pattern for Yjs maps in React.
 *     2) Ensure cached bytes show up in React state immediately after being applied.
 *     3) Reduce repetitive code by standardizing ignore rules for system-origin transactions.
 *     4) Provide concise instrumentation via console logs for attach/detach checkpoints.
 *
 *   Usage example (inside a provider):
 *     const yMap = ydoc.getMap('lessonModule');
 *     const project = useCallback(() => setState(readFrom(yMap)), [yMap]);
 *     useDeepMapMirror(yMap, project);
 */

import * as Y from 'yjs';
import { useEffect } from 'react';

/**
 * @function useDeepMapMirror
 * @description
 *   Initializes a React view of a Yjs map using a two-step process:
 *   (1) Run the provided projector once to build an initial snapshot in React state (fast-boot ready).
 *   (2) Attach a deep observer to the Y.Map that re-runs the projector on any non-system transaction.
 *   This ensures you see cached bytes as soon as they are applied and continue to receive updates as
 *   the document changes. The function does not manage React state itself—your projector does. This
 *   separation keeps responsibilities clear and the API flexible for various contexts and components.
 *   Time complexity: O(1) to subscribe; projection cost depends on the projector (often O(N)).
 *
 * @param yMap - The Yjs map you want to mirror into React state.
 * @param project - A zero-argument function that reads from yMap and writes the derived snapshot to React.
 */
export function useDeepMapMirror(
  yMap: Y.Map<any>,
  project: () => void
): void {
  useEffect(() => {
    // Step 1: Run initial projection to reflect current state (including cached bytes).
    try {
      project();
      // [useDeepMapMirror.ts][6201]
      // eslint-disable-next-line no-console
      //console.log('[useDeepMapMirror.ts][6201] Initial projection executed');
    } catch (err) {
      // [useDeepMapMirror.ts][6291]
      // eslint-disable-next-line no-console
      //console.error('[useDeepMapMirror.ts][6291] Initial projection failed', err);
    }

    // Step 2: Attach deep observer; re-run projector on non-system transactions.
    const onDeep = (_events: Y.YEvent<any>[], tx: Y.Transaction) => {
      if (tx.origin?.type === 'system') return;
      try {
        project();
        // [useDeepMapMirror.ts][6202]
        // eslint-disable-next-line no-console
        //console.log('[useDeepMapMirror.ts][6202] Projection executed after deep update');
      } catch (err) {
        // [useDeepMapMirror.ts][6292]
        // eslint-disable-next-line no-console
        console.error('[useDeepMapMirror.ts][6292] Projection after deep update failed', err);
      }
    };

    yMap.observeDeep(onDeep);
    // [useDeepMapMirror.ts][6203]
    // eslint-disable-next-line no-console
    //console.log('[useDeepMapMirror.ts][6203] Deep observer attached');

    return () => {
      yMap.unobserveDeep(onDeep);
      // [useDeepMapMirror.ts][6204]
      // eslint-disable-next-line no-console
      //console.log('[useDeepMapMirror.ts][6204] Deep observer detached');
    };
  }, [yMap, project]);
}

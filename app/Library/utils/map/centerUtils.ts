// app/Library/utils/centerUtils.ts

/**
 * @file centerUtils.ts
 * @description
 *   This tiny utility centralizes the math for re-centering a scrollable container to the
 *   midpoint of either a fixed “scroll bed” or the element’s current scrollable content.
 *   It intentionally contains no React imports. MapRenderer calls these helpers to keep
 *   DOM math readable and unit-testable, while ZoomContext remains free of DOM refs.
 *
 *   Responsibilities:
 *   1) Provide a single function to place scrollLeft/scrollTop at the visual midpoint.
 *   2) Support both a fixed bed (edit mode) and content-driven sizes (read-only mode).
 *   3) Return the applied positions for debugging/metrics without extra DOM reads.
 *
 *   Performance:
 *   - All operations are O(1). We perform simple arithmetic on provided element metrics.
 *   - No layout thrashing beyond reading clientWidth/clientHeight (already needed).
 *
 *   Logging Strategy:
 *   - No logging here to keep utilities quiet; callers may log the returned values.
 */

export type CenterOptions = {
  /**
   * If provided, we center within a fixed square bed (bedPx x bedPx). When not provided,
   * we center using the element’s scrollWidth/scrollHeight as the content extent.
   */
  bedPx?: number;
};

/**
 * @function centerContainerToMidpoint
 * @description
 *   Centers a scrollable element to the midpoint of a fixed bed or to the element’s
 *   scrollable content dimensions. Returns the computed scrollLeft/Top that were applied.
 *   Callers may log or assert on the returned values. This function avoids any scaling
 *   logic and focuses solely on scroll positioning.
 */
export function centerContainerToMidpoint(
  el: HTMLElement,
  opts?: CenterOptions
): { left: number; top: number } {
  const vw = el.clientWidth;
  const vh = el.clientHeight;

  let left = 0;
  let top = 0;

  if (opts?.bedPx && opts.bedPx > 0) {
    // Fixed bed model (edit mode)
    left = Math.max(0, (opts.bedPx - vw) / 2);
    top = Math.max(0, (opts.bedPx - vh) / 2);
  } else {
    // Content-driven model (read-only mode)
    const contentW = el.scrollWidth;
    const contentH = el.scrollHeight;
    left = Math.max(0, (contentW - vw) / 2);
    top = Math.max(0, (contentH - vh) / 2);
  }

  el.scrollLeft = left;
  el.scrollTop = top;

  return { left, top };
}

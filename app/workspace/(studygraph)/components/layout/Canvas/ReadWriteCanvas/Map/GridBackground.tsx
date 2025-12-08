/**
 * @file GridBackground.tsx
 * @description
 *   This component renders a **high-performance, tiled grid/dots background** as an absolutely
 *   positioned child of the scrollable “scroll bed”. By living inside the content layer (not as a
 *   CSS background on the scroller), the background scrolls with content and can be cached on its
 *   own composited layer, preserving compositor-thread scrolling. The component accepts simple
 *   configuration—grid spacing, color, opacity—and a **phase-alignment** triple that allows the
 *   grid to stay visually glued to the world origin during pan/zoom. Alignment is achieved by
 *   setting `background-position` using `(worldOriginPx * zoom) mod spacingPx`, ensuring dots and
 *   lines do not “creep” at fractional scales. It reads brand colors from CSS variables by default
 *   but allows overrides for themed contexts. The component uses **no canvas** and avoids any
 *   transforms to keep repaint cost low. Focused console logs (file + unique 4-digit codes) mark
 *   key lifecycle points and alignment updates for production observability.
 *
 *   Responsibilities:
 *     1) Render a tiled SVG pattern as a background element inside the scroll bed.
 *     2) Phase-align the pattern to a given world origin and zoom for visual stability.
 *     3) Expose minimal, predictable props for spacing, color, and accessibility toggles.
 *     4) Keep CPU/GPU work light: O(1) alignment math and no expensive reflows.
 */

import React, { useMemo } from 'react';

export interface GridBackgroundProps {
  /**
   * CSS pixel spacing between dots/lines in the pattern.
   * Keep this in screen pixels for a constant-density grid at any zoom.
   */
  spacingPx?: number;

  /**
   * CSS color for the dots/lines. Defaults to a theme variable with a warm-board fallback.
   * Accepts any valid CSS color, e.g., '#D4C4B0' or 'rgba(212,196,176,0.7)'.
   */
  color?: string;

  /**
   * Opacity for the dots/lines baked into the pattern fill.
   * Range [0, 1]. Defaults to 0.7 to match existing brand visuals.
   */
  opacity?: number;

  /**
   * Optional alignment inputs to prevent grid shimmer during pan/zoom.
   * - worldOriginXPx / worldOriginYPx: world (0,0) position in **bed pixels**.
   * - zoom: current zoom scalar applied to the world layer.
   * If omitted, alignment defaults to 0 (top-left), which is stable but not phase-locked.
   */
  align?: {
    worldOriginXPx: number;
    worldOriginYPx: number;
    zoom: number;
  };

  /**
   * Set true to completely disable the pattern for accessibility or perf testing.
   */
  disabled?: boolean;

  /**
   * Optional test id for targeted assertions.
   */
  'data-testid'?: string;
}

/**
 * @function GridBackground
 * @description
 *   Renders a background layer with a tiled SVG pattern and optional phase alignment. The function
 *   computes the `background-position` using the provided world origin and zoom so that the grid’s
 *   pattern origin stays visually locked to content. This avoids subpixel “crawl” at fractional
 *   zooms. The pattern is baked as a data URI for fast caching and zero extra requests. All math is
 *   O(1) and recomputes only when inputs change. The component does not intercept pointer events.
 */
const GridBackground: React.FC<GridBackgroundProps> = ({
  spacingPx = 20,
  color,
  opacity = 0.7,
  align,
  disabled = false,
  'data-testid': dataTestId = 'grid-background',
}) => {
  // 1) Resolve effective color; prefer CSS variable fallback if color not provided.
  //    We bake opacity into the SVG fill to avoid making children translucent.
  const effectiveColor = color ?? '#D4C4B0';

  // 2) Compose the tiny SVG pattern as a data URI; single 1–2px dot inside spacing tile.
  const backgroundImage = useMemo(() => {
    // Dot radius ~1px within the spacing tile; fill color includes opacity via rgba if needed.
    // We convert #RRGGBB + opacity to rgba(r,g,b,opacity) for reliable alpha in SVG.
    const toRGBA = (hex: string, a: number) => {
      const h = hex.replace('#', '');
      const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
    };

    const fill = effectiveColor.startsWith('#')
      ? toRGBA(effectiveColor, opacity)
      : effectiveColor; // if color already includes alpha, trust caller

    const svg = [
      `<svg xmlns='http://www.w3.org/2000/svg' width='${spacingPx}' height='${spacingPx}' viewBox='0 0 ${spacingPx} ${spacingPx}'>`,
      `<circle cx='2' cy='2' r='1' fill='${fill}'/>`,
      `</svg>`,
    ].join('');

    const uri = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
    return uri;
  }, [effectiveColor, opacity, spacingPx]);

  // 3) Compute phase-aligned background-position to keep pattern glued to world origin.
  //    bgPos = -((worldOriginPx * zoom) % spacingPx)
  const { bgPosX, bgPosY } = useMemo(() => {
    if (!align) {
      // No alignment provided; default to origin (0,0). Log once for visibility.
      // Note: avoid noisy logs by keeping this as a single checkpoint.
      //console.log('[GridBackground.tsx][6100] align not provided; using (0,0) background-position');
      return { bgPosX: 0, bgPosY: 0 };
    }
    const { worldOriginXPx, worldOriginYPx, zoom } = align;
    const mod = (v: number, m: number) => ((v % m) + m) % m; // safe positive modulo

    const posX = -mod(worldOriginXPx * zoom, spacingPx);
    const posY = -mod(worldOriginYPx * zoom, spacingPx);

    // Focused alignment log (once per input change).


    return { bgPosX: posX, bgPosY: posY };
  }, [align, spacingPx]);

  if (disabled) {
    //console.log('[GridBackground.tsx][6199] disabled=true; not rendering background');
    return null;
  }

  // 4) Render absolute, non-interactive layer that never transforms.
  return (
    <div
      data-testid={dataTestId}
      aria-hidden="true"
      style={{
        // Layer placement
        position: 'absolute',
        inset: 0,

        // Pattern tiling
        backgroundImage,
        backgroundRepeat: 'repeat',
        backgroundSize: `${spacingPx}px ${spacingPx}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,

        // Keep it non-interactive and cheap to invalidate
        pointerEvents: 'none',
        contain: 'paint',
      }}
    />
  );
};

export default GridBackground;

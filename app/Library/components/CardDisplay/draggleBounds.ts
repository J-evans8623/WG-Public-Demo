// bloom-maps/app/Library/utils/draggableBounds.ts

import { DraggableBounds } from 'react-draggable';

/**
 * Calculates the draggable bounds for a modal based on the center pane's dimensions,
 * incorporating padding to prevent overlap with adjacent UI elements.
 *
 * @param centerPaneRect - The bounding rectangle of the center pane.
 * @param leftPaneWidth - The fixed width of the left pane in pixels.
 * @param rightOffset - The offset from the right edge of the center pane.
 * @param bottomFraction - The fraction of the center pane's height to set as the bottom bound.
 * @param padding - The padding to apply on all sides to prevent overlapping.
 * @returns The draggable bounds object with padding applied.
 */
export const calculateDraggableBounds = (
  centerPaneRect: DOMRect,
  leftPaneWidth: number = 420,
  rightOffset: number = 200,
  bottomFraction: number = 0.5,
  padding: number = 32 // Default padding of 32px on all sides
): DraggableBounds => {
  return {
    left: leftPaneWidth + padding, // Start after left pane width plus padding
    top: padding, // Apply top padding
    right: leftPaneWidth + padding + centerPaneRect.width - rightOffset - padding, // Adjust right bound with padding
    bottom: centerPaneRect.height * bottomFraction - padding, // Adjust bottom bound with padding
  };
};

/**
 * Calculates the initial position for a modal within the center pane,
 * incorporating padding to prevent overlapping with adjacent UI elements.
 *
 * @param centerPaneRect - The bounding rectangle of the center pane.
 * @param leftPaneWidth - The fixed width of the left pane in pixels.
 * @param xOffset - The horizontal offset from the left bound.
 * @param yFraction - The fraction of the center pane's height to set as the initial y position.
 * @param padding - The padding to apply on all sides to prevent overlapping.
 * @returns The initial position object with x and y coordinates.
 */
export const calculateInitialPosition = (
  centerPaneRect: DOMRect,
  leftPaneWidth: number = 420,
  xOffset: number = 50,
  yFraction: number = 0.25,
  padding: number = 32 // Default padding of 32px on all sides
): { x: number; y: number } => {
  return {
    x: leftPaneWidth + xOffset + padding, // Start after left pane width, offset, and padding
    y: centerPaneRect.height * yFraction + padding, // Start at a quarter of the height plus padding
  };
};

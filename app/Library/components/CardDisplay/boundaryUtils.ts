// boundaryUtils.ts

export interface Boundary {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }
  
  /**
   * Calculates the boundary constraints for image panning.
   *
   * @param imageWidth - The width of the image after scaling.
   * @param imageHeight - The height of the image after scaling.
   * @param containerWidth - The width of the modal container.
   * @param containerHeight - The height of the modal container.
   * @returns An object containing minX, maxX, minY, and maxY.
   */
  export function calculateBoundaries(
    imageWidth: number,
    imageHeight: number,
    containerWidth: number,
    containerHeight: number
  ): Boundary {
    const maxX = Math.max((imageWidth - containerWidth) / 2, 0);
    const maxY = Math.max((imageHeight - containerHeight) / 2, 0);
    
    return {
      minX: -maxX,
      maxX: maxX,
      minY: -maxY,
      maxY: maxY,
    };
  }
  
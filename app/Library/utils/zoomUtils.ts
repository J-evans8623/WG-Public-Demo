// bloom-maps/app/Library/utils/zoomUtils.ts
export const calculateZoomLevel = (percentage: number, baseZoom: number = 0.7): number => {
    return (percentage / 100) * baseZoom;
  };
  
  export const calculateZoomPercentage = (zoomLevel: number, baseZoom: number = 0.7): number => {
    return (zoomLevel / baseZoom) * 100;
  };
  
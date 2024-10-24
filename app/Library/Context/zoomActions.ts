// bloom-maps\app\Library\Tests\context\zoomActions.ts
import { ZoomActionType, ZoomAction } from '@/app/Library/Definitions/Definitions';

export const zoomIn = (): ZoomAction => ({
  type: ZoomActionType.ZOOM_IN,
});

export const zoomOut = (): ZoomAction => ({
  type: ZoomActionType.ZOOM_OUT,
});

export const setZoomLevel = (zoomLevel: number): ZoomAction => ({
  type: ZoomActionType.SET_ZOOM_LEVEL,
  payload: zoomLevel,
});

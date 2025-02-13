// bloom-maps/app/Library/Context/zoomReducer.ts
import { ZoomAction, ZoomActionType } from '@/app/Library/Definitions/Definitions';

const baseZoomLvl = 1;

export interface ZoomState {
  zoomLevel: number;
  baseZoomLevel: number;
  scrollLeft: number;
  scrollTop: number;
}

export const initialZoomState: ZoomState = {
  zoomLevel: baseZoomLvl,
  baseZoomLevel: baseZoomLvl,
  scrollLeft: 0,
  scrollTop: 0,
};

export const zoomReducer = (state: ZoomState, action: ZoomAction): ZoomState => {
  switch (action.type) {
    case ZoomActionType.ZOOM_IN: {
      const newZoom = Math.min(state.zoomLevel + 0.1 * baseZoomLvl, 2 * baseZoomLvl);
      if (state.zoomLevel === newZoom) {
        return state;
      }
      const adjustedScrollLeft = state.scrollLeft * (newZoom / state.zoomLevel);
      const adjustedScrollTop = state.scrollTop * (newZoom / state.zoomLevel);

      return {
        ...state,
        zoomLevel: Math.round(newZoom * 100) / 100,
        scrollLeft: adjustedScrollLeft,
        scrollTop: adjustedScrollTop,
      };
    }

    case ZoomActionType.ZOOM_OUT: {
      const newZoom = Math.max(state.zoomLevel - 0.1 * baseZoomLvl, 0.1 * baseZoomLvl);
      if (state.zoomLevel === newZoom) {
        return state;
      }
      const adjustedScrollLeft = state.scrollLeft * (newZoom / state.zoomLevel);
      const adjustedScrollTop = state.scrollTop * (newZoom / state.zoomLevel);

      return {
        ...state,
        zoomLevel: Math.round(newZoom * 100) / 100,
        scrollLeft: adjustedScrollLeft,
        scrollTop: adjustedScrollTop,
      };
    }

    case ZoomActionType.SET_ZOOM_LEVEL: {
      const newZoom = Math.max(0.1 * state.baseZoomLevel, Math.min(action.payload, 2 * state.baseZoomLevel));
      if (state.zoomLevel === newZoom) {
        return state;
      }
      const adjustedScrollLeft = state.scrollLeft * (newZoom / state.zoomLevel);
      const adjustedScrollTop = state.scrollTop * (newZoom / state.zoomLevel);

      return {
        ...state,
        zoomLevel: Math.round(newZoom * 100) / 100,
        scrollLeft: adjustedScrollLeft,
        scrollTop: adjustedScrollTop,
      };
    }

    default:
      return state;
  }
};

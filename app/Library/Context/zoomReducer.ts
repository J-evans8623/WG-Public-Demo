// bloom-maps/app/Library/Context/zoomReducer.ts
import { ZoomAction, ZoomActionType } from '@/app/Library/Definitions/Definitions';

const baseZoomLvl = 1;

// Policy Constants
const MIN_USER_ZOOM = 0.5; // 50%
const MAX_USER_ZOOM = 2.0; // 200%
const ZOOM_STEP = 0.1;

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
      const rawNewZoom = state.zoomLevel + ZOOM_STEP * baseZoomLvl;
      // Clamp to MAX
      const newZoom = Math.min(rawNewZoom, MAX_USER_ZOOM * baseZoomLvl);
      
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
      const rawNewZoom = state.zoomLevel - ZOOM_STEP * baseZoomLvl;
      // Clamp to MIN (User initiated range: 50%)
      const newZoom = Math.max(rawNewZoom, MIN_USER_ZOOM * baseZoomLvl);

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
      // Enforce the 50% - 200% range even for direct sets
      const newZoom = Math.max(
        MIN_USER_ZOOM * state.baseZoomLevel,
        Math.min(action.payload, MAX_USER_ZOOM * state.baseZoomLevel)
      );

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
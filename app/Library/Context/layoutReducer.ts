
// bloom-maps/app/Library/Context/layoutReducer.ts
import { LayoutAction, LayoutActionType } from '@/app/Library/Definitions/Definitions';

export interface LayoutState {
  getLayout: boolean;
  defaultMapWidth: number;
  defaultMapHeight: number;
  groundWidth: number;
  resetMapSize: boolean;
}

export const initialLayoutState: LayoutState = {
  getLayout: false,
  defaultMapWidth: 1800,
  defaultMapHeight: 1800,
  groundWidth: 0,
  resetMapSize: false,
};

export const layoutReducer = (state: LayoutState, action: LayoutAction): LayoutState => {
  switch (action.type) {
    case LayoutActionType.SET_GET_LAYOUT:
      if (state.getLayout === action.payload) {
        return state;
      }
      return { ...state, getLayout: action.payload };

    case LayoutActionType.SET_MAP_SIZE:
      if (
        state.groundWidth === action.payload.groundWidth &&
        state.defaultMapWidth === action.payload.mapWidth &&
        state.defaultMapHeight === action.payload.mapHeight
      ) {
        return state;
      }
      return {
        ...state,
        groundWidth: action.payload.groundWidth,
        defaultMapWidth: action.payload.mapWidth,
        defaultMapHeight: action.payload.mapHeight,
      };

    case LayoutActionType.TOGGLE_RESET_MAP_SIZE:
      return {
        ...state,
        resetMapSize: !state.resetMapSize,
      };

    default:
      return state;
  }
};

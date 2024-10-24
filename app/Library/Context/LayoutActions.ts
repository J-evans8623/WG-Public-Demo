// bloom-maps/app/Library/Context/layoutActions.ts
import { LayoutActionType, LayoutAction } from '@/app/Library/Definitions/Definitions';

export const setGetLayout = (getLayout: boolean): LayoutAction => ({
  type: LayoutActionType.SET_GET_LAYOUT,
  payload: getLayout,
});

export const setMapSize = (groundWidth: number, mapWidth: number, mapHeight: number): LayoutAction => ({
  type: LayoutActionType.SET_MAP_SIZE,
  payload: { groundWidth, mapWidth, mapHeight },
});

export const toggleResetMapSize = (): LayoutAction => ({
  type: LayoutActionType.TOGGLE_RESET_MAP_SIZE,
});

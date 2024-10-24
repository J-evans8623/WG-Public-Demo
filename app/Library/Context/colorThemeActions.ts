// bloom-maps/app/Library/Context/colorThemeActions.ts
import { ColorThemeActionType, ColorThemeAction, ColorTheme } from '@/app/Library/Definitions/Definitions';

export const setColorTheme = (colorTheme: ColorTheme): ColorThemeAction => ({
  type: ColorThemeActionType.SET_COLOR_THEME,
  payload: colorTheme,
});

export const setPrimaryColor = (color: string): ColorThemeAction => ({
  type: ColorThemeActionType.SET_PRIMARY_COLOR,
  payload: color,
});

export const setBackgroundColor = (color: string): ColorThemeAction => ({
  type: ColorThemeActionType.SET_BACKGROUND_COLOR,
  payload: color,
});

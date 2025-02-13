// bloom-maps/app/Library/Context/colorThemeReducer.ts
import { 
  ColorThemeAction, 
  ColorThemeActionType, 
  ColorTheme 
} from '@/app/Library/Definitions/Definitions';

export interface ColorThemeState {
  colorTheme: ColorTheme;
  primaryColor: string;
  backgroundColor: string;
}

export const initialColorThemeState: ColorThemeState = {
  colorTheme: 'cool-spring',
  primaryColor: '#D5E6ED',
  backgroundColor: '#F5F5F5',
};

export const colorThemeReducer = (
  state: ColorThemeState, 
  action: ColorThemeAction
): ColorThemeState => {
  switch (action.type) {
    case ColorThemeActionType.SET_COLOR_THEME:
      if (state.colorTheme === action.payload) {
        return state;
      }
      return { ...state, colorTheme: action.payload };

    case ColorThemeActionType.SET_PRIMARY_COLOR:
      if (state.primaryColor === action.payload) {
        return state;
      }
      return { ...state, primaryColor: action.payload };

    case ColorThemeActionType.SET_BACKGROUND_COLOR:
      if (state.backgroundColor === action.payload) {
        return state;
      }
      return { ...state, backgroundColor: action.payload };

    case ColorThemeActionType.RESET_COLOR_THEME: // Handle reset
      return { ...initialColorThemeState };

    default:
      return state;
  }
};

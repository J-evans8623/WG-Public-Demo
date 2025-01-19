// fileReducer.ts
import { FileAction, FileActionType } from '@/app/Library/Definitions/Definitions';

export interface FileState {
  fileName: string;
  driveFileId?: string;
  isInitialized: boolean;
  isYDocInitialized: boolean;
}

export const initialFileState: FileState = {
  fileName: 'Untitled Document',
  driveFileId: undefined,
  isInitialized: false,
  isYDocInitialized: false,
};

/**
 * Reducer function to handle all file-related state updates
 * @param state Current file state
 * @param action Action to be performed
 * @returns Updated file state
 */
export const fileReducer = (state: FileState, action: FileAction): FileState => {
  switch (action.type) {
    case FileActionType.SET_FILE_NAME:
      if (state.fileName === action.payload) {
        return state;
      }
      return { ...state, fileName: action.payload };

    case FileActionType.SET_DRIVE_FILE_ID:
      return { ...state, driveFileId: action.payload };

    case FileActionType.RESET_DRIVE_FILE_ID:
      return { ...state, driveFileId: undefined };

    case FileActionType.SET_INITIALIZED:
      return { ...state, isInitialized: action.payload };

    case FileActionType.SET_YDOC_INITIALIZED:
      return { ...state, isYDocInitialized: action.payload };

    default:
      return state;
  }
};

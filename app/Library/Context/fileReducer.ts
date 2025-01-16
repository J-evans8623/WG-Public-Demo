// bloom-maps/app/Library/Context/fileReducer.ts

import { FileAction, FileActionType, StorageType } from '@/app/Library/Definitions/Definitions';

export interface FileState {
  fileName: string;
  driveFileId?: string;
  autoSave: boolean;
  isShared: boolean;
}

export const initialFileState: FileState = {
  fileName: 'Untitled Document',
  driveFileId: undefined,
  autoSave: false,
  isShared: false,
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

    default:
      return state;
  }
};

// bloom-maps/app/Library/Context/fileReducer.ts
import { FileAction, FileActionType } from '@/app/Library/Definitions/Definitions';

export interface FileState {
  fileName: string;
}

export const initialFileState: FileState = {
  fileName: 'Untitled Document',
};

export const fileReducer = (state: FileState, action: FileAction): FileState => {
  switch (action.type) {
    case FileActionType.SET_FILE_NAME:
      if (state.fileName === action.payload) {
        return state;
      }
      return { ...state, fileName: action.payload };

    default:
      return state;
  }
};

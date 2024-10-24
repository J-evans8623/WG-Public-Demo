// bloom-maps/app/Library/Context/fileActions.ts
import { FileActionType, FileAction } from '@/app/Library/Definitions/Definitions';

export const setFileName = (fileName: string): FileAction => ({
  type: FileActionType.SET_FILE_NAME,
  payload: fileName,
});

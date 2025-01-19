// bloom-maps/app/Library/Context/fileActions.ts

import { FileActionType, FileAction } from '@/app/Library/Definitions/Definitions';

/**
 * Action creator for updating the file name
 * @param fileName New file name
 */
export const setFileName = (fileName: string): FileAction => ({
  type: FileActionType.SET_FILE_NAME,
  payload: fileName,
});

/**
 * Action creator for updating the Google Drive file ID
 * @param fileId Google Drive file ID
 */
export const setDriveFileId = (fileId: string): FileAction => ({
  type: FileActionType.SET_DRIVE_FILE_ID,
  payload: fileId,
});

/**
 * Action creator for resetting the Google Drive file ID
 */
export const resetDriveFileId = (): FileAction => ({
  type: FileActionType.RESET_DRIVE_FILE_ID,
});

/**
 * Action creator for setting the initialized state
 * @param isInitialized Boolean indicating if the file is initialized
 */
export const setInitialized = (isInitialized: boolean): FileAction => ({
  type: FileActionType.SET_INITIALIZED,
  payload: isInitialized,
});

/**
 * Action creator for setting the YDoc initialized state
 * @param isYDocInitialized Boolean indicating if the YDoc is initialized
 */
export const setYDocInitialized = (isYDocInitialized: boolean): FileAction => ({
  type: FileActionType.SET_YDOC_INITIALIZED,
  payload: isYDocInitialized,
});

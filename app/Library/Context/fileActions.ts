// bloom-maps/app/Library/Context/fileActions.ts

import { FileActionType, FileAction, StorageType } from '@/app/Library/Definitions/Definitions';

/**
 * Action creator for updating the file name
 * @param fileName New file name
 */
export const setFileName = (fileName: string): FileAction => ({
  type: FileActionType.SET_FILE_NAME,
  payload: fileName,
});

/**
 * Action creator for updating the storage type
 * @param storageType New storage type ('local' or 'drive')
 */
export const setStorageType = (storageType: StorageType): FileAction => ({
  type: FileActionType.SET_STORAGE_TYPE,
  payload: storageType,
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
 * Action creator for updating the auto-save state
 * @param enabled Whether auto-save is enabled
 */
export const setAutoSave = (enabled: boolean): FileAction => ({
  type: FileActionType.SET_AUTO_SAVE,
  payload: enabled,
});

/**
 * Action creator for updating the file sharing state
 * @param isShared Whether the file is shared
 */
export const setIsShared = (isShared: boolean): FileAction => ({
  type: FileActionType.SET_IS_SHARED,
  payload: isShared,
});
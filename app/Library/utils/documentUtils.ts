/**
 * @file documentUtils.ts
 * @description 
 * Utility functions for handling document serialization, saving, loading, and initialization.
 * These functions manage the conversion of document data to and from JSON formats,
 * handle file operations like saving and loading .bloomdocx files,
 * and initialize new documents with default settings.
 * 
 * Additionally, this file implements mode-dependent functionality to handle
 * different behaviors when operating in 'private' mode versus 'collaborate' mode.
 * In 'collaborate' mode, additional metadata and conflict resolution information
 * are included to maintain data integrity across multiple users.
 * 
 * This ensures that the application can seamlessly switch between private and
 * collaborative workflows without compromising on functionality or performance.
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  ColorTheme,
} from '@/app/Library/Definitions/Definitions';

import * as Y from 'yjs';
import { toast } from 'react-toastify';


/**
 * Function to save the document as a `.bloomdocx` file.
 * This function saves the file to the local device and triggers the file save dialog.
 *
 * @param ydoc - The Y.Doc instance to encode and include in the save
 * @param nodes - Map of ConceptNode with nodeId as key
 * @param colorTheme - Current color theme
 * @param primaryColor - Primary color of the theme
 * @param backgroundColor - Background color of the theme
 * @param fileName - Name of the document file
 * @param cueCards - Map of CueCardResource with nodeId as key
 * @param subtrees - Map of SubtreeData with subtreeId as key
 * @param pictures - Map of PictureResource with nodeId as key
 * @param practiceSheets - Map of PracticeSheetResource with nodeId as key
 * @param fileId - Optional file identifier for collaborative documents
 */
export const saveDocument = async (
  persistDoc: (local: boolean) => Uint8Array,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  fileId?: string
): Promise<void> => {
  const zip = new JSZip();

  try {
    // 1. Serialize Y.doc state
    const yUpdate = persistDoc(true);
    zip.file('document/yjsState.bin', yUpdate);

    // 2. Save color theme preferences
    const styles = {
      primaryColor,
      backgroundColor,
      colorTheme
    };
    zip.file('document/styles.json', JSON.stringify(styles));

    // 3. Save file metadata
    const metadata = {
      fileName,
      fileId
    };
    zip.file('document/metadata.json', JSON.stringify(metadata));

    // Generate and save ZIP
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${fileName || 'my_document'}.bloomdocx`);
    toast.success('Document saved successfully!');
  } catch (error) {
    console.error('Error saving document:', error);
    toast.error('Failed to save the document');
    throw error;
  }
}

/**
 * Prepares a `.bloomdocx` file for saving to Google Drive or local storage.
 * The created file can then be sent to the backend where it will be routed to Google Drive.
 * @param ydoc - The Y.Doc instance to encode and include in the save
 * @param nodes - Map of ConceptNode with nodeId as key
 * @param colorTheme - Current color theme
 * @param primaryColor - Primary color of the theme
 * @param backgroundColor - Background color of the theme
 * @param fileName - Name of the document file
 * @param cueCards - Map of CueCardResource with nodeId as key
 * @param subtrees - Map of SubtreeData with subtreeId as key
 * @param pictures - Map of PictureResource with nodeId as key
 * @param practiceSheets - Map of PracticeSheetResource with nodeId as key
 * @param fileId - Optional file identifier for collaborative documents
 * @returns A `Blob` representing the `.bloomdocx` file.
 */
export const prepareBloomDocx = async (
  persistDoc: (local: boolean) => Uint8Array,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  fileId?: string
): Promise<Blob> => {
  const zip = new JSZip();

  try {
    // Same logic as saveDocument, but returns Blob instead of saving
    const yUpdate = persistDoc(false);
    zip.file('document/yjsState.bin', yUpdate);

    const styles = {
      primaryColor,
      backgroundColor,
      colorTheme
    };
    zip.file('document/styles.json', JSON.stringify(styles));

    const metadata = {
      fileName,
      fileId
    };
    zip.file('document/metadata.json', JSON.stringify(metadata));

    return await zip.generateAsync({ type: 'blob' });
  } catch (error) {
    console.error('Error preparing document:', error);
    toast.error('Failed to prepare the document');
    throw error;
  }
};
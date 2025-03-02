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
// documentUtils.ts// documentUtils.ts
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ColorTheme } from '@/app/Library/Definitions/Definitions';
import { toast } from 'react-toastify';

export const saveDocument = async (
  persistDoc: (local: boolean) => Uint8Array,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  fileId: string | undefined,
  getLessonModuleJSON: () => string  // new parameter
): Promise<void> => {
  const zip = new JSZip();
  try {
    // Serialize Y.doc state
    const yUpdate = persistDoc(true);
    zip.file('document/yjsState.bin', yUpdate);

    // Save color theme preferences
    const styles = {
      primaryColor,
      backgroundColor,
      colorTheme
    };
    zip.file('document/styles.json', JSON.stringify(styles));

    // Save file metadata
    const metadata = {
      fileName,
      fileId
    };
    zip.file('document/metadata.json', JSON.stringify(metadata));

    // NEW: Save lessonModule metadata using our encapsulated method
    const lessonModuleJSON = getLessonModuleJSON();
    zip.file('document/lessonModule.json', lessonModuleJSON);

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${fileName || 'my_document'}.bloomdocx`);
    toast.success('Document saved successfully!');
  } catch (error) {
    console.error('Error saving document:', error);
    toast.error('Failed to save the document');
    throw error;
  }
};

export const prepareBloomDocx = async (
  persistDoc: (local: boolean) => Uint8Array,
  colorTheme: ColorTheme,
  primaryColor: string,
  backgroundColor: string,
  fileName: string,
  fileId: string | undefined,
  getLessonModuleJSON: () => string  // new parameter
): Promise<Blob> => {
  const zip = new JSZip();
  try {
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

    // NEW: Include lessonModule metadata using our helper method
    const lessonModuleJSON = getLessonModuleJSON();
    zip.file('document/lessonModule.json', lessonModuleJSON);

    return await zip.generateAsync({ type: 'blob' });
  } catch (error) {
    console.error('Error preparing document:', error);
    toast.error('Failed to prepare the document');
    throw error;
  }
};

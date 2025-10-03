/**
 * @file pages/api/calendar/notebook-details.ts
 * @description
 *   API endpoint for retrieving detailed notebook metadata including complete lesson unit arrays
 *   required for calendar schedule generation. This endpoint handles POST requests containing arrays
 *   of file IDs and returns comprehensive notebook information including lesson units, version data,
 *   and file metadata necessary for the enhanced calendar system. The implementation integrates with
 *   existing Firebase storage functions to load document files, extract lesson unit metadata using
 *   the lessoUnitExtractor utility, and provide structured responses with proper error handling and
 *   authentication. The endpoint supports the calendar service's requirement for detailed notebook
 *   information while maintaining efficient data loading patterns and providing comprehensive validation
 *   for notebook selection and schedule generation processes. All responses include proper timestamp
 *   formatting and version information to support the dynamic calendar update mechanism that detects
 *   when notebooks have been modified and require schedule regeneration.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import {  listUserFiles } from '@/app/src/services/firebase';
import { LessonUnit, NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';


interface NotebookDetailsRequest {
  fileIds: string[];
}

interface NotebookDetailsResponse {
  notebooks: NotebookMeta[];
}

/**
 * Main API handler for notebook details retrieval supporting calendar schedule generation.
 * Loads complete notebook metadata including lesson units for selected notebooks with
 * comprehensive error handling and authentication validation.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NotebookDetailsResponse | { error: string }>
) {
  console.log('[notebook-details.ts][7001] › Notebook details request received');

  // Step 1: Authenticate user session
  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('[notebook-details.ts][7002] › Authentication failed for notebook details request');
    return;
  }

  if (req.method !== 'POST') {
    console.log('[notebook-details.ts][7003] › Unsupported method:', req.method);
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const userId = session.user.email!;
  const { fileIds }: NotebookDetailsRequest = req.body;

  // Step 2: Validate request data
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    console.log('[notebook-details.ts][7004] › Invalid fileIds provided');
    return res.status(400).json({ error: 'Invalid fileIds array' });
  }

  try {
    console.log('[notebook-details.ts][7005] › Loading details for', fileIds.length, 'notebooks');

    // Step 3: Get user's file metadata to validate ownership and access
    const { ownedFiles, sharedFiles } = await listUserFiles(userId);
    const allAccessibleFiles = [...ownedFiles, ...sharedFiles];
    
    // Step 4: Filter to only requested files user has access to
    const accessibleFileIds = allAccessibleFiles
      .filter(file => fileIds.includes(file.fileId))
      .map(file => ({ 
        fileId: file.fileId, 
        fileName: file.fileName,
        filePath: file.fileStoragePath,
        lastUpdated: file.timestamp,
        lessonUnitsMeta: (file as any).lessonUnitsMeta,
        color: file.color
      }));

    console.log('[notebook-details.ts][7006] › Found', accessibleFileIds.length, 'accessible files');

    const notebooks: NotebookMeta[] = [];

    // Step 5: Process each accessible file
    for (const fileInfo of accessibleFileIds) {
      try {
        // Step 6: Check if we have cached lesson units metadata
        if (fileInfo.lessonUnitsMeta && fileInfo.lessonUnitsMeta.totalUnits > 0) {
          console.log('[notebook-details.ts][7007] › Using cached lesson units for', fileInfo.fileName);
          
          // Step 7: Convert cached metadata to lesson units array
          const lessonUnits: LessonUnit[] = Object
  .values((fileInfo.lessonUnitsMeta?.unitsByMap ?? fileInfo.lessonUnitsMeta?.units ?? {}) as Record<string, LessonUnit[]>)
  .flat();

          
          notebooks.push({
            fileId: fileInfo.fileId,
            filePath: fileInfo.filePath,
            fileName: fileInfo.fileName,
            lessonUnits: lessonUnits,
            color: fileInfo.color,
            lastUpdated: new Date(fileInfo.lastUpdated.seconds ? fileInfo.lastUpdated.seconds * 1000 : fileInfo.lastUpdated),
            version: `${fileInfo.lessonUnitsMeta.lastUpdated?.seconds || Date.now()}`,
          });
        } 
      } catch (fileError) {
        console.error('[notebook-details.ts][7011] › Error processing file', fileInfo.fileName, ':', fileError);
      }
    }

    console.log('[notebook-details.ts][7012] › Successfully processed', notebooks.length, 'notebooks with lesson units');
    
    return res.status(200).json({ notebooks });

  } catch (error) {
    console.error('[notebook-details.ts][7013] › Error loading notebook details:', error);
    return res.status(500).json({ 
      error: 'Failed to load notebook details',
    });
  }
}